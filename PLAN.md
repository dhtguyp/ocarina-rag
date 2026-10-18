# Project Plan: Ocarina RAG (Zelda-Inspired Snippet Audio Search Engine)

## 1. Project Overview & Objectives
A full-stack, containerized application that mimics the Ocarina mechanism from *The Legend of Zelda: Ocarina of Time*, combined with vector retrieval and a custom two-tier scoring algorithm (Interval Distance + Pitch-Shift Re-ranking). Users input 6-note melodic snippets on an authentic 5-button ocarina pad in a game-themed UI, and the system matches them against a curated dataset of iconic Zelda songs and pop culture easter eggs. High-confidence matches trigger an in-game style success jingle and visual confirmation. No-match will use in-game style 'notes drop' visual with a failure jingle.

(Note: this is retrieval + re-ranking only; there is no generation step, so "RAG" is used loosely.)

---

## 2. Tech Stack
* **Core Language:** Python 3.12+.
* **Backend:** FastAPI (async endpoints, automatic OpenAPI docs).
* **Frontend:** React + TypeScript + Vite + Mantine, styled with an Ocarina-themed layout. Served by nginx in Docker, with `/api` proxied to the backend (no CORS setup).
* **Vector Database:** Qdrant (Docker), storing interval vectors and payloads.
* **Metadata Database:** SQLite via SQLAlchemy (song titles, origins, full MIDI note sheets, canonical start pitch). Tables created with `create_all()` on startup; no Alembic (8 rows, no migrations needed).
* **Testing:** pytest (backend unit), Vitest + Testing Library (frontend unit, run in Docker via `frontend-test`), black-box E2E in `e2e/`.
* **Containerization:** Docker & Docker Compose (single-command boot: `qdrant`, `backend`, `frontend`).

---

## 3. Data Scope & Seeding
Notes are stored as **MIDI integers** (octave-aware), not letter names. The pad has exactly 5 pitches, matching the game's C-buttons:

| Button | Note | MIDI |
|---|---|---|
| A | D4 | 62 |
| C-Down | F4 | 65 |
| C-Right | A4 | 69 |
| C-Left | B4 | 71 |
| C-Up | D5 | 74 |

1. **Zelda: Ocarina of Time Songs** (all 6 notes, MIDI)
   * *Song of Time* — A4 D4 F4 A4 D4 F4 → `69 62 65 69 62 65`
   * *Song of Storms* — D4 F4 D5 D4 F4 D5 → `62 65 74 62 65 74`
   * *Saria's Song* — F4 A4 B4 F4 A4 B4 → `65 69 71 65 69 71`
   * *Zelda's Lullaby* — B4 D5 A4 B4 D5 A4 → `71 74 69 71 74 69`
   * *Sun's Song* — A4 F4 D5 A4 F4 D5 → `69 65 74 69 65 74`
   * *Epona's Song* — D5 B4 A4 D5 B4 A4 → `74 71 69 74 71 69`
2. **Pop Culture Easter Eggs** (approximated to the 5-pad pitches; first-pass picks, to be tuned after testing)
   * *Never Gonna Give You Up* — Rick Astley: D4 F4 A4 F4 B4 B4 → `62 65 69 65 71 71`
   * *One More Time* — Daft Punk: A4 A4 B4 A4 F4 D4 → `69 69 71 69 65 62`

Seeding is idempotent and runs on backend startup (and is also runnable via `python -m app.seed`).

---

## 4. Algorithmic Approach: Hybrid Two-Tier Scoring
* **Stage 1 (Recall): Interval-Based Vectorization**
  * Convert 6 MIDI notes into 5 interval deltas (signed semitone steps between consecutive notes).
  * Store the 5-dim interval vectors in Qdrant using **Manhattan (L1) distance** (not cosine, which ignores magnitude and is a poor fit for short vectors). Ensures **transposition invariance**.
  * `interval_sim = max(0, 1 - L1 / L1_MAX)` (`L1_MAX` configurable, tuned to 16 in Step 5).
  * Retrieve top-K (K = all songs initially; the dataset is tiny).
* **Stage 2 (Precision): Pitch-Shift Post-Processing Re-Ranking**
  * Store the canonical starting pitch (MIDI) in the Qdrant payload.
  * In FastAPI compute `Δ = (user_first_note + shift) - canonical_first_note`, where `shift` is the semitone toggle value.
  * **Gentle penalty scaling with |Δ|:** `pitch_penalty = min(0.08, 0.01 * |Δ|)`, capped at 8%.
  * `confidence = interval_sim * (1 - pitch_penalty)`.
  * Exact original-pitch matches score 100%. Transposed exact-interval matches score ≥ 92%, so they always count as a success. Where several songs overlap, the highest final confidence wins.
* **No-match floor:** results with `interval_sim` below a configurable floor (initial 0.5) are not shown as matches, so random input doesn't produce a fake "nearest song".
* **Success threshold:** confidence ≥ 0.90 triggers the success event.
* All constants (`L1_MAX`, penalty slope/cap, floor, threshold) live in `core/config.py`.

---

## 5. UI & Interactive Specifications
* **Ocarina-Themed Dashboard (Mantine):**
  * Layout: a music staff (treble clef, in-game style) on top, showing the played notes at their fixed staff positions (D4 below the bottom line, F4 first space, A4 second space, B4 third line, D5 fourth line); below it an **ocarina-shaped** pad holding the 5 note buttons; below that a separate controls panel (pitch, volume, reset) outside the ocarina.
  * 5 note buttons (A, C-Down, C-Right, C-Left, C-Up) as above. The note starts on press-down and sustains while the button is held (released on pointer/key up). Volume slider.
  * **Semitone Toggle (+ / -):** Shifts the pitch of the whole pad (range ±12), like in the game. It changes the audio pitch played and enters the penalty calculation via `Δ`. The current shift is displayed.
  * **Auto-Trigger on 6th Note:** Once the 6th note is input, the client sends the HTTP request to the FastAPI backend.
  * **Reset / Clear Button:** Clears the input buffer before 6 notes are reached (and after a result).
  * **In-Game Success Event (Confidence ≥ 90%):**
    * Zelda-style banner displaying the song name and origin.
    * **Web Audio API** plays back the matched song's jingle, synthesized client-side from the MIDI notes returned by the API (no audio files).
  * **Fallback View (< 90%):** Displays closest matches (above the no-match floor) with confidence breakdowns (interval similarity vs. pitch penalty). If nothing clears the floor (no match), the actual played notes fall out of their slots over 2 s with a failure jingle, then the input resets automatically.

---

## 6. Architecture & Data Flow
```
[React + Mantine UI]
│ POST /api/query  { notes: [6 base pad MIDI ints, unshifted], shift: int }
▼
[FastAPI Backend]
├─► Computes interval deltas
├─► Queries Qdrant (L1 distance on interval vectors)
├─► Fetches metadata from SQLite (song info, notes, canonical key)
└─► Computes final hybrid score (interval sim × pitch penalty), sorts, applies floor
│
▼
[Returns ranked matches: song, origin, confidence, interval_sim, pitch_penalty, delta, notes (MIDI) for jingle]
```

### API
* `POST /api/query` — body above; returns ranked matches and a `success` flag for the top result.
* `GET /api/songs` — list the seeded songs.
* `GET /api/health` — liveness (checks Qdrant + SQLite).

---

## 7. Project Structure (Monorepo Docker-Ready, at repo root)
```
Ocarina-RAG/
├── docker-compose.yml          # qdrant + backend + frontend
├── PLAN.md
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml          # deps (uv); uv.lock pins them
│   ├── uv.lock                 # pinned deps; Docker build uses `uv sync --frozen`
│   ├── tests/                  # pytest: intervals, scoring, query endpoint
│   └── app/
│       ├── main.py
│       ├── core/               # Config (constants) & DB connections
│       ├── models/             # SQLAlchemy models, Pydantic schemas
│       ├── services/           # Interval vectorization, Qdrant client, hybrid scoring
│       └── seed.py             # Idempotent dataset seeder
├── e2e/                        # black-box tests against the composed stack
│   ├── Dockerfile
│   ├── pyproject.toml / uv.lock
│   └── tests/                  # backend/ (API over HTTP) and frontend/ (Playwright browser)
└── frontend/
    ├── Dockerfile              # build + nginx
    ├── nginx.conf              # serves SPA, proxies /api
    ├── package.json
    ├── package-lock.json       # pinned deps; Docker build uses `npm ci`
    ├── vite.config.ts          # also holds the Vitest config
    └── src/
        ├── App.tsx
        ├── components/         # Ocarina Pad, Music Staff, Controls, Success Banner, Results View
        ├── utils/              # Web Audio API player helper
        └── test/               # Vitest setup; unit tests sit next to their sources (*.test.ts[x])
```

---

## 8. Implementation Roadmap for Agentic Workflow

*  Step 1: Initialize directory structure, configuration files, and docker-compose.yml (Qdrant + backend + frontend, SQLite volume, config constants).

*  Step 2: Build backend data seeding (seed.py), SQLAlchemy models, and interval conversion logic, with pytest unit tests for intervals.

*  Step 3: Implement core FastAPI endpoints (/api/query, /api/songs, /api/health) integrating Qdrant L1 search and the dual-tier scoring, with pytest tests for scoring and the endpoint.

*  Step 4: Build the React + Mantine frontend with the 5-button Ocarina pad, semitone toggle, volume, auto-submit on 6 notes, reset, success banner, results view, and Web Audio API playback/jingle.

*  Step 5: Run and extend the E2E suite (against a running stack: `docker compose up -d --build`, then `docker compose --profile e2e run --rm --build e2e`), add browser tests for the UI; tune constants and the easter-egg melodies.

---

## 9. Decisions Log
* Authentic 5-button pad; easter eggs approximated to those pitches.
* Semitone toggle transposes pad audio and feeds the penalty.
* Penalty `min(0.08, 0.01·|Δ|)`; transposed exact matches still succeed; best overall score wins.
* L1 distance instead of cosine; no-match floor added.
* SQLite kept for metadata; Alembic dropped.
* Step 5 tuning: `L1_MAX` 24 → 16. At 24, 10 of the 15,625 playable 6-note sequences were near-misses scoring ≥ 90% (false successes); at 16 only exact interval shapes can succeed (enforced by a backend test), while one-note-off plays still show as close matches. Easter-egg melodies kept as is (closest pair Saria/Rick has interval similarity 0.44 at 16, below the 0.5 floor).
