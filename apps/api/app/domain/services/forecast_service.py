from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.infrastructure.db.models import Order
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class ForecastService:
    """Analyses historical order data to forecast Friday demand."""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    def get_friday_order_history(self) -> list[dict]:
        """Get order counts for the last 4 Fridays."""
        results = []
        today = datetime.now()

        for weeks_ago in range(1, 5):
            friday = today - timedelta(weeks=weeks_ago)
            # Roll back to Friday
            while friday.weekday() != 4:
                friday -= timedelta(days=1)

            start = friday.replace(hour=0, minute=0, second=0)
            end = friday.replace(hour=23, minute=59, second=59)

            count = self.db.query(func.count(Order.id)).filter(
                Order.ordered_at >= start,
                Order.ordered_at <= end
            ).scalar()

            peak_count = self.db.query(func.count(Order.id)).filter(
                Order.ordered_at >= friday.replace(hour=18, minute=0, second=0),
                Order.ordered_at <= friday.replace(hour=22, minute=59, second=59)
            ).scalar()

            results.append({
                "date": friday.strftime("%Y-%m-%d"),
                "total_orders": count,
                "peak_orders_6pm_to_11pm": peak_count,
            })

        return results

    def get_top_friday_items(self) -> list[dict]:
        """Get the most ordered menu items on Fridays."""
        from app.infrastructure.db.models import MenuItem

        today = datetime.now()
        friday_dates = []

        for weeks_ago in range(1, 5):
            friday = today - timedelta(weeks=weeks_ago)
            while friday.weekday() != 4:
                friday -= timedelta(days=1)
            friday_dates.append(friday)

        item_counts = {}
        for friday in friday_dates:
            start = friday.replace(hour=0, minute=0, second=0)
            end = friday.replace(hour=23, minute=59, second=59)

            orders = self.db.query(Order).filter(
                Order.ordered_at >= start,
                Order.ordered_at <= end
            ).all()

            for order in orders:
                item_counts[order.menu_item_id] = item_counts.get(order.menu_item_id, 0) + order.quantity

        # Get top 5 items
        top_ids = sorted(item_counts, key=item_counts.get, reverse=True)[:5]
        top_items = []
        for item_id in top_ids:
            item = self.db.query(MenuItem).filter(MenuItem.id == item_id).first()
            if item:
                top_items.append({
                    "item": item.name,
                    "category": item.category,
                    "total_ordered": item_counts[item_id]
                })

        return top_items

    def calculate_forecast(self) -> dict:
        """Calculate predicted demand for next Friday."""
        history = self.get_friday_order_history()
        if not history:
            return {"predicted_orders": 0, "confidence": "low"}

        avg_orders = sum(h["total_orders"] for h in history) / len(history)
        avg_peak = sum(h["peak_orders_6pm_to_11pm"] for h in history) / len(history)

        return {
            "history": history,
            "avg_friday_orders": round(avg_orders, 1),
            "avg_peak_orders": round(avg_peak, 1),
            "predicted_orders": round(avg_orders * 1.05, 1),  # 5% growth assumption
            "predicted_peak_orders": round(avg_peak * 1.05, 1),
            "top_items": self.get_top_friday_items(),
        }

    async def analyse_and_recommend(self) -> dict:
        """Use Gemini to analyse forecast data and generate recommendation."""

        forecast = self.calculate_forecast()

        prompt = PromptUtils.format_recommendation_prompt(
            context=f"""
Friday demand forecast:
- Average orders over last 4 Fridays: {forecast['avg_friday_orders']}
- Average peak orders (6pm-11pm): {forecast['avg_peak_orders']}
- Predicted orders this Friday: {forecast['predicted_orders']}
- Predicted peak orders: {forecast['predicted_peak_orders']}
- Top ordered items on Fridays: {forecast['top_items']}
""",
            task="Based on this demand forecast, recommend specific staffing and preparation actions for this Friday."
        )

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_DEMAND_FORECAST_AGENT
        )

        return {
            "service": "forecast",
            "data": forecast,
            "recommendation": recommendation
        }