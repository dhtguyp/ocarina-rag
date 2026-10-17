from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Ocarina RAG", lifespan=lifespan)


@app.get("/api/health")
async def health() -> dict[str, str]:
    # Placeholder liveness; Qdrant + SQLite checks arrive in Step 3.
    return {"status": "ok"}
