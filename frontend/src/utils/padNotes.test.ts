import { describe, expect, it } from "vitest";
import { buttonForMidi, PAD_BUTTONS } from "./padNotes";

describe("padNotes", () => {
  it("has the five authentic ocarina pitches", () => {
    expect(PAD_BUTTONS.map((b) => b.midi)).toEqual([62, 65, 69, 71, 74]);
    expect(PAD_BUTTONS.map((b) => b.note)).toEqual(["D4", "F4", "A4", "B4", "D5"]);
  });

  it("has unique ids and exactly one A button", () => {
    expect(new Set(PAD_BUTTONS.map((b) => b.id)).size).toBe(5);
    expect(PAD_BUTTONS.filter((b) => b.kind === "a")).toHaveLength(1);
  });

  it("looks buttons up by midi", () => {
    expect(buttonForMidi(62)?.id).toBe("a");
    expect(buttonForMidi(74)?.id).toBe("c-up");
    expect(buttonForMidi(60)).toBeUndefined();
  });
});
