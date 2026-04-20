"""
FastAPI dependency providers for infrastructure services.

All route handlers receive these via Depends() — never instantiate
infrastructure directly inside a route function.

Imports are intentionally lazy (inside functions) so that test
collection never triggers missing-package errors when deps are mocked.
"""

from typing import Generator

from fastapi import Depends
from sqlalchemy.orm import Session


# ── Database ─────────────────────────────────────────────────────────────────

def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session and close it when the request is done."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.settings import get_settings

    settings = get_settings()
    engine = create_engine(settings.postgres_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = SessionLocal()
    
    try:
        yield db
    finally:
        
        db.close()


# ── LLM provider ─────────────────────────────────────────────────────────────

def get_llm():
    """Return the configured LLM provider (Gemini for Phase 1)."""
    from app.infrastructure.llm.groq import GroqProvider
    from app.infrastructure.llm.gemini import GeminiProvider

    return GeminiProvider()


# ── Vector memory ─────────────────────────────────────────────────────────────

def get_memory():
    """Return a MemoryService backed by Qdrant."""
    from app.infrastructure.vector.qdrant_client import get_qdrant_client
    from app.infrastructure.vector.embedding_service import EmbeddingService
    from app.infrastructure.vector.memory_service import MemoryService

    qdrant = get_qdrant_client()
    embedder = EmbeddingService()
    return MemoryService(qdrant=qdrant, embedder=embedder)


# ── Orchestration deps bundle ─────────────────────────────────────────────────

def get_orchestration_deps(
    db: Session = Depends(get_db),
    llm=Depends(get_llm),
    memory=Depends(get_memory),
) -> dict:
    """
    Bundle all infrastructure deps into the dict shape that
    build_graph() and run_friday_rush() expect.
    """
    return {"db": db, "llm": llm, "memory": memory}