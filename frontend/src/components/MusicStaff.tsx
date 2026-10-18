import type { CSSProperties } from "react";
import { NOTE_COUNT } from "../types";
import { buttonForMidi } from "../utils/padNotes";

interface Props {
  notes: number[]; // base pad MIDI, in the order played
  /** Make the played notes fall off the staff (no-match). */
  falling?: boolean;
}

// Treble-clef staff, in-game style: each pad button sits at a fixed staff position.
// Steps count half-line-spacings up from the bottom line (E4).
const STEP: Record<number, number> = { 62: -1, 65: 1, 69: 3, 71: 4, 74: 6 }; // D4 F4 A4 B4 D5

const BOTTOM_Y = 100;
const HALF = 9; // half a line spacing
const X0 = 98;
const DX = 44;
const LINES = [0, 2, 4, 6, 8];

export default function MusicStaff({ notes, falling = false }: Props) {
  return (
    <svg
      viewBox="0 0 380 130"
      className={`staff${falling ? " staff-falling" : ""}`}
      role="img"
      aria-label={`Played notes: ${notes.length ? notes.map((n) => buttonForMidi(n)?.note).join(" ") : "none"}`}
      data-testid="staff"
    >
      {LINES.map((s) => (
        <line key={s} className="staff-line" x1="8" x2="372" y1={BOTTOM_Y - s * HALF} y2={BOTTOM_Y - s * HALF} />
      ))}
      <text className="staff-clef" x="12" y="92">
        𝄞
      </text>

      {Array.from({ length: NOTE_COUNT }, (_, i) => {
        const x = X0 + i * DX;
        const midi = notes[i];
        const b = midi !== undefined ? buttonForMidi(midi) : undefined;
        if (!b) return <circle key={i} className="staff-empty" cx={x} cy={BOTTOM_Y - 4 * HALF} r="3" />;
        const step = STEP[b.midi];
        const y = BOTTOM_Y - step * HALF;
        const stemUp = step < 4;
        return (
          <g key={i} className="staff-note" data-midi={midi} style={{ "--i": i } as CSSProperties}>
            <g transform={`translate(${x} ${y})`}>
              <line className="staff-stem" x1={stemUp ? 8 : -8} x2={stemUp ? 8 : -8} y1="0" y2={stemUp ? -34 : 34} />
              <ellipse className={`staff-head head-${b.kind}`} rx="10" ry="7" transform="rotate(-20)" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
