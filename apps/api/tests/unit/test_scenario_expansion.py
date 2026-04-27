from datetime import datetime

import pytest

from app.domain.scenarios import get_scenario_definition, list_scenarios, resolve_default_target_date
from app.domain.services.reservation_service import ReservationService
from app.orchestration.graph import run_planning_scenario
from app.orchestration.nodes.ops_manager import ops_manager_node


def test_scenario_registry_lists_expected_presets():
    scenario_ids = {item["id"] for item in list_scenarios()}
    assert scenario_ids == {
        "friday_rush",
        "weekday_lunch",
        "holiday_spike",
        "low_stock_weekend",
    }


def test_default_target_resolution_varies_by_scenario():
    reference = datetime(2026, 4, 27)  # Monday

    assert resolve_default_target_date("friday_rush", now=reference) == "2026-05-01"
    assert resolve_default_target_date("weekday_lunch", now=reference) == "2026-04-29"
    assert resolve_default_target_date("holiday_spike", now=reference) == "2026-05-02"
    assert resolve_default_target_date("low_stock_weekend", now=reference) == "2026-05-03"


def test_ops_manager_attaches_scenario_profile():
    state = ops_manager_node(
        {
            "scenario": "weekday_lunch",
            "scenario_profile": None,
            "target_date": None,
            "requested_at": None,
            "simulation_mode": False,
            "force_critic_decision": None,
            "debug": False,
            "forecast_output": None,
            "reservation_output": None,
            "complaint_output": None,
            "menu_output": None,
            "inventory_output": None,
            "aggregated_recommendation": None,
            "critic_output": None,
            "final_response": None,
            "execution_trace": None,
            "error": None,
        }
    )

    assert state["error"] is None
    assert state["scenario_profile"]["label"] == "Weekday Lunch"
    assert state["target_date"] is not None


@pytest.mark.asyncio
async def test_run_planning_scenario_supports_non_friday_presets():
    deps = {"db": object(), "llm": object(), "memory": object()}

    result = await run_planning_scenario(
        deps=deps,
        scenario="weekday_lunch",
        target_date="2026-04-29",
        simulation_mode=True,
        force_critic_decision="approved",
    )

    assert result["scenario"] == "weekday_lunch"
    assert result["target_date"] == "2026-04-29"
    assert result["status"] == "ready"


def test_reservation_service_uses_scenario_service_window():
    service = ReservationService(db=None, llm=None)

    lunch_window = service._parse_service_window("12:00-15:00")
    spike_window = service._parse_service_window("17:00-22:00")

    assert lunch_window == (12, 15)
    assert spike_window == (17, 22)
