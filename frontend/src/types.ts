export interface Match {
  slug: string;
  title: string;
  origin: string;
  confidence: number;
  interval_sim: number;
  pitch_penalty: number;
  delta: number;
  notes: number[];
  durations: number[]; // note lengths in beats (quarter = 1)
  bpm: number;
}

export interface QueryResponse {
  matches: Match[];
  success: boolean;
}

export const NOTE_COUNT = 6;
export const MAX_SHIFT = 12;
