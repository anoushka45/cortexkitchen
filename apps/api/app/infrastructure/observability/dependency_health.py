from app.api.schemas.common import DependencyStatus
from app.core.constants import (
    DEPENDENCY_LLM,
    DEPENDENCY_POSTGRES,
    DEPENDENCY_QDRANT,
    DEPENDENCY_REDIS,
)
from app.core.settings import Settings


def check_postgres(settings: Settings) -> DependencyStatus:
    # Placeholder for now; real DB connectivity added in later phase
    ok = bool(settings.postgres_url)
    return DependencyStatus(
        name=DEPENDENCY_POSTGRES,
        ok=ok,
        detail="Configured" if ok else "Missing POSTGRES_URL",
    )


def check_qdrant(settings: Settings) -> DependencyStatus:
    ok = bool(settings.qdrant_url)
    return DependencyStatus(
        name=DEPENDENCY_QDRANT,
        ok=ok,
        detail="Configured" if ok else "Missing QDRANT_URL",
    )


def check_redis(settings: Settings) -> DependencyStatus:
    ok = bool(settings.redis_url)
    return DependencyStatus(
        name=DEPENDENCY_REDIS,
        ok=ok,
        detail="Configured" if ok else "Missing REDIS_URL",
    )


def check_llm(settings: Settings) -> DependencyStatus:
    has_provider = bool(settings.llm_provider)
    has_key = bool(settings.gemini_api_key) if settings.llm_provider == "gemini" else True
    ok = has_provider and has_key
    detail = "Configured" if ok else "Missing provider config or API key"
    return DependencyStatus(
        name=DEPENDENCY_LLM,
        ok=ok,
        detail=detail,
    )


def get_dependency_statuses(settings: Settings) -> list[DependencyStatus]:
    return [
        check_postgres(settings),
        check_qdrant(settings),
        check_redis(settings),
        check_llm(settings),
    ]