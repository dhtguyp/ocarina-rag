"""Backend E2E: real FastAPI + Qdrant + SQLite, reached through nginx like a user would."""

import pytest

# Mirrors the seeded dataset (PLAN.md section 3); kept independent of backend code on purpose.
SONGS = {
    "song-of-time": [69, 62, 65, 69, 62, 65],
    "song-of-storms": [62, 65, 74, 62, 65, 74],
    "sarias-song": [65, 69, 71, 65, 69, 71],
    "zeldas-lullaby": [71, 74, 69, 71, 74, 69],
    "suns-song": [69, 65, 74, 69, 65, 74],
    "eponas-song": [74, 71, 69, 74, 71, 69],
    "never-gonna-give-you-up": [62, 65, 69, 65, 71, 71],
    "one-more-time": [69, 69, 71, 69, 65, 62],
}


def query(api, notes, shift=0):
    return api.post("/api/query", json={"notes": notes, "shift": shift})


def test_health_through_proxy_and_direct(api, backend):
    assert api.get("/api/health").json() == {"status": "ok"}
    assert backend.get("/api/health").json() == {"status": "ok"}


def test_songs_are_seeded(api):
    songs = api.get("/api/songs").json()
    assert {s["slug"]: s["notes"] for s in songs} == SONGS


@pytest.mark.parametrize("slug", SONGS)
def test_each_song_is_recognised(api, slug):
    body = query(api, SONGS[slug]).json()
    assert body["success"] is True
    top = body["matches"][0]
    assert top["slug"] == slug
    assert top["confidence"] == pytest.approx(1.0)
    assert top["notes"] == SONGS[slug]


def test_transposed_play_still_matches_with_small_penalty(api):
    notes = [n + 3 for n in SONGS["song-of-storms"]]
    body = query(api, notes).json()
    top = body["matches"][0]
    assert body["success"] is True
    assert top["slug"] == "song-of-storms"
    assert top["delta"] == 3
    assert top["confidence"] == pytest.approx(0.97)


def test_semitone_shift_feeds_the_penalty(api):
    top = query(api, SONGS["sarias-song"], shift=-4).json()["matches"][0]
    assert top["slug"] == "sarias-song"
    assert top["delta"] == -4
    assert top["pitch_penalty"] == pytest.approx(0.04)


def test_near_miss_is_not_a_success(api):
    notes = list(SONGS["song-of-storms"])
    notes[5] = 71
    body = query(api, notes).json()
    assert body["success"] is False
    assert body["matches"][0]["slug"] == "song-of-storms"


def test_garbage_returns_no_matches(api):
    assert query(api, [62, 74, 62, 74, 62, 74]).json() == {"matches": [], "success": False}


@pytest.mark.parametrize(
    "payload",
    [
        {"notes": [62, 65, 69], "shift": 0},
        {"notes": [62, 65, 69, 71, 74, 62], "shift": 99},
        {"notes": [62, 65, 69, 71, 74, 500], "shift": 0},
    ],
)
def test_invalid_payload_is_rejected(api, payload):
    assert api.post("/api/query", json=payload).status_code == 422
