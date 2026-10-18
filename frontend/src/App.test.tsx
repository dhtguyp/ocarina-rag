import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderWithMantine } from "./test/render";
import type { Match, QueryResponse } from "./types";

vi.mock("./api", () => ({ queryNotes: vi.fn() }));
vi.mock("./utils/audio", () => ({
  startNote: vi.fn(),
  playSequence: vi.fn(() => 1),
  playFailure: vi.fn(),
}));

import { queryNotes } from "./api";
import { playFailure, playSequence, startNote } from "./utils/audio";

const query = vi.mocked(queryNotes);

const match = (over: Partial<Match> = {}): Match => ({
  slug: "song-of-time", title: "Song of Time", origin: "Ocarina of Time",
  confidence: 1, interval_sim: 1, pitch_penalty: 0, delta: 0,
  notes: [69, 62, 65, 69, 62, 65], durations: [1.5, 1.5, 3, 1.5, 1.5, 3], bpm: 100, ...over,
});
const SUCCESS: QueryResponse = { matches: [match()], success: true };
const PARTIAL: QueryResponse = { matches: [match({ confidence: 0.7, title: "Close One" })], success: false };
const NONE: QueryResponse = { matches: [], success: false };

const press = async (...ids: string[]) => {
  for (const id of ids) await userEvent.click(screen.getByTestId(`pad-${id}`));
};
const SIX = ["a", "c-down", "c-right", "c-left", "c-up", "a"];
const SIX_MIDI = [62, 65, 69, 71, 74, 62];

const stopNote = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(startNote).mockReturnValue(stopNote);
  query.mockResolvedValue(SUCCESS);
});

describe("App", () => {
  it("plays each pressed note, shifted by the semitone toggle", async () => {
    renderWithMantine(<App />);
    await userEvent.click(screen.getByTestId("shift-up"));
    await userEvent.click(screen.getByTestId("shift-up"));
    await press("a");
    expect(startNote).toHaveBeenCalledWith(64, 0.6); // D4 + 2 semitones, default volume 60%
  });

  it("starts the sound on press-down and holds it until release", async () => {
    const user = userEvent.setup(); // one instance: it tracks the held button
    renderWithMantine(<App />);
    await user.pointer({ keys: "[MouseLeft>]", target: screen.getByTestId("pad-a") });
    expect(startNote).toHaveBeenCalledOnce();
    expect(stopNote).not.toHaveBeenCalled(); // button still held
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(stopNote).toHaveBeenCalledOnce();
  });

  it("releases the sound even if the pointer is released elsewhere", async () => {
    const user = userEvent.setup();
    renderWithMantine(<App />);
    await user.pointer({ keys: "[MouseLeft>]", target: screen.getByTestId("pad-a") });
    await user.pointer({ target: document.body }); // drag off the button
    expect(stopNote).not.toHaveBeenCalled();
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(stopNote).toHaveBeenCalledOnce();
  });

  it("cuts the previous note when a new one starts", async () => {
    renderWithMantine(<App />);
    await userEvent.pointer({ keys: "[MouseLeft>]", target: screen.getByTestId("pad-a") });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: screen.getByTestId("pad-c-up") });
    expect(startNote).toHaveBeenCalledTimes(2);
    expect(stopNote).toHaveBeenCalledOnce();
  });

  it("does not query before the 6th note", async () => {
    renderWithMantine(<App />);
    await press(...SIX.slice(0, 5));
    expect(query).not.toHaveBeenCalled();
  });

  it("auto-submits on the 6th note with base notes and the shift", async () => {
    renderWithMantine(<App />);
    await userEvent.click(screen.getByTestId("shift-down"));
    await press(...SIX);
    await waitFor(() => expect(query).toHaveBeenCalledOnce());
    expect(query).toHaveBeenCalledWith(SIX_MIDI, -1);
  });

  it("success: shows the banner and plays the matched jingle", async () => {
    renderWithMantine(<App />);
    await press(...SIX);
    expect(await screen.findByTestId("success-banner")).toBeInTheDocument();
    expect(screen.getByTestId("banner-title")).toHaveTextContent("Song of Time");
    expect(playSequence).toHaveBeenCalledWith([69, 62, 65, 69, 62, 65], [1.5, 1.5, 3, 1.5, 1.5, 3], 100, 0.6);
    expect(playFailure).not.toHaveBeenCalled();
  });

  it("replay plays the jingle again", async () => {
    renderWithMantine(<App />);
    await press(...SIX);
    await userEvent.click(await screen.findByTestId("replay"));
    expect(playSequence).toHaveBeenCalledTimes(2);
  });

  it("weak matches: shows candidates, no banner, no failure jingle", async () => {
    query.mockResolvedValue(PARTIAL);
    renderWithMantine(<App />);
    await press(...SIX);
    expect(await screen.findByTestId("results")).toHaveTextContent("Close One");
    expect(screen.queryByTestId("success-banner")).not.toBeInTheDocument();
    expect(playSequence).not.toHaveBeenCalled();
    expect(playFailure).not.toHaveBeenCalled();
  });

  describe("no match", () => {
    const slots = () => screen.getByTestId("staff");
    const filled = () => slots().querySelectorAll(".staff-note");

    it("plays the failure jingle and makes the actual played notes fall (no duplicate row)", async () => {
      query.mockResolvedValue(NONE);
      renderWithMantine(<App />);
      await press(...SIX);
      expect(await screen.findByTestId("no-match")).toBeInTheDocument();
      expect(playFailure).toHaveBeenCalledOnce();
      expect(slots()).toHaveClass("staff-falling");
      expect(Array.from(filled()).map((e) => e.getAttribute("data-midi"))).toEqual(SIX_MIDI.map(String));
    });

    it("resets automatically after the 2s fall", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        query.mockResolvedValue(NONE);
        renderWithMantine(<App />);
        await press(...SIX);
        await screen.findByTestId("no-match");
        await act(() => vi.advanceTimersByTimeAsync(1900));
        expect(screen.getByTestId("no-match")).toBeInTheDocument(); // still falling
        await act(() => vi.advanceTimersByTimeAsync(200));
        expect(screen.queryByTestId("no-match")).not.toBeInTheDocument();
        expect(filled()).toHaveLength(0);
        expect(slots()).not.toHaveClass("staff-falling");
      } finally {
        vi.useRealTimers();
      }
    });

    it("pressing a note during the fall starts a fresh snippet and cancels the reset", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        query.mockResolvedValue(NONE);
        renderWithMantine(<App />);
        await press(...SIX);
        await screen.findByTestId("no-match");
        await press("c-up");
        await act(() => vi.advanceTimersByTimeAsync(2500));
        expect(filled()).toHaveLength(1); // not wiped by the old timer
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not auto-reset after a success", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        renderWithMantine(<App />);
        await press(...SIX);
        await screen.findByTestId("success-banner");
        await act(() => vi.advanceTimersByTimeAsync(5000));
        expect(screen.getByTestId("success-banner")).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("server error: shows an alert", async () => {
    query.mockRejectedValue(new Error("boom"));
    renderWithMantine(<App />);
    await press(...SIX);
    expect(await screen.findByTestId("error")).toBeInTheDocument();
  });

  it("disables the pad while the request is in flight", async () => {
    let resolve!: (r: QueryResponse) => void;
    query.mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithMantine(<App />);
    await press(...SIX);
    expect(await screen.findByTestId("loading")).toBeInTheDocument();
    expect(screen.getByTestId("pad-a")).toBeDisabled();
    resolve(SUCCESS);
    expect(await screen.findByTestId("success-banner")).toBeInTheDocument();
    expect(screen.getByTestId("pad-a")).toBeEnabled();
  });

  it("reset clears a partial snippet", async () => {
    renderWithMantine(<App />);
    await press("a", "c-up");
    expect(screen.getByTestId("staff").querySelectorAll(".staff-note")).toHaveLength(2);
    await userEvent.click(screen.getByTestId("reset"));
    expect(screen.getByTestId("staff").querySelectorAll(".staff-note")).toHaveLength(0);
    expect(screen.getByTestId("reset")).toBeDisabled();
  });

  describe("success pop-up", () => {
    const staffNotes = () => screen.getByTestId("staff").querySelectorAll(".staff-note");

    it("appears as a modal dialog", async () => {
      renderWithMantine(<App />);
      await press(...SIX);
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toContainElement(screen.getByTestId("success-banner"));
    });

    it("its Reset button closes it and clears the input", async () => {
      renderWithMantine(<App />);
      await press(...SIX);
      await userEvent.click(await screen.findByTestId("banner-reset"));
      await waitFor(() => expect(screen.queryByTestId("success-banner")).not.toBeInTheDocument());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(staffNotes()).toHaveLength(0);
    });

    it("Escape closes it and clears the input too", async () => {
      renderWithMantine(<App />);
      await press(...SIX);
      await screen.findByRole("dialog");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(staffNotes()).toHaveLength(0);
    });

    it("shows nothing for a non-success result", async () => {
      query.mockResolvedValue(PARTIAL);
      renderWithMantine(<App />);
      await press(...SIX);
      await screen.findByTestId("results");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("pressing a note after a weak result starts a new snippet", async () => {
    query.mockResolvedValue(PARTIAL);
    renderWithMantine(<App />);
    await press(...SIX);
    await screen.findByTestId("results");
    await press("c-up");
    expect(screen.queryByTestId("results")).not.toBeInTheDocument();
    expect(screen.getByTestId("staff").querySelectorAll(".staff-note")).toHaveLength(1);
  });

  it("ignores a stale response that arrives after reset", async () => {
    let resolve!: (r: QueryResponse) => void;
    query.mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithMantine(<App />);
    await press(...SIX);
    await screen.findByTestId("loading");
    await userEvent.click(screen.getByTestId("reset"));
    resolve(SUCCESS);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("success-banner")).not.toBeInTheDocument();
    expect(playSequence).not.toHaveBeenCalled();
  });
});
