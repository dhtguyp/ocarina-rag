import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.db import Base
from app.main import app
from app.routes import get_qdrant_client, get_session
from app.seed import SONGS, seed_qdrant, seed_sqlite

BY_SLUG = {s["slug"]: s["notes"] for s in SONGS}


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    qdrant = QdrantClient(":memory:")
    with Session(engine) as s:
        seed_qdrant(qdrant, seed_sqlite(s))

    def session_override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_qdrant_client] = lambda: qdrant
    # No `with`: skip the lifespan, which would seed the real services.
    yield TestClient(app)
    app.dependency_overrides.clear()


def post(client, notes, shift=0):
    return client.post("/api/query", json={"notes": notes, "shift": shift})


def test_health_and_songs(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    songs = client.get("/api/songs").json()
    assert len(songs) == len(SONGS)
    assert {s["slug"] for s in songs} == set(BY_SLUG)


@pytest.mark.parametrize("slug", BY_SLUG)
def test_every_song_matches_itself_at_100_percent(client, slug):
    body = post(client, BY_SLUG[slug]).json()
    top = body["matches"][0]
    assert top["slug"] == slug
    assert top["confidence"] == pytest.approx(1.0)
    assert top["pitch_penalty"] == 0 and top["delta"] == 0
    assert top["notes"] == BY_SLUG[slug]
    assert body["success"] is True


def test_transposed_match_is_penalized_but_succeeds(client):
    notes = [n + 3 for n in BY_SLUG["song-of-storms"]]
    body = post(client, notes).json()
    top = body["matches"][0]
    assert top["slug"] == "song-of-storms"
    assert top["delta"] == 3
    assert top["confidence"] == pytest.approx(0.97)
    assert top["interval_sim"] == pytest.approx(1.0)
    assert body["success"] is True


def test_shift_compensating_a_transposition_restores_full_score(client):
    notes = [n + 3 for n in BY_SLUG["sarias-song"]]
    top = post(client, notes, shift=-3).json()["matches"][0]
    assert top["slug"] == "sarias-song"
    assert top["delta"] == 0
    assert top["confidence"] == pytest.approx(1.0)


def test_shift_alone_moves_delta(client):
    top = post(client, BY_SLUG["song-of-time"], shift=5).json()["matches"][0]
    assert top["delta"] == 5
    assert top["pitch_penalty"] == pytest.approx(0.05)


def test_near_miss_is_not_a_success(client):
    # Song of Storms with one note changed: close in shape, but not the song.
    notes = list(BY_SLUG["song-of-storms"])
    notes[2] = 69
    body = post(client, notes).json()
    assert body["matches"]
    assert body["matches"][0]["slug"] == "song-of-storms"
    assert body["matches"][0]["confidence"] < settings.success_threshold
    assert body["success"] is False


def test_matches_sorted_and_above_floor(client):
    body = post(client, [62, 65, 69, 71, 74, 71]).json()
    confs = [m["confidence"] for m in body["matches"]]
    assert confs == sorted(confs, reverse=True)
    assert all(m["interval_sim"] >= settings.match_floor for m in body["matches"])


def test_garbage_input_returns_no_match(client):
    body = post(client, [62, 74, 62, 74, 62, 74]).json()  # +12 -12 +12 -12 +12
    assert body == {"matches": [], "success": False}


@pytest.mark.parametrize(
    "payload",
    [
        {"notes": [62, 65, 69, 71, 74], "shift": 0},  # too few
        {"notes": [62, 65, 69, 71, 74, 62, 65], "shift": 0},  # too many
        {"notes": [62, 65, 69, 71, 74, 62], "shift": 13},  # shift out of range
        {"notes": [62, 65, 69, 71, 74, 200], "shift": 0},  # not MIDI
    ],
)
def test_invalid_requests_rejected(client, payload):
    assert client.post("/api/query", json=payload).status_code == 422
