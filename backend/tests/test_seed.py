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


def test_init_db_rebuilds_a_stale_songs_table(tmp_path, monkeypatch):
    """An old volume (songs table without durations/bpm) is rebuilt, not crashed on."""
    from sqlalchemy import text

    from app.core import db

    engine = create_engine(f"sqlite:///{tmp_path}/old.db")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE songs (id INTEGER PRIMARY KEY, slug VARCHAR, title VARCHAR, origin VARCHAR, notes JSON)"))
        conn.execute(text("INSERT INTO songs VALUES (1, 'x', 'X', 'Y', '[1,2,3,4,5,6]')"))
    monkeypatch.setattr(db, "engine", engine)

    db.init_db()
    with Session(engine) as s:
        songs = seed_sqlite(s)
    assert len(songs) == len(SONGS)
    assert all(song.durations and song.bpm for song in songs)
