import itertools

import pytest

from app.core.config import settings
from app.seed import SONGS
from app.services.intervals import interval_similarity, to_vector
from app.services.scoring import confidence, pitch_penalty


def test_no_penalty_at_original_pitch():
    assert pitch_penalty(0) == 0.0


def test_penalty_is_symmetric_and_gentle():
    assert pitch_penalty(3) == pytest.approx(0.03)
    assert pitch_penalty(-3) == pitch_penalty(3)
    assert pitch_penalty(1) < pitch_penalty(2) < pitch_penalty(3)


def test_penalty_is_capped():
    assert pitch_penalty(12) == settings.penalty_cap
    assert pitch_penalty(-40) == settings.penalty_cap


def test_worst_transposed_exact_match_still_succeeds():
    worst = confidence(1.0, pitch_penalty(10_000))
    assert worst >= settings.success_threshold


def test_confidence_combines_both_tiers():
    assert confidence(0.5, 0.1) == pytest.approx(0.45)


def test_only_exact_interval_shapes_can_succeed():
    """Over every playable 6-note sequence, success implies an exact interval match."""
    vectors = [to_vector(s["notes"]) for s in SONGS]
    pad = [62, 65, 69, 71, 74]
    for seq in itertools.product(pad, repeat=6):
        vec = to_vector(list(seq))
        best = max(interval_similarity(vec, v) for v in vectors)
        if best < 1.0:
            # even at zero pitch penalty a near-miss must stay below the success bar
            assert best < settings.success_threshold, seq
