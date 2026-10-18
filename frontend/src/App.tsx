import { Alert, Container, Loader, Modal, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { queryNotes } from "./api";
import Controls from "./components/Controls";
import MusicStaff from "./components/MusicStaff";
import OcarinaPad from "./components/OcarinaPad";
import ResultsView from "./components/ResultsView";
import SuccessBanner from "./components/SuccessBanner";
import { NOTE_COUNT, type Match, type QueryResponse } from "./types";
import { playFailure, playSequence, startNote } from "./utils/audio";

type Phase = "input" | "loading" | "done" | "error";

export const NO_MATCH_FALL_MS = 2000;

export default function App() {
  const [notes, setNotes] = useState<number[]>([]); // base (unshifted) pad MIDI
  const [shift, setShift] = useState(0);
  const [volume, setVolume] = useState(60);
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const requestId = useRef(0);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const vol = () => volumeRef.current / 100;
  const playJingle = (m: Match) => playSequence(m.notes, m.durations, m.bpm, vol());

  // The note currently sounding (held button). Released on any pointer/key release.
  const heldRef = useRef<(() => void) | null>(null);
  const release = () => {
    heldRef.current?.();
    heldRef.current = null;
  };
  useEffect(() => {
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", release);
      release();
    };
  }, []);

  const noMatch = phase === "done" && result !== null && result.matches.length === 0;

  // No match: let the notes fall for 2s, then reset automatically.
  useEffect(() => {
    if (!noMatch) return;
    const t = setTimeout(reset, NO_MATCH_FALL_MS);
    return () => clearTimeout(t);
  }, [noMatch]);

  const reset = () => {
    requestId.current++; // drop any in-flight response
    setNotes([]);
    setResult(null);
    setPhase("input");
  };

  const submit = async (played: number[]) => {
    const id = ++requestId.current;
    setPhase("loading");
    try {
      const res = await queryNotes(played, shift);
      if (id !== requestId.current) return;
      setResult(res);
      setPhase("done");
      if (res.success) playJingle(res.matches[0]);
      else if (res.matches.length === 0) playFailure(vol());
    } catch {
      if (id !== requestId.current) return;
      setPhase("error");
    }
  };

  const onPress = (midi: number) => {
    if (phase === "loading") return;
    release();
    heldRef.current = startNote(midi + shift, vol());
    const base = phase === "input" ? notes : []; // a press after a result starts a new snippet
    const next = [...base, midi];
    setNotes(next);
    setResult(null);
    setPhase("input");
    if (next.length === NOTE_COUNT) void submit(next);
  };

  const top = result?.matches[0];

  return (
    <Container size="xs" py="xl">
      <Stack gap="lg">
        <Stack gap={0} align="center">
          <Title className="game-title">Ocarina RAG</Title>
          <Text size="sm" c="dimmed">
            Play {NOTE_COUNT} notes to find the melody
          </Text>
        </Stack>

        <Paper className="sheet" p="sm" radius="md">
          <MusicStaff notes={notes} falling={noMatch} />
        </Paper>

        <OcarinaPad shift={shift} disabled={phase === "loading"} onPress={onPress} />

        <Paper className="controls" p="md" radius="md">
          <Controls
            shift={shift}
            volume={volume}
            busy={phase === "loading"}
            canReset={notes.length > 0 || phase !== "input"}
            onShift={setShift}
            onVolume={setVolume}
            onReset={reset}
          />
        </Paper>

        {phase === "loading" && (
          <Stack align="center" data-testid="loading">
            <Loader color="yellow" size="sm" />
          </Stack>
        )}
        {phase === "error" && (
          <Alert color="red" title="Couldn't reach the server" data-testid="error">
            Try again with Reset.
          </Alert>
        )}
        <Modal
          opened={phase === "done" && !!result?.success && !!top}
          onClose={reset}
          centered
          withCloseButton={false}
          padding={0}
          size="md"
          aria-label="Melody recognized"
          styles={{ content: { background: "transparent", boxShadow: "none" } }}
        >
          {top && (
            <SuccessBanner
              match={top}
              onReplay={() => playJingle(top)}
              onReset={reset}
            />
          )}
        </Modal>
        {phase === "done" && result && !result.success && result.matches.length > 0 && (
          <ResultsView matches={result.matches} />
        )}
        {noMatch && (
          <Text ta="center" c="dimmed" data-testid="no-match">
            The notes fall silent… no melody matched.
          </Text>
        )}
      </Stack>
    </Container>
  );
}
