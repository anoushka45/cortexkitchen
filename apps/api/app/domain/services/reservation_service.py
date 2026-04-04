from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.infrastructure.db.models import Reservation, ReservationStatus
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class ReservationService:
    """Analyses reservation data and identifies capacity risks."""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    def get_friday_reservations(self, target_date: datetime) -> dict:
        """Get all reservations for a specific Friday and analyse capacity."""

        start = target_date.replace(hour=0, minute=0, second=0)
        end = target_date.replace(hour=23, minute=59, second=59)

        reservations = self.db.query(Reservation).filter(
            Reservation.reserved_at >= start,
            Reservation.reserved_at <= end,
            Reservation.status.in_([
                ReservationStatus.confirmed,
                ReservationStatus.waitlist
            ])
        ).all()

        total_guests = sum(r.guest_count for r in reservations)
        peak_hours = {}
        for r in reservations:
            hour = r.reserved_at.hour
            peak_hours[hour] = peak_hours.get(hour, 0) + r.guest_count

        busiest_hour = max(peak_hours, key=peak_hours.get) if peak_hours else None

        return {
            "date": target_date.strftime("%Y-%m-%d"),
            "total_reservations": len(reservations),
            "total_guests": total_guests,
            "capacity": 70,
            "occupancy_pct": round((total_guests / 70) * 100, 1),
            "overbooking_risk": total_guests > 63,  # 90% threshold
            "busiest_hour": busiest_hour,
            "peak_hours": peak_hours,
            "waitlist_count": sum(1 for r in reservations if r.status == ReservationStatus.waitlist),
        }

    async def analyse_and_recommend(self, target_date: datetime) -> dict:
        """Use Gemini to analyse reservation data and generate recommendation."""

        data = self.get_friday_reservations(target_date)

        prompt = PromptUtils.format_recommendation_prompt(
            context=f"""
Reservation data for {data['date']}:
- Total reservations: {data['total_reservations']}
- Total guests booked: {data['total_guests']}
- Restaurant capacity: {data['capacity']} guests
- Current occupancy: {data['occupancy_pct']}%
- Overbooking risk: {data['overbooking_risk']}
- Busiest hour: {data['busiest_hour']}:00
- Guests on waitlist: {data['waitlist_count']}
""",
            task="Analyse this reservation data and recommend specific actions to manage capacity effectively for this Friday evening."
        )

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_RESERVATION_AGENT
        )

        return {
            "service": "reservation",
            "data": data,
            "recommendation": recommendation
        }