# Ocarina RAG

A Zelda-inspired melody search engine. Play a 6-note snippet on an *Ocarina of Time*-style pad and the app finds the matching song, whether it's a classic Zelda tune or a pop-culture easter egg.

Matching is two-tier:

1. **Recall:** the snippet is converted to semitone intervals and searched in Qdrant (Manhattan distance), so a song still matches when played in a different key.
2. **Re-rank:** a small penalty scaled by how far the played pitch is from the song's original pitch makes exact-key plays score highest.

See [PLAN.md](PLAN.md) for the full design.

> **Status:** work in progress. Backend, query API and the ocarina UI are in place; browser E2E tests and tuning come next.

## Requirements

Only **Docker** with the Compose plugin. Nothing else to install: Python, Node and all dependencies run inside containers.

## Run

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| App (frontend + `/api` proxy) | http://localhost:8080 |
| Backend (FastAPI, docs at `/docs`) | http://localhost:8000 |
| Qdrant | http://localhost:6333/dashboard |

On startup the backend seeds the song database (SQLite) and the vector index (Qdrant). Seeding is idempotent, so restarting is safe. Stop with `docker compose down`; add `-v` to also wipe the stored data.

## Unit tests

```bash
docker compose run --rm --build backend-test    # pytest
docker compose run --rm --build frontend-test   # vitest + Testing Library
```

Each builds a test image from the same locked dependencies and runs inside it. Neither needs the stack running, and neither starts with `docker compose up`.

## End-to-end tests

The E2E tests run against an already-running stack, so start it first:

```bash
docker compose up -d --build
docker compose --profile e2e run --rm --build e2e
docker compose down   # when you're done
```

The tests run in a separate container and go through nginx exactly like a browser would (`http://frontend/api/...`), plus a direct backend check. If the stack isn't up, they wait up to 60 s, then stop with a message telling you to run `docker compose up`. Nothing to install.

The E2E suite lives in `e2e/` (`tests/backend/` today). Browser tests for the UI will be added once it exists.

## Tech stack

Python 3.12 · FastAPI · Qdrant · SQLite/SQLAlchemy · React + TypeScript + Vite + Mantine · nginx · Docker Compose

Dependencies are pinned in `backend/uv.lock` and `frontend/package-lock.json`, and the Docker builds install strictly from them (`uv sync --frozen`, `npm ci`).

## Development notes

To change backend dependencies, edit `backend/pyproject.toml` and regenerate the lock with `uv lock` (needs [uv](https://docs.astral.sh/uv/)). For the frontend, run `npm install` in `frontend/`. Neither is needed just to run or test the project.
