"""
Ops Manager Agent node.

Responsibilities:
- Validate incoming scenario type
- Set up any missing state defaults
- Attach reusable scenario profile metadata
- (Future) decide which agents should run based on scenario config

This node runs first in every graph execution.
"""

from app.orchestration.state import OrchestratorState
from app.domain.scenarios import SCENARIO_DEFINITIONS, get_scenario_definition, resolve_default_target_date


SUPPORTED_SCENARIOS = set(SCENARIO_DEFINITIONS.keys())


def ops_manager_node(state: OrchestratorState) -> OrchestratorState:
    """
    Entry node — validates scenario and prepares orchestration state.
    Does not call the LLM directly; it coordinates other agents.
    """
    scenario = state.get("scenario", "")

    if scenario not in SUPPORTED_SCENARIOS:
        return {
            **state,
            "error": f"Unknown scenario '{scenario}'. Supported: {SUPPORTED_SCENARIOS}",
        }

    scenario_profile = get_scenario_definition(scenario)

    # Stub: In Phase 2+ this node could dynamically decide which agents to skip
    # based on scenario config, feature flags, or cached results.
    return {
        **state,
        "scenario_profile": scenario_profile,
        "target_date": state.get("target_date") or resolve_default_target_date(scenario),
        "error": None,  # Ensure error is cleared for a valid scenario
    }
