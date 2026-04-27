from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.domain.scenarios import ScenarioDefinition
from app.infrastructure.db.models import Reservation, ReservationStatus
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class ReservationService:
    """Analyses reservation data and identifies capacity risks."""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    def get_friday_reservations(self, target_date: datetime) -> dict:
        """Backward-compatible wrapper for older Friday-specific callers/tests."""
        return self.get_service_reservations(target_date)

    def get_service_reservations(
        self,
        target_date: datetime,
        scenario_profile: ScenarioDefinition | None = None,
    ) -> dict:
        """Get reservations for the relevant target service window and analyse capacity."""
        window_start_hour, window_end_hour = self._parse_service_window(
            scenario_profile["service_window"] if scenario_profile else None
        )
        start = target_date.replace(
            hour=window_start_hour,
            minute=0,
            second=0,
            microsecond=0,
        )
        end = target_date.replace(
            hour=window_end_hour,
            minute=59,
            second=59,
            microsecond=0,
        )

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
        scenario_label = (
            scenario_profile["label"] if scenario_profile else target_date.strftime("%A")
        )
        service_window = (
            scenario_profile["service_window"] if scenario_profile else "18:00-22:00"
        )

        return {
            "date": target_date.strftime("%Y-%m-%d"),
            "scenario_label": scenario_label,
            "service_window": service_window,
            "total_reservations": len(reservations),
            "total_guests": total_guests,
            "capacity": 70,
            "occupancy_pct": round((total_guests / 70) * 100, 1),
            "overbooking_risk": total_guests > 63,  # 90% threshold
            "busiest_hour": busiest_hour,
            "peak_hours": peak_hours,
            "waitlist_count": sum(1 for r in reservations if r.status == ReservationStatus.waitlist),
        }

    async def analyse_and_recommend(
        self,
        target_date: datetime,
        scenario_profile: ScenarioDefinition | None = None,
    ) -> dict:
        """Use Gemini to analyse reservation data and generate recommendation."""

        data = self.get_service_reservations(target_date, scenario_profile=scenario_profile)

        prompt = PromptUtils.format_recommendation_prompt(
            context=f"""
Reservation data for {data['scenario_label']} on {data['date']}:
- Service window: {data['service_window']}
- Total reservations: {data['total_reservations']}
- Total guests booked: {data['total_guests']}
- Restaurant capacity: {data['capacity']} guests
- Current occupancy: {data['occupancy_pct']}%
- Overbooking risk: {data['overbooking_risk']}
- Busiest hour: {data['busiest_hour']}:00
- Guests on waitlist: {data['waitlist_count']}
""",
            task="Analyse this reservation data and recommend specific actions to manage capacity effectively for this target service window."
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

    def _parse_service_window(self, service_window: str | None) -> tuple[int, int]:
        if not service_window:
            return 18, 22
        start, end = service_window.split("-")
        return int(start.split(":")[0]), int(end.split(":")[0])
