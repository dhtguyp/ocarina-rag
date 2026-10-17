import pytest
from qdrant_client import QdrantClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.db import Base
from app.models import Song
from app.seed import SONGS, seed_qdrant, seed_sqlite
from app.services.intervals import to_vector


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def test_seed_sqlite_is_idempotent(session):
    seed_sqlite(session)
    songs = seed_sqlite(session)
    assert len(songs) == len(SONGS)
    assert session.scalar(select(Song).where(Song.slug == "song-of-time")).canonical_pitch == 69


def test_seed_qdrant_searches_by_interval_shape(session):
    client = QdrantClient(":memory:")
    songs = seed_sqlite(session)
    seed_qdrant(client, songs)
    seed_qdrant(client, songs)  # idempotent
    assert client.count(settings.qdrant_collection).count == len(SONGS)

    # Song of Storms played 3 semitones higher still matches it exactly
    query = to_vector([n + 3 for n in next(s for s in SONGS if s["slug"] == "song-of-storms")["notes"]])
    hit = client.query_points(settings.qdrant_collection, query=query, limit=1, with_payload=True).points[0]
    assert hit.payload["slug"] == "song-of-storms"
    assert hit.payload["canonical_pitch"] == 62
