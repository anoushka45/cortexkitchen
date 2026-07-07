"""action_queue.py — approve/reject agentic recommendations.

GET /api/v1/action-queue lists pending/approved/rejected/executed actions for
the org. POST .../approve and .../reject transition status. Execution itself
(e.g. actually sending a WhatsApp message) is the caller's responsibility --
this router only manages the approval lifecycle.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.domain.services.action_queue_service import ActionQueueService
from app.infrastructure.db.models import ActionStatus

router = APIRouter(prefix="/action-queue", tags=["action-queue"])


class ActionQueueItem(BaseModel):
    id: int
    category: str
    tier: str
    status: str
    title: str
    payload: dict
    approved_by: int | None = None
    executed_at: str | None = None
    error: str | None = None
    created_at: str | None = None


def _to_item(a) -> ActionQueueItem:
    return ActionQueueItem(
        id=a.id, category=a.category, tier=a.tier.value, status=a.status.value,
        title=a.title, payload=a.payload, approved_by=a.approved_by,
        executed_at=a.executed_at.isoformat() if a.executed_at else None,
        error=a.error,
        created_at=a.created_at.isoformat() if a.created_at else None,
    )


@router.get("", response_model=list[ActionQueueItem])
def list_actions(
    status_filter: ActionStatus | None = Query(default=None, alias="status"),
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActionQueueItem]:
    service = ActionQueueService(db)
    actions = service.list_actions(current["org_id"], status=status_filter)
    return [_to_item(a) for a in actions]


@router.post("/{action_id}/approve", response_model=ActionQueueItem)
def approve_action(
    action_id: int,
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActionQueueItem:
    service = ActionQueueService(db)
    action = service.get(action_id)
    if action is None or action.org_id != current["org_id"]:
        raise HTTPException(status_code=404, detail="Action not found.")
    action = service.approve(action_id, current["user_id"])
    return _to_item(action)


@router.post("/{action_id}/reject", response_model=ActionQueueItem)
def reject_action(
    action_id: int,
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActionQueueItem:
    service = ActionQueueService(db)
    action = service.get(action_id)
    if action is None or action.org_id != current["org_id"]:
        raise HTTPException(status_code=404, detail="Action not found.")
    action = service.reject(action_id, current["user_id"])
    return _to_item(action)
