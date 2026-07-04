"""business.py — revenue, profit, and complaint analytics for the Today dashboard.

GET /api/v1/business/performance computes real business metrics directly from
Order (revenue/profit via MenuItem.cost_price) and Feedback (complaints grouped
by keyword-matched category). No planning run required -- this is always-on
situational awareness, independent of the agent pipeline.
"""

from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.infrastructure.db.models import Feedback, MenuItem, Order, SentimentType

router = APIRouter(prefix="/business", tags=["business"])


class DailyPoint(BaseModel):
    date: str
    revenue: float
    profit: float
    orders: int


class DaySnapshot(BaseModel):
    date: str
    revenue: float
    profit: float
    margin_pct: float | None = None
    orders: int
    avg_order_value: float


class DishPerformance(BaseModel):
    name: str
    category: str
    revenue: float
    quantity: int
    margin_pct: float | None = None


class ChannelSplit(BaseModel):
    dine_in_revenue: float = 0
    delivery_revenue: float = 0
    dine_in_orders: int = 0
    delivery_orders: int = 0


class ComplaintCategory(BaseModel):
    category: str
    count: int


class HourlyDemand(BaseModel):
    hour: int          # 0-23
    avg_orders: float   # average orders placed in this hour, across the trend window


class BusinessPerformanceResponse(BaseModel):
    period_days: int
    yesterday: DaySnapshot | None = None
    today_so_far: DaySnapshot | None = None
    trend: list[DailyPoint] = []
    top_dishes: list[DishPerformance] = []
    bottom_dishes: list[DishPerformance] = []
    channel_split: ChannelSplit = ChannelSplit()
    complaints_by_category: list[ComplaintCategory] = []
    peak_hours: list[HourlyDemand] = []


# Keyword buckets checked in order -- first match wins. Tuned against the
# actual seeded complaint text (see scripts/seed_demo_data.py) so real demo
# data lands in sensible categories, not all in "Other".
_COMPLAINT_CATEGORIES: list[tuple[str, list[str]]] = [
    ("Wait Time", ["wait", "waited", "waiting", "slow", "queue", "took over", "minutes", "took forever", "forever", "long"]),
    ("Food Quality", ["cold", "undersalted", "soggy", "little cheese", "redone", "thin for the price", "plain", "chaos"]),
    ("Stock & Availability", ["ran out", "out of", "unavailable", "stockout"]),
    ("Order Accuracy", ["without croutons", "wrong order", "missing", "forgot"]),
    ("Portion & Value", ["portion", "smaller", "expensive", "price"]),
    ("Ambience", ["noisy", "noise", "parking", "rushed", "overwhelmed"]),
]


def _categorize(text: str) -> str:
    lowered = text.lower()
    for category, keywords in _COMPLAINT_CATEGORIES:
        if any(kw in lowered for kw in keywords):
            return category
    return "Other"


@router.get("/performance", response_model=BusinessPerformanceResponse)
def get_business_performance(
    days: int = Query(default=14, ge=1, le=90),
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessPerformanceResponse:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    trend_start = today_start - timedelta(days=days - 1)

    # ── Daily revenue/profit trend ──────────────────────────────────────
    day_col = func.date(Order.ordered_at)
    rows = (
        db.query(
            day_col.label("day"),
            func.sum(Order.total_price).label("revenue"),
            func.sum(Order.quantity * func.coalesce(MenuItem.cost_price, 0)).label("cost"),
            func.count(Order.id).label("orders"),
        )
        .join(MenuItem, Order.menu_item_id == MenuItem.id)
        .filter(Order.ordered_at >= trend_start)
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )

    trend: list[DailyPoint] = []
    by_day: dict[str, dict] = {}
    for row in rows:
        day_str = row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day)
        revenue = float(row.revenue or 0)
        cost = float(row.cost or 0)
        profit = revenue - cost
        by_day[day_str] = {"revenue": revenue, "profit": profit, "orders": row.orders}
        trend.append(DailyPoint(date=day_str, revenue=round(revenue, 2), profit=round(profit, 2), orders=row.orders))

    def _snapshot(day_str: str) -> DaySnapshot | None:
        d = by_day.get(day_str)
        if not d or not d["orders"]:
            return None
        margin = (d["profit"] / d["revenue"] * 100) if d["revenue"] > 0 else None
        return DaySnapshot(
            date=day_str,
            revenue=round(d["revenue"], 2),
            profit=round(d["profit"], 2),
            margin_pct=round(margin, 1) if margin is not None else None,
            orders=d["orders"],
            avg_order_value=round(d["revenue"] / d["orders"], 2),
        )

    yesterday_snapshot = _snapshot(yesterday_start.date().isoformat())
    today_snapshot = _snapshot(today_start.date().isoformat())

    # ── Top / bottom dishes by revenue over the trend window ───────────
    dish_rows = (
        db.query(
            MenuItem.name, MenuItem.category, MenuItem.price, MenuItem.cost_price,
            func.sum(Order.total_price).label("revenue"),
            func.sum(Order.quantity).label("quantity"),
        )
        .join(Order, Order.menu_item_id == MenuItem.id)
        .filter(Order.ordered_at >= trend_start)
        .group_by(MenuItem.id, MenuItem.name, MenuItem.category, MenuItem.price, MenuItem.cost_price)
        .all()
    )

    dishes: list[DishPerformance] = []
    for row in dish_rows:
        margin = None
        if row.cost_price is not None and row.price:
            margin = round((row.price - row.cost_price) / row.price * 100, 1)
        dishes.append(DishPerformance(
            name=row.name, category=row.category,
            revenue=round(float(row.revenue or 0), 2), quantity=int(row.quantity or 0),
            margin_pct=margin,
        ))
    dishes.sort(key=lambda d: d.revenue, reverse=True)
    top_dishes = dishes[:5]
    bottom_dishes = list(reversed(dishes[-5:])) if len(dishes) > 5 else []

    # ── Channel split (yesterday) ───────────────────────────────────────
    channel_split = ChannelSplit()
    channel_rows = (
        db.query(Order.is_delivery, func.sum(Order.total_price), func.count(Order.id))
        .filter(Order.ordered_at >= yesterday_start, Order.ordered_at < today_start)
        .group_by(Order.is_delivery)
        .all()
    )
    for is_delivery, revenue, count in channel_rows:
        if is_delivery:
            channel_split.delivery_revenue = round(float(revenue or 0), 2)
            channel_split.delivery_orders = int(count or 0)
        else:
            channel_split.dine_in_revenue = round(float(revenue or 0), 2)
            channel_split.dine_in_orders = int(count or 0)

    # ── Peak hours — average orders per hour-of-day over the trend window ──
    # Orders only (not reservations): reservations include future-dated rows
    # from the seeded planning window, which would contaminate "when are we
    # actually busy" with bookings that haven't happened yet.
    hour_col = func.extract("hour", Order.ordered_at)
    hour_rows = (
        db.query(hour_col.label("hour"), func.count(Order.id).label("cnt"))
        .filter(Order.ordered_at >= trend_start)
        .group_by(hour_col)
        .all()
    )
    hour_counts = {int(h): cnt for h, cnt in hour_rows}
    peak_hours = [
        HourlyDemand(hour=h, avg_orders=round(hour_counts.get(h, 0) / days, 1))
        for h in range(24)
    ]

    # ── Complaints by category (last 28 days, negative sentiment) ──────
    complaint_window = now - timedelta(days=28)
    complaint_rows = (
        db.query(Feedback.raw_text)
        .filter(Feedback.sentiment == SentimentType.negative, Feedback.created_at >= complaint_window)
        .all()
    )
    counts: dict[str, int] = defaultdict(int)
    for (text,) in complaint_rows:
        counts[_categorize(text)] += 1
    complaints_by_category = [
        ComplaintCategory(category=cat, count=n)
        for cat, n in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    return BusinessPerformanceResponse(
        period_days=days,
        yesterday=yesterday_snapshot,
        today_so_far=today_snapshot,
        trend=trend,
        top_dishes=top_dishes,
        bottom_dishes=bottom_dishes,
        channel_split=channel_split,
        complaints_by_category=complaints_by_category,
        peak_hours=peak_hours,
    )
