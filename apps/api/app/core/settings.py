from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# BaseSettings is a powerful Pydantic class that automatically 
# loads environment variables into Python objects with type validation.
class Settings(BaseSettings):
    # Field allows us to define defaults and 'aliases'. 
    # The 'alias' is the name of the variable in your .env file or OS environment.
    app_name: str = Field(default="CortexKitchen API", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")

    # Database and Service URLs
    # Pydantic will ensure these are strings and provide the local fallback if not found.
    postgres_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/cortexkitchen",
        alias="POSTGRES_URL",
    )
    qdrant_url: str = Field(default="http://localhost:6333", alias="QDRANT_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    llm_provider: str = Field(default="groq", alias="LLM_PROVIDER")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")

    # Auth
    jwt_secret_key: str = Field(default="change-me-in-production", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(default=60 * 24 * 7, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")

    # Sentry error tracking (leave blank to disable)
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")

    # LangSmith tracing
    langsmith_tracing: str = Field(default="false", alias="LANGSMITH_TRACING")
    langsmith_api_key: str = Field(default="", alias="LANGSMITH_API_KEY")
    langsmith_project: str = Field(default="CortexKitchen", alias="LANGSMITH_PROJECT")
    langsmith_endpoint: str = Field(default="https://api.smith.langchain.com", alias="LANGSMITH_ENDPOINT")

    # model_config defines global behavior for this Settings class
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

# @lru_cache (Least Recently Used cache) is a decorator that 'remembers' 
# the result of the function.
@lru_cache
def get_settings() -> Settings:
    """
    This function initializes the Settings class. 
    Because of @lru_cache, the .env file is only read and parsed once. 
    Subsequent calls to get_settings() return the exact same cached object,
    making it very efficient for dependency injection.
    """
    return Settings()
