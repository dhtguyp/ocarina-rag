from qdrant_client import QdrantClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    f"sqlite:///{settings.sqlite_path}", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def init_db() -> None:
    """Create SQLite tables (no migrations; see PLAN.md).

    The songs table is fully derived from the seed data, so if an older volume has
    a stale schema it is simply dropped and rebuilt by the seeder.
    """
    inspector = inspect(engine)
    for table in Base.metadata.sorted_tables:
        if inspector.has_table(table.name):
            have = {c["name"] for c in inspector.get_columns(table.name)}
            if have != {c.name for c in table.columns}:
                table.drop(engine)
    Base.metadata.create_all(engine)


def get_qdrant() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url)
