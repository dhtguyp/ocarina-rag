from collections.abc import Iterator
from functools import cache

from fastapi import APIRouter, Depends, HTTPException
from qdrant_client import QdrantClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, get_qdrant
from app.models import Song
from app.models.schemas import QueryRequest, QueryResponse, SongOut
from app.services.search import query_songs

router = APIRouter(prefix="/api")


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


@cache
def get_qdrant_client() -> QdrantClient:
    return get_qdrant()


# Handlers are sync `def` on purpose: the Qdrant and SQLAlchemy clients are
# blocking, so FastAPI runs them in its threadpool instead of the event loop.


@router.post("/query", response_model=QueryResponse)
def query(
    req: QueryRequest,
    client: QdrantClient = Depends(get_qdrant_client),
    session: Session = Depends(get_session),
) -> QueryResponse:
    return query_songs(req, client, session)


@router.get("/songs", response_model=list[SongOut])
def songs(session: Session = Depends(get_session)) -> list[Song]:
    return list(session.scalars(select(Song).order_by(Song.id)))


@router.get("/health")
def health(
    client: QdrantClient = Depends(get_qdrant_client),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    try:
        session.execute(text("SELECT 1"))
        client.get_collections()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"unhealthy: {exc}") from exc
    return {"status": "ok"}
