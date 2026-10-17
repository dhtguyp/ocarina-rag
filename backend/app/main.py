import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(seed)  # blocking I/O; keep the event loop free
    yield


app = FastAPI(title="Ocarina RAG", lifespan=lifespan)


@app.get("/api/health")
async def health() -> dict[str, str]:
    # Placeholder liveness; Qdrant + SQLite checks arrive in Step 3.
    return {"status": "ok"}
