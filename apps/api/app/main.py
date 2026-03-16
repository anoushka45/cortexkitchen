from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes import get_api_router
from app.api.schemas.common import ErrorResponse
from app.core.constants import SERVICE_NAME
from app.core.exceptions import AppError
from app.core.settings import get_settings


# 1. Initialize Settings
# This calls our @lru_cache function to load the .env configuration.
settings = get_settings()


# 2. Create the FastAPI Instance
# We use the settings we loaded to set the app's title and debug mode.
app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
)

# 3. Global Exception Handler
# This is a 'catch-all' for a specific custom error (AppError).
# Whenever your code raises an 'AppError', FastAPI intercepts it here.
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

# 5. Include Modular Routes
# This attaches all other API endpoints (like /health or /users) defined 
# in the 'routes' directory to this main app instance.
app.include_router(get_api_router())