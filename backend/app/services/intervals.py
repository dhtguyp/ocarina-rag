from app.core.config import settings


def to_intervals(notes: list[int]) -> list[int]:
    """Signed semitone steps between consecutive notes (transposition invariant)."""
    if len(notes) != settings.note_count:
        raise ValueError(f"expected {settings.note_count} notes, got {len(notes)}")
    return [b - a for a, b in zip(notes, notes[1:])]


def to_vector(notes: list[int]) -> list[float]:
    """Interval vector as floats, ready for Qdrant."""
    return [float(i) for i in to_intervals(notes)]


def l1_distance(a: list[float], b: list[float]) -> float:
    return sum(abs(x - y) for x, y in zip(a, b))


def interval_similarity(a: list[float], b: list[float]) -> float:
    """1.0 for identical interval shapes, falling linearly to 0 at l1_max."""
    return max(0.0, 1.0 - l1_distance(a, b) / settings.l1_max)
