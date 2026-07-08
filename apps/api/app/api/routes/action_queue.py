"""action_queue.py — approve/reject agentic recommendations.

GET /api/v1/action-queue lists pending/approved/rejected/executed actions for
the org. POST .../reject just transitions status. POST .../approve transitions
status AND, for whatsapp_vendor_order actions, triggers the actual WhatsApp
send (P6-A9) -- approval and execution are the same step for that action kind,
since there's nothing further to approve once a human has reviewed the drafted
message. Other action categories may not have an execution step wired yet.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.domain.services.action_queue_service import ActionQueueService
from app.domain.services.trust_ladder_service import TrustLadderService
from app.domain.services.vendor_service import VendorService
from app.infrastructure.db.models import ActionQueue, ActionStatus
from app.infrastructure.whatsapp.whatsapp_service import WhatsAppSendError, WhatsAppService

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
    approval_streak: int = 0


def _to_item(a, approval_streak: int = 0) -> ActionQueueItem:
    return ActionQueueItem(
        id=a.id, category=a.category, tier=a.tier.value, status=a.status.value,
        title=a.title, payload=a.payload, approved_by=a.approved_by,
        executed_at=a.executed_at.isoformat() if a.executed_at else None,
        error=a.error,
        created_at=a.created_at.isoformat() if a.created_at else None,
        approval_streak=approval_streak,
    )


@router.get("", response_model=list[ActionQueueItem])
def list_actions(
    status_filter: ActionStatus | None = Query(default=None, alias="status"),
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActionQueueItem]:
    service = ActionQueueService(db)
    trust_ladder = TrustLadderService(db)
    actions = service.list_actions(current["org_id"], status=status_filter)
    return [
        _to_item(a, approval_streak=trust_ladder.count_consecutive_approvals(current["org_id"], a.category))
        for a in actions
    ]


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

    if action.category == "whatsapp_vendor_order":
        action = _send_whatsapp_order(service, VendorService(db), action)

    return _to_item(action)


def _send_whatsapp_order(service: ActionQueueService, vendor_service: VendorService, action: ActionQueue) -> ActionQueue:
    """Approving a whatsapp_vendor_order action is what actually triggers the send --
    approval and execution are the same step for this action kind. On any failure the
    action stays 'approved' with an error recorded, rather than silently losing the
    approval decision."""
    message = action.payload.get("message_draft")
    vendor_id = action.payload.get("vendor_id")
    vendor = vendor_service.get(vendor_id) if vendor_id else None

    if not message or vendor is None or not vendor.whatsapp_number:
        return service.mark_error(action.id, "Missing message draft or vendor WhatsApp number.")

    try:
        WhatsAppService().send_message(message)
    except WhatsAppSendError as exc:
        return service.mark_error(action.id, str(exc))

    return service.mark_executed(action.id)


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
