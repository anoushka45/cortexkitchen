import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SanityIssue:
    code: str
    severity: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
        }


class EvaluationSanityChecker:
    """Deterministic checks that complement the LLM critic."""

    MAX_CAPACITY = 70
    MAX_ADDITIONAL_STAFF = 20
    MAX_PRICE_CHANGE_PCT = 30
    SHORT_TERM_WORDS = {
        "24 hour",
        "24-hour",
        "today",
        "tonight",
        "by friday",
        "before friday",
        "by 5pm",
        "by 6pm",
        "same day",
        "immediate",
        "immediately",
        "shift",
    }
    LONG_TERM_WORDS = {
        "next month",
        "monthly",
        "quarter",
        "renovate",
        "renovation",
        "hire permanent",
        "supplier contract",
        "menu redesign",
        "brand campaign",
    }

    def check_bundle(self, bundle: dict[str, Any]) -> dict[str, Any]:
        issues: list[SanityIssue] = []
        issues.extend(self._check_top_level_schema(bundle))

        agents = bundle.get("agents")
        if isinstance(agents, dict):
            issues.extend(self._check_agent_schema(agents))
            issues.extend(self._check_capacity_and_staffing(bundle))
            issues.extend(self._check_inventory_quantities(agents.get("inventory") or {}))
            issues.extend(self._check_24h_feasibility(agents))

        return {
            "passed": not any(issue.severity == "error" for issue in issues),
            "issues": [issue.as_dict() for issue in issues],
            "summary": self._summarize(issues),
        }

    def format_report(self, report: dict[str, Any]) -> str:
        if not report.get("issues"):
            return "Automated sanity checks passed with no issues."

        lines = ["Automated sanity checks found:"]
        for issue in report["issues"]:
            lines.append(
                f"- [{issue['severity']}] {issue['code']}: {issue['message']}"
            )
        return "\n".join(lines)

    def _check_top_level_schema(self, bundle: dict[str, Any]) -> list[SanityIssue]:
        issues = []
        if not isinstance(bundle, dict):
            return [
                SanityIssue(
                    "schema.bundle_type",
                    "error",
                    "Aggregated recommendation must be a JSON object.",
                )
            ]

        for key in ("scenario", "target_date", "agents", "summary_for_critic"):
            if key not in bundle:
                issues.append(
                    SanityIssue("schema.missing_key", "error", f"Missing '{key}'.")
                )

        if "agents" in bundle and not isinstance(bundle["agents"], dict):
            issues.append(
                SanityIssue("schema.agents_type", "error", "'agents' must be an object.")
            )
        return issues

    def _check_agent_schema(self, agents: dict[str, Any]) -> list[SanityIssue]:
        issues = []
        for name in ("forecast", "reservation", "complaint", "menu", "inventory"):
            agent = agents.get(name)
            if agent is None:
                issues.append(
                    SanityIssue(
                        "schema.missing_agent",
                        "warning",
                        f"Missing '{name}' agent block.",
                    )
                )
                continue
            if not isinstance(agent, dict):
                issues.append(
                    SanityIssue(
                        "schema.agent_type",
                        "error",
                        f"Agent block '{name}' must be an object.",
                    )
                )
                continue
            for key in ("data", "recommendation"):
                if key not in agent:
                    issues.append(
                        SanityIssue(
                            "schema.missing_agent_key",
                            "warning",
                            f"Agent '{name}' is missing '{key}'.",
                        )
                    )
        return issues

    def _check_capacity_and_staffing(self, bundle: dict[str, Any]) -> list[SanityIssue]:
        issues = []
        text = self._flatten_text(bundle)

        if re.search(r"\b(close|shut)\s+(the\s+)?restaurant\b", text, re.I):
            issues.append(
                SanityIssue(
                    "policy.close_restaurant",
                    "error",
                    "Recommendation suggests closing the restaurant.",
                )
            )

        if re.search(r"\bcancell?ing?\s+all\s+reservations\b", text, re.I):
            issues.append(
                SanityIssue(
                    "policy.cancel_all_reservations",
                    "error",
                    "Recommendation suggests cancelling all reservations.",
                )
            )

        for match in re.finditer(r"\b(?:add|hire|schedule)\s+(\d+)\s+(?:additional\s+)?staff\b", text, re.I):
            staff_count = int(match.group(1))
            if staff_count > self.MAX_ADDITIONAL_STAFF:
                issues.append(
                    SanityIssue(
                        "policy.staffing_limit",
                        "error",
                        f"Additional staffing request of {staff_count} exceeds limit of {self.MAX_ADDITIONAL_STAFF}.",
                    )
                )

        for match in re.finditer(r"\b(\d+)\s+(?:guests|covers|seats)\b", text, re.I):
            capacity = int(match.group(1))
            if capacity > self.MAX_CAPACITY and re.search(
                r"\b(capacity|seat|reservation|booking|guests|covers)\b",
                text[max(0, match.start() - 50): match.end() + 50],
                re.I,
            ):
                issues.append(
                    SanityIssue(
                        "policy.capacity_limit",
                        "error",
                        f"Capacity-related number {capacity} exceeds restaurant capacity of {self.MAX_CAPACITY}.",
                    )
                )

        for match in re.finditer(r"\b(\d+)%\s+(?:price\s+)?(?:increase|decrease|discount|cut)\b", text, re.I):
            pct = int(match.group(1))
            if pct > self.MAX_PRICE_CHANGE_PCT:
                issues.append(
                    SanityIssue(
                        "policy.price_change_limit",
                        "error",
                        f"Price change of {pct}% exceeds policy limit of {self.MAX_PRICE_CHANGE_PCT}%.",
                    )
                )

        return issues

    def _check_inventory_quantities(self, inventory_agent: dict[str, Any]) -> list[SanityIssue]:
        issues = []
        data = inventory_agent.get("data") or {}
        recommendation = inventory_agent.get("recommendation") or {}
        recommendation_text = self._flatten_text(recommendation)

        if not isinstance(data, dict):
            return issues

        for alert in data.get("shortage_alerts") or []:
            if not isinstance(alert, dict):
                continue
            ingredient = str(alert.get("ingredient", "")).strip()
            if not ingredient:
                continue

            current_stock = self._to_float(alert.get("quantity_in_stock"))
            shortfall = self._to_float(alert.get("shortfall"))
            max_actionable = self._to_float(alert.get("max_actionable_restock_qty"))
            if max_actionable is None and current_stock is not None and shortfall is not None:
                max_actionable = max(shortfall, current_stock * 3)

            if max_actionable is None:
                continue

            for qty in self._quantities_near_ingredient(recommendation_text, ingredient):
                if qty > max_actionable:
                    issues.append(
                        SanityIssue(
                            "inventory.quantity_realism",
                            "error",
                            f"{ingredient} restock quantity {qty:g} exceeds max actionable {max_actionable:g}.",
                        )
                    )

        return issues

    def _check_24h_feasibility(self, agents: dict[str, Any]) -> list[SanityIssue]:
        issues = []
        text = self._flatten_text({name: agent.get("recommendation") for name, agent in agents.items() if isinstance(agent, dict)})
        lower = text.lower()

        for phrase in self.LONG_TERM_WORDS:
            if phrase in lower:
                issues.append(
                    SanityIssue(
                        "feasibility.long_term_action",
                        "error",
                        f"Recommendation includes long-term action '{phrase}' that is not feasible within 24 hours.",
                    )
                )

        inventory_text = self._flatten_text(
            (agents.get("inventory") or {}).get("recommendation") or {}
        ).lower()
        if inventory_text and any(word in inventory_text for word in ("order", "restock", "reorder")):
            if not any(word in inventory_text for word in self.SHORT_TERM_WORDS):
                issues.append(
                    SanityIssue(
                        "feasibility.inventory_timing",
                        "warning",
                        "Inventory action does not clearly state a 24-hour or pre-Friday timing.",
                    )
                )

        return issues

    def _quantities_near_ingredient(self, text: str, ingredient: str) -> list[float]:
        quantities = []
        ingredient_pattern = re.escape(ingredient)
        for line in text.splitlines():
            if not re.search(ingredient_pattern, line, re.I):
                continue
            for qty_match in re.finditer(
                r"\b(\d+(?:\.\d+)?)\s*(?:kg|kilograms?|litres?|liters?|units?|cans?)\b",
                line,
                re.I,
            ):
                quantities.append(float(qty_match.group(1)))
        return quantities

    def _flatten_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            return "\n".join(self._flatten_text(v) for v in value.values())
        if isinstance(value, list):
            return "\n".join(self._flatten_text(v) for v in value)
        return str(value)

    def _to_float(self, value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _summarize(self, issues: list[SanityIssue]) -> str:
        errors = sum(1 for issue in issues if issue.severity == "error")
        warnings = sum(1 for issue in issues if issue.severity == "warning")
        if errors or warnings:
            return f"{errors} error(s), {warnings} warning(s)"
        return "0 errors, 0 warnings"
