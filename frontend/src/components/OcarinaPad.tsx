import type { KeyboardEvent, PointerEvent } from "react";
import { PAD_BUTTONS, type PadButton } from "../utils/padNotes";

interface Props {
  shift: number;
  disabled: boolean;
  /** Fired the moment a button goes down (not on release). */
  onPress: (midi: number) => void;
}

const SLOT: Record<string, string> = {
  "c-up": "up",
  "c-left": "left",
  "c-right": "right",
  "c-down": "down",
  a: "a",
};

export default function OcarinaPad({ shift, disabled, onPress }: Props) {
  const render = (b: PadButton) => {
    const down = (e: PointerEvent) => {
      if (disabled || e.button > 0) return; // primary button / touch only
      onPress(b.midi);
    };
    const key = (e: KeyboardEvent) => {
      if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault(); // we handle it; no synthetic click
      if (!e.repeat) onPress(b.midi);
    };
    return (
      <button
        key={b.id}
        type="button"
        className={`pad-btn pad-${b.kind}`}
        style={{ gridArea: SLOT[b.id] }}
        disabled={disabled}
        aria-label={`${b.label} (${b.note}${shift ? ` ${shift > 0 ? "+" : ""}${shift}` : ""})`}
        data-testid={`pad-${b.id}`}
        onPointerDown={down}
        onKeyDown={key}
      >
        <span className="pad-glyph">{b.label}</span>
        <span className="pad-note">{b.note}</span>
      </button>
    );
  };

  return (
    <div className="ocarina" data-testid="ocarina">
      <svg className="ocarina-body" viewBox="0 0 380 340" aria-hidden="true">
        <defs>
          <linearGradient id="oc-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6fb4e8" />
            <stop offset="0.6" stopColor="#2f6fb8" />
            <stop offset="1" stopColor="#1d4580" />
          </linearGradient>
        </defs>
        {/* mouthpiece */}
        <rect x="18" y="62" width="132" height="58" rx="29" transform="rotate(38 84 91)" fill="url(#oc-body)" stroke="#10284d" strokeWidth="6" />
        <rect x="26" y="74" width="40" height="14" rx="7" transform="rotate(38 84 91)" fill="#fff" opacity="0.2" />
        {/* body */}
        <ellipse cx="204" cy="192" rx="160" ry="128" transform="rotate(-10 204 192)" fill="url(#oc-body)" stroke="#10284d" strokeWidth="6" />
        <ellipse cx="170" cy="120" rx="70" ry="22" transform="rotate(-18 170 120)" fill="#fff" opacity="0.18" />
      </svg>
      <div className="pad">{PAD_BUTTONS.map(render)}</div>
    </div>
  );
}
