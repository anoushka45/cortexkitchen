"""Unit tests for BusinessAnalyticsService -- the shared logic extracted from
business.py so both the Today dashboard and the planning pipeline compute
margin-aware dish ranking, complaint category counts, and peak hours
identically instead of the pipeline reasoning over a disconnected view.

Uses SQLite in-memory DB (MenuItem/Order/Feedback have no JSONB columns).
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.infrastructure.db.models import Feedback, MenuItem, Order, SentimentType
from app.domain.services.business_analytics_service import BusinessAnalyticsService


@pytest.fixture(scope="module")
def engine():
    eng = create_engine("sqlite:///:memory:")
    MenuItem.__table__.create(bind=eng)
    Order.__table__.create(bind=eng)
    Feedback.__table__.create(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session
        session.rollback()
        session.query(Feedback).delete()
        session.query(Order).delete()
        session.query(MenuItem).delete()
        session.commit()


def _menu_item(db, name, category, price, cost_price):
    item = MenuItem(name=name, category=category, price=price, cost_price=cost_price)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _order(db, item, quantity, total_price, days_ago=1, hour=19):
    when = datetime.utcnow() - timedelta(days=days_ago)
    when = when.replace(hour=hour, minute=0, second=0, microsecond=0)
    o = Order(menu_item_id=item.id, quantity=quantity, total_price=total_price, ordered_at=when)
    db.add(o)
    db.commit()


def _feedback(db, text, sentiment=SentimentType.negative, days_ago=1):
    fb = Feedback(raw_text=text, sentiment=sentiment, created_at=datetime.utcnow() - timedelta(days=days_ago))
    db.add(fb)
    db.commit()


# ── get_dish_performance ─────────────────────────────────────────────────────

def test_dish_performance_computes_margin_and_sorts_by_revenue(db):
    high = _menu_item(db, "Margherita", "pizza", price=300.0, cost_price=100.0)   # 66.7% margin
    low  = _menu_item(db, "Four Cheese", "pizza", price=300.0, cost_price=250.0)  # 16.7% margin
    _order(db, high, quantity=2, total_price=600.0, days_ago=1)
    _order(db, low, quantity=5, total_price=1500.0, days_ago=1)  # higher revenue, lower margin

    analytics = BusinessAnalyticsService(db)
    dishes = analytics.get_dish_performance(days=14)

    assert dishes[0]["name"] == "Four Cheese"  # sorted by revenue first
    assert dishes[0]["revenue"] == 1500.0
    assert dishes[0]["margin_pct"] == pytest.approx(16.7, abs=0.1)
    assert dishes[1]["name"] == "Margherita"
    assert dishes[1]["margin_pct"] == pytest.approx(66.7, abs=0.1)


def test_dish_performance_margin_none_when_cost_price_missing(db):
    item = _menu_item(db, "Mystery Dish", "sides", price=100.0, cost_price=None)
    _order(db, item, quantity=1, total_price=100.0, days_ago=1)

    analytics = BusinessAnalyticsService(db)
    dishes = analytics.get_dish_performance(days=14)
    assert dishes[0]["margin_pct"] is None


def test_dish_performance_excludes_orders_outside_window(db):
    item = _menu_item(db, "Old Dish", "sides", price=100.0, cost_price=50.0)
    _order(db, item, quantity=1, total_price=100.0, days_ago=30)

    analytics = BusinessAnalyticsService(db)
    dishes = analytics.get_dish_performance(days=14)
    assert dishes == []


# ── get_complaints_by_category ───────────────────────────────────────────────

def test_complaints_by_category_groups_by_keyword_and_sorts_by_count(db):
    _feedback(db, "We waited over 40 minutes for our order", days_ago=2)
    _feedback(db, "Service was slow tonight", days_ago=3)
    _feedback(db, "Pizza arrived cold", days_ago=1)
    _feedback(db, "Great food, loved it!", sentiment=SentimentType.positive, days_ago=1)

    analytics = BusinessAnalyticsService(db)
    result = analytics.get_complaints_by_category(days=28)

    assert result[0] == {"category": "Wait Time", "count": 2}
    assert {"category": "Food Quality", "count": 1} in result
    # positive feedback never counted
    assert sum(r["count"] for r in result) == 3


def test_complaints_by_category_excludes_outside_window(db):
    _feedback(db, "Waited forever", days_ago=40)
    analytics = BusinessAnalyticsService(db)
    assert analytics.get_complaints_by_category(days=28) == []


# ── get_peak_hours ───────────────────────────────────────────────────────────

def test_peak_hours_returns_24_entries_with_correct_averages(db):
    item = _menu_item(db, "Anything", "sides", price=100.0, cost_price=50.0)
    _order(db, item, quantity=1, total_price=100.0, days_ago=1, hour=19)
    _order(db, item, quantity=1, total_price=100.0, days_ago=2, hour=19)

    analytics = BusinessAnalyticsService(db)
    result = analytics.get_peak_hours(days=2)

    assert len(result) == 24
    hour_19 = next(h for h in result if h["hour"] == 19)
    assert hour_19["avg_orders"] == 1.0  # 2 orders / 2 days
    hour_10 = next(h for h in result if h["hour"] == 10)
    assert hour_10["avg_orders"] == 0.0
