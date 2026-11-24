let context: AudioContext | undefined;

export function unlockAudio(): void {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Audio is optional on unsupported browsers. */ }
}

function tone(frequency: number, end: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine') {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
  gain.gain.setValueAtTime(.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + .009);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export const sound = {
  slide: () => tone(220, 107, .13, .065, 0, 'triangle'),
  settle: () => tone(480, 210, .065, .07, 0, 'triangle'),
  stamp: () => {
    tone(113, 42, .24, .28, 0, 'triangle');
    tone(630, 165, .10, .10);
  },
  celebrate: () => [523.25, 659.25, 783.99, 1046.5].forEach((note, step) =>
    tone(note, note * .997, .28, .075, step * .075)),
};
