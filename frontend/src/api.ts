import type { QueryResponse } from "./types";

/** Sends base (unshifted) pad MIDI notes plus the semitone shift. */
export async function queryNotes(notes: number[], shift: number): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, shift }),
  });
  if (!res.ok) throw new Error(`Query failed (${res.status})`);
  return res.json();
}
