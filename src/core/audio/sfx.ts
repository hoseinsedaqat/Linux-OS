import { useSettings } from '@/core/themes/settingsStore';

export type SoundName = 'open' | 'close' | 'notify' | 'error' | 'click' | 'snap' | 'boot' | 'lock';

/**
 * Tiny Web Audio synthesiser for shell feedback sounds.
 *
 * - No audio files: everything is generated, so nothing to download and no
 *   licensing questions.
 * - The context is created on the first user gesture (browser autoplay rules)
 *   and the volume follows the simulated system volume.
 * - `sounds` in Settings turns it off completely; a muted system volume also
 *   silences the shell.
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === 'closed') ctx = new Ctor();
  return ctx;
}

function tone(
  context: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  peak: number,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), context.currentTime + start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(context.currentTime + start);
  osc.stop(context.currentTime + start + duration + 0.02);
}

const RECIPES: Record<SoundName, Array<[number, number, number, OscillatorType, number]>> = {
  // [frequency, start, duration, waveform, relative peak]
  open: [
    [523.25, 0, 0.1, 'sine', 0.5],
    [783.99, 0.05, 0.12, 'sine', 0.35],
  ],
  close: [
    [523.25, 0, 0.09, 'sine', 0.35],
    [349.23, 0.04, 0.12, 'sine', 0.3],
  ],
  notify: [
    [880, 0, 0.11, 'triangle', 0.4],
    [1174.66, 0.1, 0.16, 'triangle', 0.32],
  ],
  error: [
    [220, 0, 0.16, 'sawtooth', 0.26],
    [174.61, 0.12, 0.2, 'sawtooth', 0.22],
  ],
  click: [[660, 0, 0.045, 'square', 0.12]],
  snap: [
    [392, 0, 0.05, 'triangle', 0.22],
    [523.25, 0.04, 0.06, 'triangle', 0.18],
  ],
  boot: [
    [261.63, 0, 0.22, 'sine', 0.3],
    [392, 0.14, 0.26, 'sine', 0.28],
    [523.25, 0.3, 0.42, 'sine', 0.26],
  ],
  lock: [
    [392, 0, 0.12, 'sine', 0.28],
    [261.63, 0.1, 0.22, 'sine', 0.24],
  ],
};

export function playSound(name: SoundName): void {
  const settings = useSettings.getState();
  if (!settings.sounds) return;
  const volume = Math.max(0, Math.min(1, settings.volume / 100));
  if (volume === 0) return;
  const context = audioContext();
  if (!context) return;
  if (context.state === 'suspended') void context.resume();
  const recipe = RECIPES[name];
  const master = 0.16 * volume * volume;
  recipe.forEach(([frequency, start, duration, type, peak]) => {
    tone(context, frequency, start, duration, type, master * peak);
  });
}

/** Used by the Settings "test sound" button. */
export function previewSound(): void {
  const settings = useSettings.getState();
  if (!settings.sounds) useSettings.getState().set('sounds', true);
  playSound('notify');
}

/** Suspend the context when the tab is hidden so no sound leaks in the background. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else void ctx.resume().catch(() => undefined);
  });
}
