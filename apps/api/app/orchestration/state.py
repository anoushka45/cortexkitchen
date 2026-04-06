from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, TypedDict


FlowStatus = Literal["pending", "success", "failed"]


class OrchestrationState(TypedDict, total=False):
    # input
    target_date: datetime
    scenario: str

    # execution tracking
    current_step: str
    errors: list[str]

    # outputs from each node
    reservation_result: dict[str, Any]
    forecast_result: dict[str, Any]
    complaint_result: dict[str, Any]
    critic_result: dict[str, Any]

    # final combined response
    final_output: dict[str, Any]

    # metadata
    status: FlowStatus