import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "../test/render";
import Controls from "./Controls";

type Over = { shift?: number; volume?: number; busy?: boolean; canReset?: boolean };

const setup = (over: Over = {}) => {
  const props = {
    shift: 0, volume: 60, busy: false, canReset: true,
    onShift: vi.fn<(s: number) => void>(), onVolume: vi.fn<(v: number) => void>(),
    onReset: vi.fn<() => void>(), ...over,
  };
  renderWithMantine(<Controls {...props} />);
  return props;
};

describe("Controls", () => {
  it("shows the signed shift", () => {
    setup({ shift: 3 });
    expect(screen.getByTestId("shift-value")).toHaveTextContent("+3 st");
  });

  it("steps the shift by one semitone", async () => {
    const p = setup({ shift: 2 });
    await userEvent.click(screen.getByTestId("shift-up"));
    await userEvent.click(screen.getByTestId("shift-down"));
    expect(p.onShift.mock.calls).toEqual([[3], [1]]);
  });

  it("stops at the ±12 limits", () => {
    setup({ shift: 12 });
    expect(screen.getByTestId("shift-up")).toBeDisabled();
    expect(screen.getByTestId("shift-down")).toBeEnabled();
  });

  it("locks the lower limit too", () => {
    setup({ shift: -12 });
    expect(screen.getByTestId("shift-down")).toBeDisabled();
  });

  it("locks the shift while a request is in flight", () => {
    setup({ busy: true });
    expect(screen.getByTestId("shift-up")).toBeDisabled();
    expect(screen.getByTestId("shift-down")).toBeDisabled();
  });

  it("reset calls back, and is disabled when there is nothing to reset", async () => {
    const p = setup();
    await userEvent.click(screen.getByTestId("reset"));
    expect(p.onReset).toHaveBeenCalledOnce();
  });

  it("disables reset when canReset is false", () => {
    setup({ canReset: false });
    expect(screen.getByTestId("reset")).toBeDisabled();
  });
});
