from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Infrastructure
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "ocarina_songs"
    sqlite_path: str = "./ocarina.db"

    # Melody shape
    note_count: int = 6  # notes per snippet -> note_count - 1 intervals
    max_shift: int = 12  # semitone toggle range (+/-)

    # Scoring (see PLAN.md section 4)
    l1_max: float = 24.0  # interval_sim = max(0, 1 - L1 / l1_max)
    penalty_slope: float = 0.01  # per semitone of |delta|
    penalty_cap: float = 0.08  # max pitch penalty
    match_floor: float = 0.5  # min interval_sim to be shown as a match
    success_threshold: float = 0.90  # confidence needed for success event
    top_k: int = 10

    model_config = {"env_prefix": ""}


settings = Settings()
