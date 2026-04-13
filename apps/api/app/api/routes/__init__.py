from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.planning import router as planning_router
from app.core.settings import get_settings


def get_api_router() -> APIRouter:
    settings = get_settings()
    router = APIRouter(prefix=settings.api_v1_prefix)

    router.include_router(health_router)
    router.include_router(planning_router)

    return router