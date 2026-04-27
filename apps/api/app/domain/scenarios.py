from datetime import datetime, timedelta, timezone
from typing import TypedDict


class ScenarioDefinition(TypedDict):
    id: str
    label: str
    description: str
    default_weekday: int
    service_window: str
    operational_focus: str


SCENARIO_DEFINITIONS: dict[str, ScenarioDefinition] = {
    "friday_rush": {
        "id": "friday_rush",
        "label": "Friday Rush",
        "description": "High-demand dinner service with reservation pressure, inventory risk, and fast-turn execution needs.",
        "default_weekday": 4,
        "service_window": "18:00-22:00",
        "operational_focus": "Peak dinner demand, table turns, rush execution, and same-day stock protection.",
    },
    "weekday_lunch": {
        "id": "weekday_lunch",
        "label": "Weekday Lunch",
        "description": "Midday service balancing predictable demand, staffing efficiency, and lighter prep plans.",
        "default_weekday": 2,
        "service_window": "12:00-15:00",
        "operational_focus": "Lunch pacing, lean staffing, prep efficiency, and delivery/takeaway smoothness.",
    },
    "holiday_spike": {
        "id": "holiday_spike",
        "label": "Holiday Spike",
        "description": "Exceptionally heavy service window where demand, waitlists, and fulfillment pressure may spike above normal baselines.",
        "default_weekday": 5,
        "service_window": "17:00-22:00",
        "operational_focus": "Demand surge readiness, queue protection, aggressive stock planning, and quality retention under pressure.",
    },
    "low_stock_weekend": {
        "id": "low_stock_weekend",
        "label": "Low-Stock Weekend",
        "description": "Weekend service planning under tighter ingredient constraints and stricter prioritization of feasible actions.",
        "default_weekday": 6,
        "service_window": "18:00-22:00",
        "operational_focus": "Critical-shortage prioritization, menu restraint, waste avoidance, and service continuity.",
    },
}


def get_scenario_definition(scenario: str) -> ScenarioDefinition | None:
    return SCENARIO_DEFINITIONS.get(scenario)


def list_scenarios() -> list[ScenarioDefinition]:
    return list(SCENARIO_DEFINITIONS.values())


def resolve_default_target_date(scenario: str, now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    definition = get_scenario_definition(scenario) or SCENARIO_DEFINITIONS["friday_rush"]
    days_ahead = (definition["default_weekday"] - current.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    target = current + timedelta(days=days_ahead)
    return target.strftime("%Y-%m-%d")
