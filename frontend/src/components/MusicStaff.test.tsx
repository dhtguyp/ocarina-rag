import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MusicStaff from "./MusicStaff";

const notesOnStaff = () => screen.getByTestId("staff").querySelectorAll(".staff-note");
const headY = (i: number) => {
  const g = notesOnStaff()[i].querySelector("g")!; // translate(x y)
  return Number(/translate\(\S+ (\S+)\)/.exec(g.getAttribute("transform")!)![1]);
};

describe("MusicStaff", () => {
  it("draws a five-line staff", () => {
    render(<MusicStaff notes={[]} />);
    expect(screen.getByTestId("staff").querySelectorAll(".staff-line")).toHaveLength(5);
    expect(notesOnStaff()).toHaveLength(0);
    expect(screen.getByRole("img")).toHaveAccessibleName("Played notes: none");
  });

  it("puts one note on the staff per played note, in order", () => {
    render(<MusicStaff notes={[62, 74, 69]} />);
    expect(Array.from(notesOnStaff()).map((n) => n.getAttribute("data-midi"))).toEqual(["62", "74", "69"]);
    expect(screen.getByRole("img")).toHaveAccessibleName("Played notes: D4 D5 A4");
  });

  it("places higher pitches higher on the staff (smaller y)", () => {
    render(<MusicStaff notes={[62, 65, 69, 71, 74]} />);
    const ys = [0, 1, 2, 3, 4].map(headY);
    expect(ys).toEqual([...ys].sort((a, b) => b - a)); // D4 lowest ... D5 highest
    expect(new Set(ys).size).toBe(5);
  });

  it("colours the A button blue and C buttons yellow", () => {
    render(<MusicStaff notes={[62, 74]} />);
    const kinds = Array.from(notesOnStaff()).map((n) => n.querySelector(".staff-head")!.getAttribute("class"));
    expect(kinds[0]).toContain("head-a");
    expect(kinds[1]).toContain("head-c");
  });

  it("falls only when asked to", () => {
    const { rerender } = render(<MusicStaff notes={[62]} />);
    expect(screen.getByTestId("staff")).not.toHaveClass("staff-falling");
    rerender(<MusicStaff notes={[62]} falling />);
    expect(screen.getByTestId("staff")).toHaveClass("staff-falling");
  });
});
