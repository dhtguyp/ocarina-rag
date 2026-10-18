import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Web Audio graph that records what gets created and scheduled.
let oscillators: { frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; type: string }[];
let resume: ReturnType<typeof vi.fn>;

function installFakeAudio(state: "running" | "suspended" = "running") {
  oscillators = [];
  resume = vi.fn();
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = (extra = {}) => ({ connect: vi.fn((n) => n), ...extra });
  class FakeCtx {
    currentTime = 10;
    state = state;
    destination = {};
    resume = resume;
    createOscillator() {
      const o = node({ frequency: param(), type: "sine", start: vi.fn(), stop: vi.fn() });
      oscillators.push(o as any);
      return o;
    }
    createGain() {
      return node({ gain: param() });
    }
  }
  (window as any).AudioContext = FakeCtx;
}

// audio.ts caches its context at module level, so re-import it for each test.
async function load() {
  vi.resetModules();
  return import("./audio");
}

describe("audio", () => {
  beforeEach(() => installFakeAudio());

  it("startNote plays one note at the right frequency (A4 = 440 Hz)", async () => {
    const { startNote } = await load();
    startNote(69, 0.5);
    // each tone = main oscillator + vibrato LFO
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].frequency.value).toBeCloseTo(440);
  });

  it("an octave up doubles the frequency", async () => {
    const { startNote } = await load();
    startNote(81, 0.5);
    expect(oscillators[0].frequency.value).toBeCloseTo(880);
  });

  it("is silent at zero volume", async () => {
    const { startNote, playSequence, playFailure } = await load();
    startNote(69, 0)();
    playSequence([62, 65], [1, 1], 100, 0);
    playFailure(0);
    expect(oscillators).toHaveLength(0);
  });

  it("startNote sustains until stop() is called, then releases once", async () => {
    const { startNote } = await load();
    const stop = startNote(69, 0.5);
    expect(oscillators[0].stop).not.toHaveBeenCalled(); // still sounding while held
    stop();
    expect(oscillators[0].stop).toHaveBeenCalledOnce();
    stop(); // idempotent
    expect(oscillators[0].stop).toHaveBeenCalledOnce();
  });

  const starts = () => oscillators.filter((_, i) => i % 2 === 0).map((o) => o.start.mock.calls[0][0] as number);

  it("playSequence spaces notes by their own lengths and returns the total", async () => {
    const { playSequence } = await load();
    // 60 bpm -> 1 beat = 1 s; lengths 2, 1, 3 beats (half, quarter, dotted half)
    const duration = playSequence([71, 74, 69], [2, 1, 3], 60, 0.5);
    expect(starts()).toEqual([expect.closeTo(10.05), expect.closeTo(12.05), expect.closeTo(13.05)]);
    expect(duration).toBeCloseTo(6);
  });

  it("holds long notes longer than short ones", async () => {
    const { playSequence } = await load();
    playSequence([62, 65], [0.5, 3], 120, 0.5); // 0.25 s vs 1.5 s
    const stops = oscillators.filter((_, i) => i % 2 === 0).map((o) => o.stop.mock.calls[0][0] as number);
    const [s0, s1] = starts();
    expect(stops[1] - s1).toBeGreaterThan((stops[0] - s0) * 4);
  });

  it("tempo scales the whole jingle", async () => {
    const { playSequence } = await load();
    const slow = playSequence([62, 65], [1, 1], 60, 0.5);
    const fast = playSequence([62, 65], [1, 1], 120, 0.5);
    expect(slow).toBeCloseTo(fast * 2);
  });

  it("playFailure plays three descending triangle notes", async () => {
    const { playFailure } = await load();
    playFailure(0.5);
    const mains = oscillators.filter((_, i) => i % 2 === 0);
    const freqs = mains.map((o) => o.frequency.value);
    expect(freqs).toHaveLength(3);
    expect(freqs[0]).toBeGreaterThan(freqs[1]);
    expect(freqs[1]).toBeGreaterThan(freqs[2]);
    expect(mains.every((o) => o.type === "triangle")).toBe(true);
  });

  it("resumes a suspended context (browser autoplay policy)", async () => {
    installFakeAudio("suspended");
    const { startNote } = await load();
    startNote(69, 0.5);
    expect(resume).toHaveBeenCalled();
  });
});
