from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import pandas as pd
from prophet import Prophet

from app.infrastructure.db.models import Order
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils
from app.infrastructure.forecasting.prophet_forecaster import ProphetForecaster



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

    def get_daily_order_history(self, days_back: int = 90) -> pd.DataFrame:
        """Get daily order counts for time series forecasting."""
        results = []
        today = datetime.now()

        for day_offset in range(days_back, 0, -1):
            current_date = today - timedelta(days=day_offset)
            start = current_date.replace(hour=0, minute=0, second=0)
            end = current_date.replace(hour=23, minute=59, second=59)

            # Total orders for the day
            total_count = self.db.query(func.count(Order.id)).filter(
                Order.ordered_at >= start,
                Order.ordered_at <= end
            ).scalar()

            # Peak orders (6pm-11pm)
            peak_count = self.db.query(func.count(Order.id)).filter(
                Order.ordered_at >= current_date.replace(hour=18, minute=0, second=0),
                Order.ordered_at <= current_date.replace(hour=22, minute=59, second=59)
            ).scalar()

            results.append({
                "ds": current_date.date(),  # Prophet expects 'ds' column for dates
                "y": total_count,  # Prophet expects 'y' column for values
                "peak_orders": peak_count,
                "is_friday": current_date.weekday() == 4
            })

        return pd.DataFrame(results)

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

    def calculate_baseline_forecast(self, target_date: datetime | None = None) -> dict:
        """Calculate predicted demand for target Friday using baseline method."""
        history = self.get_friday_order_history()
        if not history:
            return {"predicted_orders": 0, "confidence": "low"}

        avg_orders = sum(h["total_orders"] for h in history) / len(history)
        avg_peak = sum(h["peak_orders_6pm_to_11pm"] for h in history) / len(history)

        target_friday = self._get_target_friday(target_date)

        return {
            "history": history,
            "avg_friday_orders": round(avg_orders, 1),
            "avg_peak_orders": round(avg_peak, 1),
            "predicted_orders": round(avg_orders * 1.05, 1),  # 5% growth assumption
            "predicted_peak_orders": round(avg_peak * 1.05, 1),
            "top_items": self.get_top_friday_items(),
            "method": "baseline",
            "target_date": target_friday.strftime("%Y-%m-%d")
        }



    def calculate_prophet_forecast(self, target_date: datetime | None = None) -> dict:
        """Calculate predicted demand for target Friday using Prophet."""
        try:
            df = self.get_daily_order_history(days_back=90)

            target_friday = self._get_target_friday(target_date)
            forecaster = ProphetForecaster()
            prediction = forecaster.fit_and_predict(df, target_friday)

            # Historical Friday context for the response
            friday_history = self.get_friday_order_history()
            avg_friday_orders = (
                sum(h["total_orders"] for h in friday_history) / len(friday_history)
                if friday_history else 0
            )
            avg_peak_orders = (
                sum(h["peak_orders_6pm_to_11pm"] for h in friday_history) / len(friday_history)
                if friday_history else 0
            )

            predicted_peak_orders = round(
                prediction["yhat"] * prediction["peak_ratio_used"], 1
            )

            return {
                "history": friday_history,
                "avg_friday_orders": round(avg_friday_orders, 1),
                "avg_peak_orders": round(avg_peak_orders, 1),
                "predicted_orders": round(prediction["yhat"], 1),
                "predicted_orders_lower": round(prediction["yhat_lower"], 1),
                "predicted_orders_upper": round(prediction["yhat_upper"], 1),
                "predicted_peak_orders": predicted_peak_orders,
                "top_items": self.get_top_friday_items(),
                "method": "prophet",
                "confidence": "high" if len(df) >= 60 else "medium",
                "target_date": target_friday.strftime("%Y-%m-%d"),
            }

        except Exception as e:
            print(f"Prophet forecasting failed: {e}, falling back to baseline")
            return self.calculate_baseline_forecast(target_date)





    def _get_next_friday(self) -> datetime:
        """Get the date of next Friday."""
        today = datetime.now()
        days_ahead = (4 - today.weekday()) % 7
        if days_ahead == 0:  # Today is Friday, get next Friday
            days_ahead = 7
        return today + timedelta(days=days_ahead)

    def _get_target_friday(self, target_date: datetime | None = None) -> datetime:
        """Get the target Friday date, or next Friday if not specified."""
        if target_date:
            # Ensure it's a Friday
            if target_date.weekday() != 4:
                # Find the next Friday from the target date
                days_ahead = (4 - target_date.weekday()) % 7
                if days_ahead == 0:  # Target date is Friday
                    return target_date
                return target_date + timedelta(days=days_ahead)
            return target_date
        return self._get_next_friday()

    def calculate_forecast(self, target_date: datetime | None = None) -> dict:
        """Calculate predicted demand for target Friday using Prophet (with baseline fallback)."""
        return self.calculate_prophet_forecast(target_date)

    async def analyse_and_recommend(self, target_date: datetime | None = None) -> dict:
        """Use Gemini to analyse forecast data and generate recommendation."""

        forecast = self.calculate_forecast(target_date)

        prompt = PromptUtils.format_recommendation_prompt(
            context=f"""
Friday demand forecast (using {forecast.get('method', 'baseline')} method):
- Average orders over last 4 Fridays: {forecast['avg_friday_orders']}
- Average peak orders (6pm-11pm): {forecast['avg_peak_orders']}
- Predicted orders this Friday: {forecast['predicted_orders']}
{f"- Prediction range: {forecast.get('predicted_orders_lower', 'N/A')} - {forecast.get('predicted_orders_upper', 'N/A')}" if forecast.get('predicted_orders_lower') else ""}
- Predicted peak orders: {forecast['predicted_peak_orders']}
- Forecast confidence: {forecast.get('confidence', 'medium')}
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