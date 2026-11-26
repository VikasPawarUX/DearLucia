/// <reference types="vite/client" />
// One calm track loops for the whole game.
const openingTrack = new URL('../assets/audio/music/etirwer.m4a', import.meta.url).href;
const effectFiles = import.meta.glob<string>('../assets/audio/sfx/*.wav', {
  eager: true, import: 'default', query: '?url',
});

const cues = {
  tap: .30, number: .15, paint: .15, ornament: .15, frame: .15, entrance: .15,
  slide: .45, settle: .45, correct: .40, neighbors: .40,
  stamp: .50, sparkle: .50, painting: .50, page: .30,
} as const;
type Cue = keyof typeof cues;
type Preferences = { music: number; effects: number; muted: boolean };
type PlayingTrack = { source: AudioBufferSourceNode; gain: GainNode; end: number };
const key = 'dear-lucia-audio-v1';
// The track ends with a ~1.5 s natural fade. Each new pass starts as that tail begins, easing in
// over the same 1.5 s, so the loop never drops to silence or restarts with a jolt.
const crossfade = 1.5;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function preferences(): Preferences {
  const defaults = { music: .25, effects: 1, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (saved && typeof saved === 'object') return {
      music: Number.isFinite(saved.music) ? clamp(saved.music) : defaults.music,
      effects: Number.isFinite(saved.effects) ? clamp(saved.effects) : defaults.effects,
      muted: saved.muted === true,
    };
  } catch { /* Preferences remain optional. */ }
  return defaults;
}

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private prefs = preferences();
  // Volumes to bring back when a channel is switched on again from the settings buttons.
  private lastMusic = this.prefs.music || .25;
  private lastEffects = this.prefs.effects || 1;
  private focused = true;
  private adPaused = false;
  private audible = false;
  private pauseTimer?: number;
  private readonly samples = new Map<string, Promise<AudioBuffer>>();
  private readonly voices = new Map<Cue, AudioBufferSourceNode>();
  private openingBytes?: Promise<ArrayBuffer | undefined>;
  private current?: PlayingTrack;
  /** The decoded music, kept so every pass of the loop replays it without decoding again. */
  private track?: AudioBuffer;
  private loading = false;
  private retryAt = 0;

  constructor() {
    document.addEventListener('visibilitychange', () => this.syncActivity());
    window.addEventListener('blur', () => { this.focused = false; this.syncActivity(); });
    window.addEventListener('focus', () => { this.focused = true; this.syncActivity(); });
  }

  private get active(): boolean {
    return !document.hidden && this.focused && !this.adPaused;
  }

  /** Silence and suspend all audio while a Poki ad is playing. */
  setAdPlaying(playing: boolean): void {
    this.adPaused = playing;
    this.syncActivity();
  }

  preloadOpening(): void {
    this.openingBytes ??= this.fetchAudio(openingTrack).catch(() => undefined);
  }

  unlock(): void {
    if (!this.active) return;
    try {
      if (!this.context) {
        const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return;
        const ctx = this.context = new Audio();
        this.master = ctx.createGain();
        this.music = ctx.createGain();
        this.effects = ctx.createGain();
        this.master.gain.value = 0;
        this.music.gain.value = this.prefs.music;
        this.effects.gain.value = this.prefs.effects;
        this.music.connect(this.master);
        this.effects.connect(this.master);
        this.master.connect(ctx.destination);
        Object.values(effectFiles).forEach(url => { void this.sample(url).catch(() => {}); });
        window.setInterval(() => this.updatePlaylist(), 140);
      }
      this.syncActivity();
    } catch { /* Unsupported audio never prevents gameplay. */ }
  }

  get settings(): Readonly<Preferences> { return { ...this.prefs }; }

  setMusicVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    if (value > 0) this.lastMusic = clamp(value);
    this.setPreferences({ music: clamp(value) });
  }

  setEffectsVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    if (value > 0) this.lastEffects = clamp(value);
    this.setPreferences({ effects: clamp(value) });
  }

  /** Whether music or sound effects can currently be heard (on, with volume, and not muted). */
  isOn(channel: 'music' | 'effects'): boolean {
    return !this.prefs.muted && this.prefs[channel] > 0;
  }

  /** Switch music or sound effects on or off, restoring the last volume when switching on. */
  setOn(channel: 'music' | 'effects', on: boolean): void {
    const next = { ...this.prefs };
    if (next.muted) {
      // A global mute (M key) becomes "both off", so one channel can come back on alone.
      if (next.music > 0) this.lastMusic = next.music;
      if (next.effects > 0) this.lastEffects = next.effects;
      next.music = 0;
      next.effects = 0;
      next.muted = false;
    }
    if (channel === 'music') {
      if (!on && next.music > 0) this.lastMusic = next.music;
      next.music = on ? this.lastMusic : 0;
    } else {
      if (!on && next.effects > 0) this.lastEffects = next.effects;
      next.effects = on ? this.lastEffects : 0;
    }
    this.setPreferences(next);
  }

  adjustMusic(delta: number): void { this.setMusicVolume(this.prefs.music + delta); }
  adjustEffects(delta: number): void { this.setEffectsVolume(this.prefs.effects + delta); }
  setMuted(muted: boolean): void { this.setPreferences({ muted }); }
  toggleMute(): void { this.setMuted(!this.prefs.muted); }

  private setPreferences(change: Partial<Preferences>): void {
    this.prefs = { ...this.prefs, ...change };
    try { localStorage.setItem(key, JSON.stringify(this.prefs)); } catch { /* Optional storage. */ }
    this.ramp(this.music, this.prefs.music, .08);
    this.ramp(this.effects, this.prefs.effects, .08);
    if (change.muted !== undefined) this.ramp(this.master, this.active && !this.prefs.muted ? 1 : 0, .12);
  }

  private ramp(node: GainNode | undefined, to: number, duration: number): void {
    if (!node || !this.context) return;
    const now = this.context.currentTime;
    if (typeof node.gain.cancelAndHoldAtTime === 'function') node.gain.cancelAndHoldAtTime(now);
    else {
      const value = node.gain.value;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(value, now);
    }
    node.gain.linearRampToValueAtTime(to, now + duration);
  }

  private syncActivity(): void {
    const ctx = this.context;
    if (!ctx) return;
    window.clearTimeout(this.pauseTimer);
    if (!this.active) {
      this.audible = false;
      this.ramp(this.master, 0, .12);
      for (const voice of this.voices.values()) voice.stop();
      this.voices.clear();
      this.pauseTimer = window.setTimeout(() => {
        if (!this.active && ctx.state === 'running') void ctx.suspend().catch(() => {});
      }, 140);
      return;
    }
    const resumed = () => {
      if (!this.active) return;
      if (!this.audible) {
        this.audible = true;
        this.ramp(this.master, this.prefs.muted ? 0 : 1, this.current ? .75 : .18);
      }
      this.updatePlaylist();
    };
    if (ctx.state !== 'running') void ctx.resume().then(resumed).catch(() => {});
    else resumed();
  }

  private async fetchAudio(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw Error(`Audio request failed: ${response.status}`);
    return response.arrayBuffer();
  }

  private async decode(url: string): Promise<AudioBuffer> {
    const openingBytes = url === openingTrack ? this.openingBytes : undefined;
    if (url === openingTrack) this.openingBytes = undefined;
    const bytes = await openingBytes ?? await this.fetchAudio(url);
    return this.context!.decodeAudioData(bytes);
  }

  private sample(url: string): Promise<AudioBuffer> {
    const cached = this.samples.get(url);
    if (cached) return cached;
    const request = this.decode(url).catch(error => {
      this.samples.delete(url);
      throw error;
    });
    this.samples.set(url, request);
    return request;
  }

  play(cue: Cue, delay = 0, volume = 1): void {
    const ctx = this.context;
    const url = effectFiles[`../assets/audio/sfx/${cue}.wav`];
    if (!ctx || !this.active || this.prefs.muted || !url) return;
    const when = ctx.currentTime + delay;
    void this.sample(url).then(buffer => {
      if (!this.active || this.prefs.muted || ctx.state !== 'running' || ctx.currentTime - when > .28) return;
      if (!this.voices.has(cue) && this.voices.size >= 5) return;
      this.voices.get(cue)?.stop();
      const voice = ctx.createBufferSource();
      const gain = ctx.createGain();
      voice.buffer = buffer;
      if (cue === 'slide' || cue === 'settle' || cue === 'tap') voice.playbackRate.value = .92 + Math.random() * .16;
      gain.gain.value = cues[cue] * .42 * volume;
      voice.connect(gain).connect(this.effects!);
      this.voices.set(cue, voice);
      voice.onended = () => {
        if (this.voices.get(cue) === voice) this.voices.delete(cue);
        voice.disconnect();
        gain.disconnect();
      };
      voice.start(Math.max(ctx.currentTime, when));
    }).catch(() => {});
  }

  private updatePlaylist(): void {
    const ctx = this.context;
    if (!ctx || !this.active || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.track && (!this.current || this.current.end - now <= crossfade)) this.startTrack(this.track);
    if (this.track || this.loading || now < this.retryAt) return;
    // Decode once and keep the buffer: every pass of the loop reuses it.
    this.loading = true;
    void this.decode(openingTrack).then(track => {
      this.track = track;
      this.updatePlaylist();
    }).catch(() => { this.retryAt = ctx.currentTime + 2; }).finally(() => { this.loading = false; });
  }

  private startTrack(buffer: AudioBuffer): void {
    const ctx = this.context!;
    const now = ctx.currentTime;
    const previous = this.current;
    const remaining = Math.max(0, (previous?.end ?? now) - now);
    const overlap = Math.min(crossfade, remaining);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + (overlap || .28));
    source.connect(gain).connect(this.music!);
    if (previous && overlap) {
      previous.gain.gain.setValueAtTime(1, now);
      previous.gain.gain.linearRampToValueAtTime(0, now + overlap);
    }
    const track = this.current = { source, gain, end: now + buffer.duration };
    source.onended = () => {
      if (this.current === track) this.current = undefined;
      source.disconnect();
      gain.disconnect();
    };
    source.start(now);
  }
}

export const audio = new AudioManager();
