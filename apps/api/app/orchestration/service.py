from __future__ import annotations

from datetime import datetime
from typing import Any

from app.orchestration.graph import build_orchestration_graph
from app.orchestration.state import OrchestrationState


class OrchestrationService:
    def __init__(
        self,
        reservation_service: Any,
        forecast_service: Any,
        complaint_service: Any,
        critic_service: Any,
    ):
        self.reservation_service = reservation_service
        self.forecast_service = forecast_service
        self.complaint_service = complaint_service
        self.critic_service = critic_service

        # build graph once
        self.graph = build_orchestration_graph(
            reservation_service=self.reservation_service,
            forecast_service=self.forecast_service,
            complaint_service=self.complaint_service,
            critic_service=self.critic_service,
        )

    async def run_friday_rush_planning(self, target_date: datetime):
        """
        Main entrypoint for Phase 1 orchestration.
        """

        initial_state: OrchestrationState = {
            "target_date": target_date,
            "scenario": "friday_rush_planning",
            "current_step": "init",
            "errors": [],
            "status": "pending",
        }

        result: OrchestrationState = await self.graph.ainvoke(initial_state)

        return result.get("final_output", {})