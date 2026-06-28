"""
FastAPI dependency providers for infrastructure services.

All route handlers receive these via Depends() — never instantiate
infrastructure directly inside a route function.

Imports are intentionally lazy (inside functions) so that test
collection never triggers missing-package errors when deps are mocked.
"""

from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

_bearer = HTTPBearer(auto_error=False)


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


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Decode the Bearer JWT and return {user_id, org_id, role}."""
    from app.core.auth import decode_token

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    org_id  = payload.get("org_id")
    role    = payload.get("role")

    if not user_id or not org_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    return {"user_id": int(user_id), "org_id": int(org_id), "role": role}


# ── LLM provider ─────────────────────────────────────────────────────────────

def get_llm():
    """Return the configured LLM provider with automatic fallback."""
    from app.infrastructure.llm.factory import create_llm_provider

    return create_llm_provider()


# ── Vector memory ─────────────────────────────────────────────────────────────

def get_memory():
    """Return a MemoryService backed by Qdrant."""
    from app.infrastructure.vector.qdrant_client import get_qdrant_client
    from app.infrastructure.vector.embedding_service import EmbeddingService
    from app.infrastructure.vector.memory_service import MemoryService

    qdrant = get_qdrant_client()
    embedder = EmbeddingService()
    return MemoryService(qdrant=qdrant, embedder=embedder)


def get_semantic_cache():
    """Return a SemanticPlanCache backed by Qdrant (P6-S04)."""
    from app.infrastructure.vector.qdrant_client import get_qdrant_client
    from app.infrastructure.vector.embedding_service import EmbeddingService
    from app.infrastructure.cache.semantic_cache import SemanticPlanCache

    qdrant   = get_qdrant_client()
    embedder = EmbeddingService()
    return SemanticPlanCache(qdrant=qdrant, embedder=embedder)


def get_chat_cache():
    """Return a SemanticChatCache backed by Qdrant (P6-S04)."""
    from app.infrastructure.vector.qdrant_client import get_qdrant_client
    from app.infrastructure.vector.embedding_service import EmbeddingService
    from app.infrastructure.cache.semantic_cache import SemanticChatCache

    qdrant   = get_qdrant_client()
    embedder = EmbeddingService()
    return SemanticChatCache(qdrant=qdrant, embedder=embedder)


def get_session_memory():
    """Return a SessionMemoryService backed by Qdrant (P6-S04)."""
    from app.infrastructure.vector.qdrant_client import get_qdrant_client
    from app.infrastructure.vector.embedding_service import EmbeddingService
    from app.infrastructure.vector.session_memory import SessionMemoryService

    qdrant   = get_qdrant_client()
    embedder = EmbeddingService()
    return SessionMemoryService(qdrant=qdrant, embedder=embedder)


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
    from app.core.settings import get_settings
    from app.infrastructure.llm.factory import create_tiered_llm_providers

    deps = {"db": db, "llm": llm, "memory": memory}
    settings = get_settings()
    if settings.llm_provider.strip().lower() == "comet" and settings.comet_tiered:
        deps["llm_registry"] = create_tiered_llm_providers(settings)

    # Semantic cache and planning memory — silently skipped if Qdrant / Gemini not configured
    try:
        from app.infrastructure.vector.qdrant_client import get_qdrant_client
        from app.infrastructure.vector.embedding_service import EmbeddingService
        from app.infrastructure.cache.semantic_cache import SemanticPlanCache
        from app.infrastructure.vector.planning_memory import PlanningMemoryService

        qdrant   = get_qdrant_client()
        embedder = EmbeddingService()
        deps["semantic_cache"]   = SemanticPlanCache(qdrant=qdrant, embedder=embedder)
        deps["planning_memory"]  = PlanningMemoryService(qdrant=qdrant, embedder=embedder)
    except Exception:
        pass

    return deps
