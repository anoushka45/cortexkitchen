from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import get_api_router
from app.api.schemas.common import ErrorResponse
from app.core.constants import SERVICE_NAME
from app.core.exceptions import AppError
from app.core.settings import get_settings


# 1. Initialize Settings
settings = get_settings()


# 2. Create the FastAPI Instance
app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
)


# 3. CORS Middleware
# Allows the Next.js frontend (port 3000) to call the API (port 8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 4. Global Exception Handler
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
app.include_router(get_api_router())