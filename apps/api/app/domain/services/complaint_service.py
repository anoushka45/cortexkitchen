from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.domain.scenarios import ScenarioDefinition
from app.infrastructure.db.models import Feedback, SentimentType
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class ComplaintService:
    """Analyses customer feedback and identifies recurring complaint patterns."""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    def get_recent_feedback(self, days: int = 28) -> dict:
        """Get feedback summary for the last N days."""

        since = datetime.now() - timedelta(days=days)

        all_feedback = self.db.query(Feedback).filter(
            Feedback.created_at >= since
        ).all()

        negative = [f for f in all_feedback if f.sentiment == SentimentType.negative]
        positive = [f for f in all_feedback if f.sentiment == SentimentType.positive]
        neutral  = [f for f in all_feedback if f.sentiment == SentimentType.neutral]

        return {
            "total_feedback": len(all_feedback),
            "negative_count": len(negative),
            "positive_count": len(positive),
            "neutral_count": len(neutral),
            "negative_pct": round((len(negative) / len(all_feedback)) * 100, 1) if all_feedback else 0,
            "negative_texts": [f.raw_text for f in negative],
            "positive_texts": [f.raw_text for f in positive],
        }

    def get_complaint_summary(self, days: int = 28) -> dict:
        """Get structured complaint data ready for LLM analysis."""

        feedback = self.get_recent_feedback(days)

        # Deduplicate complaint texts for cleaner LLM input
        unique_complaints = list(set(feedback["negative_texts"]))
        unique_positives  = list(set(feedback["positive_texts"]))

        return {
            "period_days": days,
            "total_feedback": feedback["total_feedback"],
            "sentiment_breakdown": {
                "negative": feedback["negative_count"],
                "positive": feedback["positive_count"],
                "neutral":  feedback["neutral_count"],
                "negative_pct": feedback["negative_pct"],
            },
            "unique_complaints": unique_complaints,
            "unique_positives": unique_positives,
        }

    async def analyse_and_recommend(
        self,
        days: int = 28,
        scenario_profile: ScenarioDefinition | None = None,
        target_date: datetime | None = None,
    ) -> dict:
        """Use Gemini to analyse complaints and generate recommendation."""

        summary = self.get_complaint_summary(days)
        scenario_label = scenario_profile["label"] if scenario_profile else "Friday Rush"
        service_window = scenario_profile["service_window"] if scenario_profile else "18:00-22:00"
        operational_focus = (
            scenario_profile["operational_focus"]
            if scenario_profile
            else "Rush execution, table turns, and same-day quality control."
        )
        scenario_watchouts = self._scenario_watchouts((scenario_profile or {}).get("id", "friday_rush"))
        summary["scenario_label"] = scenario_label
        summary["service_window"] = service_window
        summary["scenario_watchouts"] = scenario_watchouts
        if target_date:
            summary["target_date"] = target_date.strftime("%Y-%m-%d")

        prompt = f"""
## Context
Customer feedback analysis for {scenario_label} planning:
- Target service window: {service_window}
- Operational focus: {operational_focus}
- Total feedback received: {summary['total_feedback']}
- Negative: {summary['sentiment_breakdown']['negative']} ({summary['sentiment_breakdown']['negative_pct']}%)
- Positive: {summary['sentiment_breakdown']['positive']}
- Neutral:  {summary['sentiment_breakdown']['neutral']}

Operational watchouts for this scenario:
{chr(10).join(f'- {item}' for item in scenario_watchouts)}

Complaint texts:
{chr(10).join(f'- {c}' for c in summary['unique_complaints'])}

Positive feedback:
{chr(10).join(f'- {p}' for p in summary['unique_positives'][:5])}

## Task
Identify the top 3 recurring issues from these complaints and recommend specific operational fixes for this service scenario. Weight the issues that most threaten the target service window first.

## Response format
Respond with a JSON object containing:
- "issues": array of objects, each with:
  - "issue": string — the recurring complaint
  - "frequency": string — how often it occurs
  - "recommendation": string — specific operational fix
  - "priority": string — "high", "medium", or "low"
- "overall_summary": string — brief summary of complaint trends
- "action_items": array of strings — high-level action items for management
"""

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_COMPLAINT_AGENT
        )

        return {
            "service": "complaint",
            "data": summary,
            "recommendation": recommendation
        }

    def _scenario_watchouts(self, scenario_id: str) -> list[str]:
        watchouts = {
            "weekday_lunch": [
                "Fast lunch pacing matters more than broad menu experimentation.",
                "Takeaway packaging, handoff speed, and cashier flow are high-sensitivity points.",
            ],
            "holiday_spike": [
                "Queue growth and delayed dispatch will be amplified under surge demand.",
                "Quality slippage under heavy volume is more damaging than small menu restraint.",
            ],
            "low_stock_weekend": [
                "Stockout disappointment and inconsistent substitutions are the main guest risk.",
                "Front-of-house communication needs to stay ahead of unavailable items.",
            ],
        }
        return watchouts.get(
            scenario_id,
            [
                "Wait times, pizza temperature, and table turns remain the main Friday rush risks.",
                "Peak-hour guest communication should stay tight when the kitchen is under pressure.",
            ],
        )
