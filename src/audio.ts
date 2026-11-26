/// <reference types="vite/client" />
const openingTrack = new URL('../assets/audio/music/etirwer.m4a', import.meta.url).href;
const musicFiles = [
  openingTrack,
  new URL('../assets/audio/music/forget-me-not.m4a', import.meta.url).href,
  new URL('../assets/audio/music/cute-tune.m4a', import.meta.url).href,
];
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
const crossfade = 3;
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
  private focused = true;
  private adPaused = false;
  private audible = false;
  private pauseTimer?: number;
  private readonly samples = new Map<string, Promise<AudioBuffer>>();
  private readonly voices = new Map<Cue, AudioBufferSourceNode>();
  private bag: string[] = [];
  private lastTrack = '';
  private openingPending = true;
  private openingBytes?: Promise<ArrayBuffer | undefined>;
  private current?: PlayingTrack;
  private next?: AudioBuffer;
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
    if (Number.isFinite(value)) this.setPreferences({ music: clamp(value) });
  }

  setEffectsVolume(value: number): void {
    if (Number.isFinite(value)) this.setPreferences({ effects: clamp(value) });
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

  private takeTrack(): string | undefined {
    if (!this.bag.length) {
      this.bag = [...musicFiles];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      const last = this.bag.length - 1;
      const swap = this.openingPending ? this.bag.indexOf(openingTrack) : this.bag[last] === this.lastTrack ? 0 : last;
      this.openingPending = false;
      [this.bag[swap], this.bag[last]] = [this.bag[last], this.bag[swap]];
    }
    return this.bag.pop();
  }

  private updatePlaylist(): void {
    const ctx = this.context;
    if (!ctx || !this.active || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.next && (!this.current || this.current.end - now <= crossfade)) {
      this.startTrack(this.next);
      this.next = undefined;
    }
    if (this.next || this.loading || now < this.retryAt) return;
    const url = this.takeTrack();
    if (!url) return;
    this.loading = true;
    void this.decode(url).then(track => {
      this.lastTrack = url;
      this.next = track;
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
