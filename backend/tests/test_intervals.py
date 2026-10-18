import pytest

from app.seed import SONGS
from app.services.intervals import (
    interval_similarity,
    l1_distance,
    to_intervals,
    to_vector,
)


def test_to_intervals_signed_steps():
    assert to_intervals([69, 62, 65, 69, 62, 65]) == [-7, 3, 4, -7, 3]


def test_to_intervals_transposition_invariant():
    notes = [62, 65, 74, 62, 65, 74]
    shifted = [n + 5 for n in notes]
    assert to_intervals(notes) == to_intervals(shifted)


@pytest.mark.parametrize("n", [0, 1, 5, 7])
def test_to_intervals_rejects_wrong_length(n):
    with pytest.raises(ValueError):
        to_intervals([60] * n)


def test_to_vector_is_floats():
    vec = to_vector([60, 62, 64, 62, 60, 60])
    assert vec == [2.0, 2.0, -2.0, -2.0, 0.0]
    assert all(isinstance(x, float) for x in vec)


def test_l1_distance():
    assert l1_distance([1, -2, 3], [0, 0, 0]) == 6


def test_similarity_identical_is_one_and_floors_at_zero():
    v = to_vector([60, 62, 64, 62, 60, 60])
    assert interval_similarity(v, v) == 1.0
    assert interval_similarity([0] * 5, [100] * 5) == 0.0


def test_seed_songs_are_valid_and_distinct():
    vectors = [tuple(to_vector(s["notes"])) for s in SONGS]
    assert len(set(vectors)) == len(SONGS)  # no two songs share an interval shape
    assert len({s["slug"] for s in SONGS}) == len(SONGS)


def test_every_song_has_a_rhythm():
    for s in SONGS:
        assert len(s["durations"]) == len(s["notes"]), s["slug"]
        assert all(d > 0 for d in s["durations"]), s["slug"]
        assert s["bpm"] > 0, s["slug"]


def test_zeldas_lullaby_keeps_its_three_four_rhythm():
    s = next(s for s in SONGS if s["slug"] == "zeldas-lullaby")
    assert s["durations"] == [2, 1, 3, 2, 1, 3]  # half, quarter, dotted half (x2)


def test_zelda_songs_are_rhythmically_distinct():
    zelda = [tuple(s["durations"]) for s in SONGS if s["origin"].startswith("The Legend")]
    assert len(set(zelda)) == len(zelda)
