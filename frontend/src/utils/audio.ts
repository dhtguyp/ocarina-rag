// Web Audio helpers: ocarina-ish tones synthesized in the browser (no audio files).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function tone(midi: number, start: number, dur: number, volume: number, type: OscillatorType = "sine") {
  if (volume <= 0) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const lfo = c.createOscillator(); // gentle vibrato
  const lfoGain = c.createGain();

  osc.type = type;
  osc.frequency.value = freq(midi);
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = freq(midi) * 0.006;
  lfo.connect(lfoGain).connect(osc.frequency);

  const peak = Math.max(volume * 0.5, 0.0002);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.03);
  gain.gain.setValueAtTime(peak, start + dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(gain).connect(c.destination);
  osc.start(start);
  lfo.start(start);
  osc.stop(start + dur + 0.05);
  lfo.stop(start + dur + 0.05);
}

/**
 * Start a pad note that sustains until the returned `stop()` is called
 * (i.e. while the button is held). `volume` is 0..1.
 */
export function startNote(midi: number, volume: number): () => void {
  if (volume <= 0) return () => {};
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();

  osc.frequency.value = freq(midi);
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = freq(midi) * 0.006;
  lfo.connect(lfoGain).connect(osc.frequency);

  const peak = Math.max(volume * 0.5, 0.0002);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.02);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  lfo.start(now);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const t = c.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.stop(t + 0.12);
    lfo.stop(t + 0.12);
  };
}

/** Jingle: a melody with per-note lengths (in beats) at `bpm`. Returns its duration in seconds. */
export function playSequence(midis: number[], durations: number[], bpm: number, volume: number): number {
  const beat = 60 / bpm;
  const t0 = getCtx().currentTime + 0.05;
  let t = t0;
  midis.forEach((m, i) => {
    const len = (durations[i] ?? 1) * beat;
    tone(m, t, Math.max(len * 0.95, 0.08), volume); // slight gap so repeated notes articulate
    t += len;
  });
  return t - t0;
}

/** Descending "wrong" jingle for no-match. */
export function playFailure(volume: number) {
  const t0 = getCtx().currentTime + 0.02;
  [64, 60, 55].forEach((m, i) => tone(m, t0 + i * 0.18, i === 2 ? 0.6 : 0.25, volume, "triangle"));
}
