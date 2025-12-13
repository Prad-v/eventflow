"""Database connection and session management."""
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from collections.abc import Generator # Keep this for get_db type hint if it's not explicitly removed by the snippet
# from functools import lru_cache # Removed

from sqlalchemy import create_engine, exc
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# Create sync engine
engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
)

# Sync session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency for getting DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
