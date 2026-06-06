import os
import time

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.api.routes import get_api_router
from app.api.schemas.common import ErrorResponse
from app.core.constants import SERVICE_NAME
from app.core.exceptions import AppError
from app.core.logging import configure_logging
from app.core.settings import get_settings


# 1. Initialize Settings
settings = get_settings()

# 2. Configure structlog
configure_logging(debug=settings.app_debug)
log = structlog.get_logger()

# 3. Sentry — skip silently if DSN is not configured
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=1.0,
        send_default_pii=False,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )
    log.info("sentry_enabled", environment=settings.app_env)

# 4. Propagate LangSmith config into OS env so the langsmith SDK picks it up
if settings.langsmith_api_key:
    os.environ.setdefault("LANGSMITH_TRACING",  settings.langsmith_tracing)
    os.environ.setdefault("LANGSMITH_API_KEY",   settings.langsmith_api_key)
    os.environ.setdefault("LANGSMITH_PROJECT",   settings.langsmith_project)
    os.environ.setdefault("LANGSMITH_ENDPOINT",  settings.langsmith_endpoint)


# 2. Create the FastAPI Instance
app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
)


# 3. OpenTelemetry — HTTP-layer tracing (console exporter for dev; swap for OTLP in prod)
_tracer_provider = TracerProvider()
_tracer_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
FastAPIInstrumentor.instrument_app(app, tracer_provider=_tracer_provider)

# 3b. CORS Middleware
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


# 4. HTTP access log middleware
@app.middleware("http")
async def http_logging_middleware(request: Request, call_next):
    structlog.contextvars.clear_contextvars()
    t0 = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - t0) * 1000, 2)
    log.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )
    return response


# 5. Global Exception Handler
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


@app.get("/debug/sentry-test", tags=["debug"], include_in_schema=settings.app_debug)
def sentry_test():
    """Raises an intentional error to verify Sentry capture is working."""
    raise RuntimeError("Sentry smoke test — intentional error from CortexKitchen API")


# 6. Prometheus metrics — exposes /metrics in Prometheus text format
Instrumentator().instrument(app).expose(app)

# 7. Include Modular Routes
app.include_router(get_api_router())