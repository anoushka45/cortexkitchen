"""Unit tests for the WhatsApp-send orchestration triggered by approving a
whatsapp_vendor_order action (app/api/routes/action_queue.py::_send_whatsapp_order).

Twilio itself is mocked -- these tests verify the orchestration logic (mark_executed
on success, mark_error on failure or missing data), not the real Twilio API call.
"""

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes.action_queue import _send_whatsapp_order
from app.domain.services.action_queue_service import ActionQueueService
from app.domain.services.vendor_service import VendorService
from app.infrastructure.db.models import ActionQueue, ActionStatus, ActionTier, Vendor
from app.infrastructure.whatsapp.whatsapp_service import WhatsAppSendError


@pytest.fixture(scope="module")
def engine():
    eng = create_engine("sqlite:///:memory:")
    ActionQueue.__table__.create(bind=eng)
    Vendor.__table__.create(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session
        session.rollback()
        session.query(ActionQueue).delete()
        session.query(Vendor).delete()
        session.commit()


ORG_ID = 1


def _vendor(db, whatsapp_number="+919876543210"):
    v = Vendor(org_id=ORG_ID, name="Ramesh Traders", is_online=False, whatsapp_number=whatsapp_number)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def _whatsapp_action(db, vendor_id, message_draft="Order more mozzarella please"):
    """Creates and approves an action, matching the real flow where approve()
    always runs before _send_whatsapp_order is invoked."""
    aq_service = ActionQueueService(db)
    action = aq_service.create_action(
        org_id=ORG_ID, category="whatsapp_vendor_order", tier=ActionTier.approve_required,
        title="Order Mozzarella from Ramesh Traders",
        payload={"vendor_id": vendor_id, "ingredient": "Mozzarella Cheese", "message_draft": message_draft},
    )
    return aq_service.approve(action.id, user_id=1)


def test_successful_send_marks_action_executed(db):
    vendor = _vendor(db)
    action = _whatsapp_action(db, vendor.id)
    aq_service = ActionQueueService(db)
    vendor_service = VendorService(db)

    with patch("app.api.routes.action_queue.WhatsAppService") as mock_cls:
        mock_cls.return_value.send_message.return_value = "SM123"
        result = _send_whatsapp_order(aq_service, vendor_service, action)

    assert result.status == ActionStatus.executed
    assert result.executed_at is not None
    assert result.error is None


def test_twilio_failure_marks_action_error_not_executed(db):
    vendor = _vendor(db)
    action = _whatsapp_action(db, vendor.id)
    aq_service = ActionQueueService(db)
    vendor_service = VendorService(db)

    with patch("app.api.routes.action_queue.WhatsAppService") as mock_cls:
        mock_cls.return_value.send_message.side_effect = WhatsAppSendError("Twilio sandbox not joined")
        result = _send_whatsapp_order(aq_service, vendor_service, action)

    assert result.status == ActionStatus.approved  # unchanged -- not executed
    assert result.error == "Twilio sandbox not joined"


def test_missing_vendor_marks_error_without_calling_twilio(db):
    action = _whatsapp_action(db, vendor_id=9999)  # nonexistent vendor
    aq_service = ActionQueueService(db)
    vendor_service = VendorService(db)

    with patch("app.api.routes.action_queue.WhatsAppService") as mock_cls:
        result = _send_whatsapp_order(aq_service, vendor_service, action)
        mock_cls.assert_not_called()

    assert result.status == ActionStatus.approved
    assert "vendor" in result.error.lower() or "message" in result.error.lower()


def test_vendor_without_whatsapp_number_marks_error(db):
    vendor = _vendor(db, whatsapp_number=None)
    action = _whatsapp_action(db, vendor.id)
    aq_service = ActionQueueService(db)
    vendor_service = VendorService(db)

    with patch("app.api.routes.action_queue.WhatsAppService") as mock_cls:
        result = _send_whatsapp_order(aq_service, vendor_service, action)
        mock_cls.assert_not_called()

    assert result.status == ActionStatus.approved
    assert result.error is not None


def test_missing_message_draft_marks_error(db):
    vendor = _vendor(db)
    action = _whatsapp_action(db, vendor.id, message_draft="")
    aq_service = ActionQueueService(db)
    vendor_service = VendorService(db)

    with patch("app.api.routes.action_queue.WhatsAppService") as mock_cls:
        result = _send_whatsapp_order(aq_service, vendor_service, action)
        mock_cls.assert_not_called()

    assert result.status == ActionStatus.approved
    assert result.error is not None
