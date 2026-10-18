import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import OcarinaPad from "./OcarinaPad";

describe("OcarinaPad", () => {
  it("renders the five buttons", () => {
    render(<OcarinaPad shift={0} disabled={false} onPress={() => {}} />);
    for (const id of ["a", "c-up", "c-down", "c-left", "c-right"]) {
      expect(screen.getByTestId(`pad-${id}`)).toBeInTheDocument();
    }
  });

  it("reports the midi note of the pressed button", async () => {
    const onPress = vi.fn();
    render(<OcarinaPad shift={0} disabled={false} onPress={onPress} />);
    await userEvent.click(screen.getByTestId("pad-a"));
    await userEvent.click(screen.getByTestId("pad-c-up"));
    expect(onPress.mock.calls).toEqual([[62], [74]]);
  });

  it("fires on press-down, before the button is released", async () => {
    const onPress = vi.fn();
    render(<OcarinaPad shift={0} disabled={false} onPress={onPress} />);
    await userEvent.pointer({ keys: "[MouseLeft>]", target: screen.getByTestId("pad-a") });
    expect(onPress).toHaveBeenCalledWith(62); // still held down
  });

  it("supports Enter and Space once per key press (no auto-repeat)", async () => {
    const onPress = vi.fn();
    render(<OcarinaPad shift={0} disabled={false} onPress={onPress} />);
    screen.getByTestId("pad-c-up").focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{Enter>3/}"); // held: repeats are ignored
    expect(onPress.mock.calls).toEqual([[74], [74], [74]]);
  });

  it("ignores presses when disabled", async () => {
    const onPress = vi.fn();
    render(<OcarinaPad shift={0} disabled onPress={onPress} />);
    await userEvent.click(screen.getByTestId("pad-a"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("includes the shift in the accessible label", () => {
    render(<OcarinaPad shift={2} disabled={false} onPress={() => {}} />);
    expect(screen.getByTestId("pad-a")).toHaveAccessibleName(/D4 \+2/);
  });
});
