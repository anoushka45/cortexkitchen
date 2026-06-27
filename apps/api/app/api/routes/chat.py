"""P5-12 RAG chatbot endpoint — P6-S04: agentic tool use, cross-session memory,
proactive patterns, semantic cache."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
    get_memory,
    get_chat_cache,
    get_session_memory,
)
from app.api.schemas.chat import ChatRequest
from app.domain.services.chat_service import build_context, stream_reply
from app.infrastructure.db.models import Organization
from app.infrastructure.vector.session_memory import SessionMemoryService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", summary="Agentic RAG chatbot over run history")
async def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    memory=Depends(get_memory),
    chat_cache=Depends(get_chat_cache),
    session_memory=Depends(get_session_memory),
) -> StreamingResponse:
    org_id  = current_user["org_id"]
    user_id = current_user["user_id"]

    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = org.name if org else "your restaurant"

    history = [{"role": m.role, "content": m.content} for m in body.history]

    system_prompt = build_context(
        org_id=org_id,
        org_name=org_name,
        question=body.question,
        db=db,
        memory=memory,
        session_memory=session_memory,
        user_id=user_id,
    )

    async def event_generator():
        full_tokens: list[str] = []
        try:
            async for token in stream_reply(
                question=body.question,
                history=history,
                system_prompt=system_prompt,
                db=db,
                org_id=org_id,
                chat_cache=chat_cache,
            ):
                full_tokens.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield f"data: {json.dumps({'done': True})}\n\n"

            # Store session summary after the conversation turn completes
            if session_memory and full_tokens:
                try:
                    summary = SessionMemoryService.build_summary_from_messages(
                        messages=history + [
                            {"role": "user",      "content": body.question},
                            {"role": "assistant", "content": "".join(full_tokens)},
                        ],
                        question=body.question,
                    )
                    session_memory.store_session(
                        org_id=org_id,
                        user_id=user_id,
                        summary=summary,
                        message_count=len(history) + 2,
                    )
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
