"""P5-12 RAG chatbot endpoint — P6-S04: agentic tool use, cross-session memory,
proactive patterns, semantic cache. P6-A1: real conversation persistence
(ChatSession/ChatMessage) — history was previously frontend-only, sent up fresh
on every request and never stored server-side beyond a compressed Qdrant summary."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
    get_memory,
    get_chat_cache,
    get_session_memory,
)
from app.api.schemas.chat import ChatRequest, ChatSessionSummary, ChatSessionDetail, ChatMessage as ChatMessageSchema
from app.domain.services.chat_service import build_context, stream_reply
from app.infrastructure.db.models import Organization, ChatSession, ChatMessage
from app.infrastructure.vector.session_memory import SessionMemoryService

router = APIRouter(prefix="/chat", tags=["chat"])


def _make_title(question: str) -> str:
    question = question.strip()
    return question[:60] + ("…" if len(question) > 60 else "")


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

    # P6-A1: resume an existing persisted session, or start a new one
    if body.session_id is not None:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == body.session_id, ChatSession.org_id == org_id, ChatSession.user_id == user_id)
            .first()
        )
        if session is None:
            raise HTTPException(status_code=404, detail="Chat session not found.")
    else:
        session = ChatSession(org_id=org_id, user_id=user_id, title=_make_title(body.question))
        db.add(session)
        db.commit()
        db.refresh(session)

    db.add(ChatMessage(session_id=session.id, role="user", content=body.question))
    db.commit()

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
            yield f"data: {json.dumps({'session_id': session.id})}\n\n"
            async for token in stream_reply(
                question=body.question,
                history=history,
                system_prompt=system_prompt,
                db=db,
                org_id=org_id,
                chat_cache=chat_cache,
                user_id=user_id,
            ):
                full_tokens.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield f"data: {json.dumps({'done': True})}\n\n"

            # P6-A1: persist the assistant's reply and bump the session's updated_at
            if full_tokens:
                try:
                    db.add(ChatMessage(session_id=session.id, role="assistant", content="".join(full_tokens)))
                    session.updated_at = datetime.utcnow()
                    db.add(session)
                    db.commit()
                except Exception:
                    db.rollback()

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


@router.get("/sessions", response_model=list[ChatSessionSummary], summary="List past chat conversation threads")
async def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> list[ChatSessionSummary]:
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.org_id == current_user["org_id"], ChatSession.user_id == current_user["user_id"])
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
        .all()
    )
    return [
        ChatSessionSummary(
            id=s.id,
            title=s.title,
            message_count=len(s.messages),
            updated_at=s.updated_at.isoformat() if s.updated_at else s.created_at.isoformat(),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail, summary="Fetch one conversation thread's full history")
async def get_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatSessionDetail:
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.org_id == current_user["org_id"],
            ChatSession.user_id == current_user["user_id"],
        )
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        messages=[ChatMessageSchema(role=m.role, content=m.content) for m in session.messages],
    )
