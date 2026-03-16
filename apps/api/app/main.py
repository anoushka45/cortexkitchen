from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes import get_api_router
from app.api.schemas.common import ErrorResponse
from app.core.constants import SERVICE_NAME
from app.core.exceptions import AppError
from app.core.settings import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    payload = ErrorResponse(
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {
        "message": f"Welcome to {SERVICE_NAME}",
        "docs": "/docs",
    }


app.include_router(get_api_router())