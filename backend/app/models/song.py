from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Song(Base):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128))
    origin: Mapped[str] = mapped_column(String(128))
    notes: Mapped[list[int]] = mapped_column(JSON)  # MIDI note numbers
    durations: Mapped[list[float]] = mapped_column(JSON)  # note lengths in beats (quarter = 1)
    bpm: Mapped[int] = mapped_column(Integer)  # jingle tempo, beats per minute

    @property
    def canonical_pitch(self) -> int:
        return self.notes[0]
