export interface PadButton {
  id: string;
  label: string;
  note: string;
  midi: number;
  kind: "a" | "c";
}

// Authentic ocarina pitches; see PLAN.md section 3.
export const PAD_BUTTONS: PadButton[] = [
  { id: "a", label: "A", note: "D4", midi: 62, kind: "a" },
  { id: "c-down", label: "▼", note: "F4", midi: 65, kind: "c" },
  { id: "c-right", label: "▶", note: "A4", midi: 69, kind: "c" },
  { id: "c-left", label: "◀", note: "B4", midi: 71, kind: "c" },
  { id: "c-up", label: "▲", note: "D5", midi: 74, kind: "c" },
];

export const buttonForMidi = (midi: number) => PAD_BUTTONS.find((b) => b.midi === midi);
