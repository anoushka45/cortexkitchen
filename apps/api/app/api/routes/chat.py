"""P5-12: RAG chatbot endpoint — streams replies via SSE."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, get_memory
from app.api.schemas.chat import ChatRequest
from app.domain.services.chat_service import build_context, stream_reply
from app.infrastructure.db.models import Organization

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", summary="RAG chatbot over run history")
async def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    memory=Depends(get_memory),
) -> StreamingResponse:
    org = db.query(Organization).filter(Organization.id == current_user["org_id"]).first()
    org_name = org.name if org else "your restaurant"

    system_prompt = build_context(
        org_id=current_user["org_id"],
        org_name=org_name,
        question=body.question,
        db=db,
        memory=memory,
    )

    history = [{"role": m.role, "content": m.content} for m in body.history]

    async def event_generator():
        try:
            async for token in stream_reply(body.question, history, system_prompt):
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
