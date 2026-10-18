import logging
import time

from qdrant_client import QdrantClient, models
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal, get_qdrant, init_db
from app.models import Song
from app.services.intervals import to_vector

log = logging.getLogger(__name__)

# Pad pitches (MIDI): A=D4, C-Down=F4, C-Right=A4, C-Left=B4, C-Up=D5
D4, F4, A4, B4, D5 = 62, 65, 69, 71, 74

# Jingle rhythm: `durations` are note lengths in beats (quarter note = 1) played at `bpm`.
# Zelda rhythms follow the in-game phrasing (short-short-long); they are by-ear
# approximations, so tune them here if a jingle sounds off.
OOT = "The Legend of Zelda: Ocarina of Time"
SONGS: list[dict] = [
    {"slug": "song-of-time", "title": "Song of Time", "origin": OOT,
     "notes": [A4, D4, F4, A4, D4, F4], "durations": [1.5, 1.5, 3, 1.5, 1.5, 3], "bpm": 100},
    {"slug": "song-of-storms", "title": "Song of Storms", "origin": OOT,
     "notes": [D4, F4, D5, D4, F4, D5], "durations": [0.5, 0.5, 2, 0.5, 0.5, 3], "bpm": 150},
    {"slug": "sarias-song", "title": "Saria's Song", "origin": OOT,
     "notes": [F4, A4, B4, F4, A4, B4], "durations": [0.5, 0.5, 1, 0.5, 0.5, 1], "bpm": 130},
    {"slug": "zeldas-lullaby", "title": "Zelda's Lullaby", "origin": OOT,
     "notes": [B4, D5, A4, B4, D5, A4], "durations": [2, 1, 3, 2, 1, 3], "bpm": 126},  # 3/4: half, quarter, dotted half
    {"slug": "suns-song", "title": "Sun's Song", "origin": OOT,
     "notes": [A4, F4, D5, A4, F4, D5], "durations": [0.5, 0.5, 1, 0.5, 0.5, 1], "bpm": 150},
    {"slug": "eponas-song", "title": "Epona's Song", "origin": OOT,
     "notes": [D5, B4, A4, D5, B4, A4], "durations": [0.5, 0.5, 2, 0.5, 0.5, 2], "bpm": 100},
    {"slug": "never-gonna-give-you-up", "title": "Never Gonna Give You Up", "origin": "Rick Astley",
     "notes": [D4, F4, A4, F4, B4, B4], "durations": [0.5, 0.5, 0.5, 0.5, 1.5, 1.5], "bpm": 113},
    {"slug": "one-more-time", "title": "One More Time", "origin": "Daft Punk",
     "notes": [A4, A4, B4, A4, F4, D4], "durations": [1, 0.5, 0.5, 1, 1, 2], "bpm": 123},
]


def seed_sqlite(session: Session) -> list[Song]:
    """Upsert songs by slug; returns all songs."""
    existing = {s.slug: s for s in session.scalars(select(Song))}
    for data in SONGS:
        song = existing.get(data["slug"])
        if song is None:
            session.add(Song(**data))
        else:
            for field, value in data.items():
                setattr(song, field, value)
    session.commit()
    return list(session.scalars(select(Song).order_by(Song.id)))


def seed_qdrant(client: QdrantClient, songs: list[Song]) -> None:
    """Ensure the collection exists (L1 distance) and upsert interval vectors."""
    name = settings.qdrant_collection
    if not client.collection_exists(name):
        client.create_collection(
            name,
            vectors_config=models.VectorParams(
                size=settings.note_count - 1, distance=models.Distance.MANHATTAN
            ),
        )
    client.upsert(
        name,
        points=[
            models.PointStruct(
                id=s.id,
                vector=to_vector(s.notes),
                payload={"slug": s.slug, "canonical_pitch": s.canonical_pitch},
            )
            for s in songs
        ],
    )


def seed(retries: int = 30, delay: float = 1.0) -> None:
    """Seed SQLite and Qdrant. Idempotent; waits for Qdrant to come up."""
    init_db()
    with SessionLocal() as session:
        songs = seed_sqlite(session)
    client = get_qdrant()
    for attempt in range(1, retries + 1):
        try:
            seed_qdrant(client, songs)
            break
        except Exception as exc:  # Qdrant not ready yet
            if attempt == retries:
                raise
            log.warning("Qdrant not ready (%s); retry %d/%d", exc, attempt, retries)
            time.sleep(delay)
    log.info("Seeded %d songs", len(songs))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
