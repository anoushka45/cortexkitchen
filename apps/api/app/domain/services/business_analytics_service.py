"""Shared analytics queries used by both GET /business/performance (the Today
dashboard) and the planning pipeline (menu_intelligence, complaint_intelligence,
reservation). Extracted so both consumers compute margin-aware dish ranking,
complaint category counts, and real peak-hours identically instead of the
pipeline reasoning over a completely disconnected view of the same data.
"""

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.infrastructure.db.models import Feedback, MenuItem, Order, SentimentType

# Keyword buckets checked in order -- first match wins. Tuned against the
# actual seeded complaint text (see scripts/seed_demo_data.py).
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


class BusinessAnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def get_dish_performance(self, days: int = 14) -> list[dict]:
        """Revenue, quantity, and margin_pct per dish over the trend window,
        sorted by revenue descending. margin_pct is None when cost_price isn't set."""
        trend_start = datetime.utcnow() - timedelta(days=days)
        rows = (
            self.db.query(
                MenuItem.name, MenuItem.category, MenuItem.price, MenuItem.cost_price,
                func.sum(Order.total_price).label("revenue"),
                func.sum(Order.quantity).label("quantity"),
            )
            .join(Order, Order.menu_item_id == MenuItem.id)
            .filter(Order.ordered_at >= trend_start)
            .group_by(MenuItem.id, MenuItem.name, MenuItem.category, MenuItem.price, MenuItem.cost_price)
            .all()
        )
        dishes = []
        for row in rows:
            margin = None
            if row.cost_price is not None and row.price:
                margin = round((row.price - row.cost_price) / row.price * 100, 1)
            dishes.append({
                "name": row.name, "category": row.category,
                "revenue": round(float(row.revenue or 0), 2), "quantity": int(row.quantity or 0),
                "margin_pct": margin,
            })
        dishes.sort(key=lambda d: d["revenue"], reverse=True)
        return dishes

    def get_complaints_by_category(self, days: int = 28) -> list[dict]:
        window = datetime.utcnow() - timedelta(days=days)
        rows = (
            self.db.query(Feedback.raw_text)
            .filter(Feedback.sentiment == SentimentType.negative, Feedback.created_at >= window)
            .all()
        )
        counts: dict[str, int] = defaultdict(int)
        for (text,) in rows:
            counts[_categorize(text)] += 1
        return [
            {"category": cat, "count": n}
            for cat, n in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
        ]

    def get_peak_hours(self, days: int = 14) -> list[dict]:
        """Average orders per hour-of-day over the trend window, from real order
        timestamps -- not the static configured service-hours string."""
        trend_start = datetime.utcnow() - timedelta(days=days)
        hour_col = func.extract("hour", Order.ordered_at)
        rows = (
            self.db.query(hour_col.label("hour"), func.count(Order.id).label("cnt"))
            .filter(Order.ordered_at >= trend_start)
            .group_by(hour_col)
            .all()
        )
        hour_counts = {int(h): cnt for h, cnt in rows}
        return [
            {"hour": h, "avg_orders": round(hour_counts.get(h, 0) / days, 1)}
            for h in range(24)
        ]
