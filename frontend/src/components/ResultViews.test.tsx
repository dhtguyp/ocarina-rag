import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "../test/render";
import type { Match } from "../types";
import ResultsView from "./ResultsView";
import SuccessBanner from "./SuccessBanner";

const match = (over: Partial<Match> = {}): Match => ({
  slug: "song-of-time", title: "Song of Time", origin: "Ocarina of Time",
  confidence: 0.97, interval_sim: 1, pitch_penalty: 0.03, delta: 3,
  notes: [69, 62, 65, 69, 62, 65], ...over,
});

describe("SuccessBanner", () => {
  it("shows title, origin, rounded confidence and the transposition", () => {
    renderWithMantine(<SuccessBanner match={match()} onReplay={() => {}} onReset={() => {}} />);
    expect(screen.getByTestId("banner-title")).toHaveTextContent("Song of Time");
    expect(screen.getByText("Ocarina of Time")).toBeInTheDocument();
    expect(screen.getByTestId("banner-confidence")).toHaveTextContent("97% match · played +3 st");
  });

  it("omits the transposition note at the original pitch", () => {
    renderWithMantine(<SuccessBanner match={match({ delta: 0, confidence: 1 })} onReplay={() => {}} onReset={() => {}} />);
    expect(screen.getByTestId("banner-confidence")).toHaveTextContent(/^100% match$/);
  });

  it("replays on request", async () => {
    const onReplay = vi.fn();
    renderWithMantine(<SuccessBanner match={match()} onReplay={onReplay} onReset={() => {}} />);
    await userEvent.click(screen.getByTestId("replay"));
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it("has a Reset button next to Replay", async () => {
    const onReset = vi.fn();
    renderWithMantine(<SuccessBanner match={match()} onReplay={() => {}} onReset={onReset} />);
    await userEvent.click(screen.getByTestId("banner-reset"));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("ResultsView", () => {
  it("lists each candidate with its score breakdown", () => {
    renderWithMantine(
      <ResultsView
        matches={[
          match({ slug: "a", title: "Alpha", confidence: 0.8, interval_sim: 0.85, pitch_penalty: 0.05, delta: -5 }),
          match({ slug: "b", title: "Beta", confidence: 0.6, interval_sim: 0.6, pitch_penalty: 0, delta: 0 }),
        ]}
      />,
    );
    const alpha = screen.getByTestId("result-a");
    expect(alpha).toHaveTextContent("Alpha");
    expect(alpha).toHaveTextContent("80%");
    expect(alpha).toHaveTextContent("Interval 85%");
    expect(alpha).toHaveTextContent("Pitch penalty −5% (-5 st)");
    expect(screen.getByTestId("result-b")).toHaveTextContent("Pitch penalty −0%");
    expect(screen.getByTestId("result-b")).not.toHaveTextContent("st)");
  });
});
