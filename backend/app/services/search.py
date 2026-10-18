from qdrant_client import QdrantClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Song
from app.models.schemas import Match, QueryRequest, QueryResponse
from app.services.intervals import to_vector
from app.services.scoring import confidence, pitch_penalty


def query_songs(req: QueryRequest, client: QdrantClient, session: Session) -> QueryResponse:
    """Stage 1: Qdrant L1 recall on interval shape. Stage 2: pitch-shift re-rank."""
    hits = client.query_points(
        settings.qdrant_collection,
        query=to_vector(req.notes),
        limit=settings.top_k,
    ).points
    # For the Manhattan metric, Qdrant's score is the L1 distance itself.
    l1_by_id = {int(h.id): h.score for h in hits}
    songs = session.scalars(select(Song).where(Song.id.in_(l1_by_id))).all()

    played_pitch = req.notes[0] + req.shift
    matches: list[Match] = []
    for song in songs:
        interval_sim = max(0.0, 1.0 - l1_by_id[song.id] / settings.l1_max)
        if interval_sim < settings.match_floor:
            continue
        delta = played_pitch - song.canonical_pitch
        penalty = pitch_penalty(delta)
        matches.append(
            Match(
                slug=song.slug,
                title=song.title,
                origin=song.origin,
                confidence=confidence(interval_sim, penalty),
                interval_sim=interval_sim,
                pitch_penalty=penalty,
                delta=delta,
                notes=song.notes,
            )
        )
    matches.sort(key=lambda m: m.confidence, reverse=True)
    success = bool(matches) and matches[0].confidence >= settings.success_threshold
    return QueryResponse(matches=matches, success=success)
