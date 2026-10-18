from typing import Annotated

from pydantic import BaseModel, Field

from app.core.config import settings

Midi = Annotated[int, Field(ge=0, le=127)]


class QueryRequest(BaseModel):
    # Base (unshifted) pad pitches as MIDI numbers, in the order played.
    notes: list[Midi] = Field(min_length=settings.note_count, max_length=settings.note_count)
    # Semitone toggle position; the client plays notes transposed by this amount.
    shift: int = Field(default=0, ge=-settings.max_shift, le=settings.max_shift)


class Match(BaseModel):
    slug: str
    title: str
    origin: str
    confidence: float
    interval_sim: float
    pitch_penalty: float
    delta: int
    notes: list[int]  # canonical MIDI notes, for jingle playback


class QueryResponse(BaseModel):
    matches: list[Match]
    success: bool  # top match confidence >= success_threshold


class SongOut(BaseModel):
    id: int
    slug: str
    title: str
    origin: str
    notes: list[int]

    model_config = {"from_attributes": True}
