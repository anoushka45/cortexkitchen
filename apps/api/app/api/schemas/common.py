from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MetaInfo(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MessageResponse(BaseModel):
    message: str
    meta: MetaInfo = Field(default_factory=MetaInfo)


class DependencyStatus(BaseModel):
    name: str
    ok: bool
    detail: str


class DependenciesHealthResponse(BaseModel):
    service: str
    overall_ok: bool
    dependencies: list[DependencyStatus]
    meta: MetaInfo = Field(default_factory=MetaInfo)


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    meta: MetaInfo = Field(default_factory=MetaInfo)