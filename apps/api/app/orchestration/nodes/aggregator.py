"""
Aggregator node (Ops Manager second pass).

Collects all individual agent outputs from state and assembles
a single unified recommendation bundle for the Critic to evaluate.
No LLM call here — pure data assembly.
"""

from app.orchestration.state import OrchestratorState


def aggregator_node(state: OrchestratorState) -> OrchestratorState:
    """
    Assembles all agent outputs into one recommendation bundle.
    Skips agents that errored without failing the whole flow.
    Writes to state['aggregated_recommendation'].
    """
    if state.get("error"):
        return state

    def _extract(output: dict | None, key: str = "recommendation"):
        """Safely pull a field from an agent output dict."""
        if output is None:
            return None
        if "error" in output and output["error"]:
            return {"error": output["error"]}
        return output.get(key)

    bundle = {
        "scenario": state.get("scenario"),
        "scenario_profile": state.get("scenario_profile"),
        "target_date": state.get("target_date"),
        "assumptions": {
            "menu":         state.get("menu_assumptions"),
            "inventory":    state.get("inventory_assumptions"),
            "reservation":  state.get("reservation_assumptions"),
            "complaint":    state.get("complaint_assumptions"),
            "market_intel": state.get("market_intel_assumptions"),
        },
        "market_intel": state.get("market_intel_output"),
        "agents": {
            "forecast": {
                "data": _extract(state.get("forecast_output"), "data"),
                "recommendation": _extract(state.get("forecast_output")),
            },
            "reservation": {
                "data": _extract(state.get("reservation_output"), "data"),
                "recommendation": _extract(state.get("reservation_output")),
            },
            "complaint": {
                "data": _extract(state.get("complaint_output"), "data"),
                "recommendation": _extract(state.get("complaint_output")),
                "rag_context": state.get("complaint_output", {}).get("rag_context") if state.get("complaint_output") else None,
            },
            "menu": {
                "data": _extract(state.get("menu_output"), "data"),
                "recommendation": _extract(state.get("menu_output")),
            },
            "inventory": {
                "data": _extract(state.get("inventory_output"), "data"),
                "recommendation": _extract(state.get("inventory_output")),
            },
        },
        # Flat summary for the Critic prompt — easier than passing the full nested dict
        "summary_for_critic": _build_critic_summary(state),
        "contradictions_detected": bool(_detect_contradictions(state)),
    }

    return {**state, "aggregated_recommendation": bundle}


def _build_critic_summary(state: OrchestratorState) -> str:
    """
    Build a concise plain-text summary of all agent recommendations
    for the Critic Agent prompt. Omits errored/null agents gracefully.
    """
    scenario_profile = state.get("scenario_profile") or {}
    scenario_label = scenario_profile.get("label") or state.get("scenario")
    lines = [f"Scenario: {scenario_label} ({state.get('scenario')}) | Date: {state.get('target_date', 'next planning window')}"]
    if scenario_profile:
        lines.append(
            f"Operational focus: {scenario_profile.get('operational_focus')} | Service window: {scenario_profile.get('service_window')}"
        )
    lines.append("")

    org_capacity = state.get("org_capacity")

    # Demand Forecast — build from structured data to avoid LLM text echoing raw covers numbers
    forecast_out = state.get("forecast_output")
    if forecast_out is None:
        lines.append("[Demand Forecast] — did not run")
    elif forecast_out.get("error"):
        lines.append(f"[Demand Forecast] — error: {forecast_out['error']}")
    else:
        fdata = (forecast_out.get("data") or {})
        frec  = (forecast_out.get("recommendation") or {})
        predicted_ord = fdata.get("predicted_orders") or fdata.get("predicted_covers") or "N/A"
        peak_ord      = fdata.get("predicted_peak_orders") or "N/A"
        avg_ord       = fdata.get("avg_friday_orders") or fdata.get("avg_same_day_orders") or "N/A"
        staffing_note = frec.get("staffing_level") or frec.get("staffing") or ""
        cap_note = (
            f" Seating ceiling is {org_capacity} — staff for a full house, not the demand number."
            if org_capacity and predicted_ord != "N/A" and float(predicted_ord) > org_capacity
            else ""
        )
        lines.append(
            f"[Demand Forecast] Predicted orders: {predicted_ord} (avg matching day: {avg_ord}); "
            f"peak window orders: {peak_ord}."
            + (f" Staffing: {staffing_note}." if staffing_note else "")
            + cap_note
        )

    agent_map = {
        "Reservation": state.get("reservation_output"),
        "Complaint":   state.get("complaint_output"),
        "Menu":        state.get("menu_output"),
        "Inventory":   state.get("inventory_output"),
    }

    for label, output in agent_map.items():
        if output is None:
            lines.append(f"[{label}] — did not run")
            continue
        if output.get("error"):
            lines.append(f"[{label}] — error: {output['error']}")
            continue
        rec = output.get("recommendation", {})
        if isinstance(rec, dict):
            rec_text = (
                rec.get("recommendation")
                or rec.get("action")
                or rec.get("insight")
                or _summarize_recommendation_dict(label, rec)
            )
        else:
            rec_text = str(rec)
        lines.append(f"[{label}] {rec_text}")

    # Explicit full critical shortage list so the critic can evaluate Rule 9 compliance
    inv_data = (state.get("inventory_output") or {}).get("data") or {}
    critical_items = [
        a.get("ingredient")
        for a in (inv_data.get("shortage_alerts") or [])
        if isinstance(a, dict) and a.get("severity") == "critical" and a.get("ingredient")
    ]
    if critical_items:
        lines.append(
            f"\n⚠ RULE 9 — ALL {len(critical_items)} CRITICAL SHORTAGE INGREDIENT(S) MUST BE EXPLICITLY ACTIONED:\n"
            + "\n".join(f"  • {item}" for item in critical_items)
        )

    # Capacity hard constraint — enforce before the critic reads the summary.
    # NOTE: do not use words like "covers", "guests", "seats" next to the raw
    # demand number here — the sanity checker's regex scans this text too.
    if org_capacity:
        forecast_data = (state.get("forecast_output") or {}).get("data") or {}
        predicted = (
            forecast_data.get("predicted_covers")
            or forecast_data.get("predicted_orders")
            or 0
        )
        if predicted and int(predicted) > int(org_capacity):
            excess = int(predicted) - int(org_capacity)
            lines.append(
                f"\n⚠ HARD CAPACITY CONSTRAINT: org_capacity={org_capacity} seats. "
                f"Prophet demand output={int(predicted)} predicted orders "
                f"({excess} above the physical seating ceiling). "
                f"Plans must not frame this number as simultaneous diners. "
                f"Hard ceiling is {org_capacity} seated at once. "
                f"Excess demand ({excess}) must go to waitlist or staggered-seating only."
            )

    # Market intelligence (Swiggy) — appended when available
    market_intel = state.get("market_intel_output")
    if market_intel:
        mi_parts = []
        area_occ = market_intel.get("area_occupancy")
        if area_occ:
            busy_flag = " (tonight busy)" if market_intel.get("tonight_busy") else ""
            mi_parts.append(f"Area occupancy: {area_occ}{busy_flag}")
        alerts = market_intel.get("pricing_alerts") or []
        if alerts:
            mi_parts.append("Pricing alerts: " + "; ".join(alerts[:3]))
        proc_opts = market_intel.get("procurement_options") or []
        if proc_opts:
            mi_parts.append(f"{len(proc_opts)} Instamart procurement option(s) available")
        if mi_parts:
            lines.append("[Market Intel — Swiggy] " + " | ".join(mi_parts))

    # Append any auto-detected cross-agent contradictions (0 LLM calls)
    contradiction_text = _detect_contradictions(state)
    if contradiction_text:
        lines.append(contradiction_text)

    # Append critic feedback from a previous replan cycle, if any
    replan_context = state.get("replan_context")
    if replan_context:
        lines.append(f"\nCRITIC FEEDBACK FROM PREVIOUS EVALUATION:\n{replan_context}")

    return "\n".join(lines)


def _detect_contradictions(state: OrchestratorState) -> str:
    """
    Pure Python cross-agent contradiction detection — zero LLM calls.
    Detects: menu highlights vs inventory shortages, inventory blockers,
    high-demand-forecast + critical-shortage mismatch.
    Returns a formatted warning block (empty string if none found).
    """
    contradictions = []

    menu_rec = (state.get("menu_output") or {}).get("recommendation") or {}
    inv_blockers = menu_rec.get("inventory_blockers") or []
    if isinstance(inv_blockers, list):
        for blocker in inv_blockers:
            if blocker:
                contradictions.append(
                    f"Menu agent highlights items but flags inventory blocker: {blocker}"
                )

    inv_assumptions = state.get("inventory_assumptions") or {}
    items_flagged_low = inv_assumptions.get("items_flagged_low") or []
    highlight_items = menu_rec.get("highlight_items") or []
    if items_flagged_low and highlight_items:
        for low_item in items_flagged_low:
            low_name = str(low_item).lower()
            for highlight in highlight_items:
                h_name = str(highlight).lower()
                if low_name and (low_name in h_name or h_name in low_name):
                    contradictions.append(
                        f"Menu recommends pushing '{highlight}' but inventory flags "
                        f"'{low_item}' as LOW STOCK — fulfillment risk."
                    )

    inv_data = (state.get("inventory_output") or {}).get("data") or {}
    critical_shortages = [
        a.get("ingredient") for a in (inv_data.get("shortage_alerts") or [])
        if isinstance(a, dict) and a.get("severity") == "critical" and a.get("ingredient")
    ]
    forecast_data = (state.get("forecast_output") or {}).get("data") or {}
    demand_ratio = forecast_data.get("demand_ratio") or 0
    if critical_shortages and demand_ratio > 1.1:
        for item in critical_shortages:
            contradictions.append(
                f"Demand forecast predicts {round(float(demand_ratio), 1)}x normal volume but "
                f"'{item}' has a CRITICAL stock shortage — peak service at risk."
            )

    if not contradictions:
        return ""

    lines = [
        "",
        "DETECTED CONTRADICTIONS (auto-detected, 0 LLM calls):",
        "─────────────────────────────────────────────────────",
    ]
    for c in contradictions:
        lines.append(f"  ⚠  {c}")
    lines.append("─────────────────────────────────────────────────────")
    lines.append("The Critic MUST explicitly address these contradictions in the verdict.")
    return "\n".join(lines)


def _summarize_recommendation_dict(label: str, recommendation: dict) -> str:
    """Create a critic-friendly summary instead of dumping raw dicts."""
    if label == "Inventory":
        restock_actions = recommendation.get("restock_actions") or []
        waste_actions = recommendation.get("waste_reduction_actions") or []
        parts = []
        if restock_actions:
            # Include ALL restock actions — critic needs every item to evaluate Rule 9
            parts.append("Restock actions:\n" + "\n".join(f"  - {a}" for a in restock_actions))
        if waste_actions:
            parts.append(f"Waste reduction: {', '.join(waste_actions[:3])}")
        if recommendation.get("reasoning"):
            parts.append(str(recommendation["reasoning"]))
        return "\n".join(parts) if parts else "No concrete inventory actions provided."

    if label == "Complaint":
        issues = recommendation.get("issues") or []
        action_items = recommendation.get("action_items") or []
        parts = []
        if issues:
            top_issues = [str(issue.get("issue")) for issue in issues[:2] if isinstance(issue, dict) and issue.get("issue")]
            if top_issues:
                parts.append(f"Top issues: {', '.join(top_issues)}")
        if action_items:
            parts.append(f"Actions: {', '.join(map(str, action_items[:2]))}")
        if recommendation.get("overall_summary"):
            parts.append(str(recommendation["overall_summary"]))
        return " | ".join(parts) if parts else "No concrete complaint actions provided."

    if label == "Menu":
        promo_candidates = recommendation.get("promo_candidates") or []
        highlight_items = recommendation.get("highlight_items") or []
        deprioritize_items = recommendation.get("deprioritize_items") or []
        parts = []
        if highlight_items:
            parts.append(f"Highlight: {', '.join(map(str, highlight_items[:2]))}")
        if deprioritize_items:
            parts.append(f"Avoid pushing: {', '.join(map(str, deprioritize_items[:2]))}")
        if promo_candidates:
            parts.append(f"Promo candidates: {', '.join(map(str, promo_candidates[:2]))}")
        if recommendation.get("reasoning"):
            parts.append(str(recommendation["reasoning"]))
        return " | ".join(parts) if parts else "No concrete menu actions provided."

    return str(recommendation)
