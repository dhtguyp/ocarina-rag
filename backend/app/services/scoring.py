from app.core.config import settings


def pitch_penalty(delta: int) -> float:
    """Gentle penalty growing with |delta| semitones, capped."""
    return min(settings.penalty_cap, settings.penalty_slope * abs(delta))


def confidence(interval_sim: float, penalty: float) -> float:
    return interval_sim * (1.0 - penalty)
