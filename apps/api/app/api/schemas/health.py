from pydantic import BaseModel, Field

from app.api.schemas.common import MetaInfo


class HealthResponse(BaseModel):
    status: str = Field(default="ok")
    service: str
    environment: str
    meta: MetaInfo = Field(default_factory=MetaInfo)