"""Unit tests for WorkflowTriggerService -- the 2 built-in triggers that
auto-create Action Queue rows after a planning run finishes."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.infrastructure.db.models import ActionQueue, ActionStatus
from app.domain.services.workflow_trigger_service import WorkflowTriggerService


@pytest.fixture(scope="module")
def engine():
    eng = create_engine("sqlite:///:memory:")
    ActionQueue.__table__.create(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session
        session.rollback()
        session.query(ActionQueue).delete()
        session.commit()


ORG_ID = 1


def _plan_with_shortages(*ingredients_with_severity):
    return {
        "recommendations": {
            "inventory": {
                "data": {
                    "shortage_alerts": [
                        {"ingredient": name, "severity": severity}
                        for name, severity in ingredients_with_severity
                    ]
                }
            }
        },
        "market_intel": {},
    }


def _plan_with_market(tonight_busy, deals, slot_deals=None):
    # P6-A20: OccupancyEnricher exposes a count/summary, not a named-restaurant
    # list -- `deals` here is still passed as a list by callers for readability,
    # reduced to its count to match the anonymised market_intel shape.
    return {
        "recommendations": {},
        "market_intel": {
            "tonight_busy": tonight_busy,
            "dineout_deals_count": len(deals),
            "slot_deals_found": slot_deals or [],
        },
    }


# ── Trigger 1: critical shortages ────────────────────────────────────────────

def test_two_critical_shortages_creates_restock_alert(db):
    plan = _plan_with_shortages(("Mozzarella", "critical"), ("Basil", "critical"))
    service = WorkflowTriggerService(db)
    created = service.evaluate_and_queue(ORG_ID, plan)

    assert len(created) == 1
    assert created[0].category == "restock_alert"
    assert "Mozzarella" in created[0].title


def test_one_critical_shortage_does_not_trigger(db):
    plan = _plan_with_shortages(("Mozzarella", "critical"))
    service = WorkflowTriggerService(db)
    assert service.evaluate_and_queue(ORG_ID, plan) == []


def test_warning_severity_shortages_do_not_count(db):
    plan = _plan_with_shortages(("Mozzarella", "warning"), ("Basil", "warning"))
    service = WorkflowTriggerService(db)
    assert service.evaluate_and_queue(ORG_ID, plan) == []


def test_repeated_run_does_not_duplicate_pending_restock_alert(db):
    plan = _plan_with_shortages(("Mozzarella", "critical"), ("Basil", "critical"))
    service = WorkflowTriggerService(db)
    service.evaluate_and_queue(ORG_ID, plan)
    second_run = service.evaluate_and_queue(ORG_ID, plan)
    assert second_run == []


# ── Trigger 2: busy + competitor deals ───────────────────────────────────────

def test_busy_plus_two_deals_creates_pricing_review(db):
    plan = _plan_with_market(tonight_busy=True, deals=["deal1", "deal2"])
    service = WorkflowTriggerService(db)
    created = service.evaluate_and_queue(ORG_ID, plan)

    assert len(created) == 1
    assert created[0].category == "pricing_promo_review"


def test_busy_plus_one_deal_does_not_trigger(db):
    plan = _plan_with_market(tonight_busy=True, deals=["deal1"])
    service = WorkflowTriggerService(db)
    assert service.evaluate_and_queue(ORG_ID, plan) == []


def test_two_deals_but_not_busy_does_not_trigger(db):
    plan = _plan_with_market(tonight_busy=False, deals=["deal1", "deal2"])
    service = WorkflowTriggerService(db)
    assert service.evaluate_and_queue(ORG_ID, plan) == []


def test_slot_deals_and_competitor_deals_both_count_toward_threshold(db):
    plan = _plan_with_market(tonight_busy=True, deals=["deal1"], slot_deals=["slot1"])
    service = WorkflowTriggerService(db)
    created = service.evaluate_and_queue(ORG_ID, plan)
    assert len(created) == 1


def test_repeated_run_does_not_duplicate_pending_pricing_review(db):
    plan = _plan_with_market(tonight_busy=True, deals=["deal1", "deal2"])
    service = WorkflowTriggerService(db)
    service.evaluate_and_queue(ORG_ID, plan)
    second_run = service.evaluate_and_queue(ORG_ID, plan)
    assert second_run == []


# ── Both triggers at once ────────────────────────────────────────────────────

def test_both_triggers_fire_independently(db):
    plan = {
        "recommendations": {
            "inventory": {"data": {"shortage_alerts": [
                {"ingredient": "Mozzarella", "severity": "critical"},
                {"ingredient": "Basil", "severity": "critical"},
            ]}}
        },
        "market_intel": {
            "tonight_busy": True,
            "dineout_deals_count": 2,
            "slot_deals_found": [],
        },
    }
    service = WorkflowTriggerService(db)
    created = service.evaluate_and_queue(ORG_ID, plan)
    categories = {a.category for a in created}
    assert categories == {"restock_alert", "pricing_promo_review"}
