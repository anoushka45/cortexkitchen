from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.infrastructure.db.models import DecisionLog, CriticVerdict
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class CriticService:
    """Validates AI recommendations against operational rules and logs decisions."""

    # Operational rules the critic enforces
    RULES = """
1. Maximum restaurant capacity is 70 guests at any time.
2. Do not recommend closing the restaurant or cancelling all reservations.
3. Staffing recommendations must not exceed 20 additional staff members.
4. Price changes must not exceed 30% increase or decrease from current price.
5. Any recommendation involving food safety must follow standard health guidelines.
6. Inventory reorder recommendations must be for realistic quantities (not more than 3x current stock).
7. Do not recommend actions that would negatively impact already confirmed reservations.
8. All recommendations must be actionable within a 24 hour window.
9. When inventory has critical shortages, recommendations must explicitly prioritise those ingredients before non-critical actions.
10. Inventory recommendations must focus on immediate restocking needed for the next Friday service window, not broad long-term replenishment.
"""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    async def evaluate(self, agent: str, recommendation: dict, input_summary: str = None) -> dict:
        """Evaluate a recommendation and return critic verdict."""

        recommendation_text = input_summary or str(
            recommendation.get("recommendation", recommendation)
        )

        prompt = PromptUtils.format_critic_prompt(
            recommendation=recommendation_text,
            rules=self.RULES
        )

        verdict_raw = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_CRITIC_AGENT
        )

        # Normalise verdict
        verdict_str = verdict_raw.get("verdict", "revision").lower()
        if verdict_str not in ["approved", "rejected", "revision"]:
            verdict_str = "revision"

        critic_score = float(verdict_raw.get("score", 0.5))
        critic_notes = verdict_raw.get("notes", "")

        return {
            "agent": agent,
            "verdict": verdict_str,
            "score": critic_score,
            "notes": critic_notes,
            "recommendation": recommendation_text,
        }

    async def evaluate_and_log(
        self,
        agent: str,
        recommendation: dict,
        input_summary: str = None,
        retrieved_context: str = None,
        reasoning_summary: str = None,
    ) -> dict:
        """Evaluate a recommendation and persist the decision to the database."""

        result = await self.evaluate(agent, recommendation, input_summary)

        # Map string verdict to enum
        verdict_map = {
            "approved": CriticVerdict.approved,
            "rejected": CriticVerdict.rejected,
            "revision": CriticVerdict.revision,
        }

        log = DecisionLog(
            agent=agent,
            input_summary=input_summary,
            retrieved_context=retrieved_context,
            reasoning_summary=reasoning_summary,
            action_recommended=result["recommendation"],
            critic_verdict=verdict_map.get(result["verdict"], CriticVerdict.revision),
            critic_score=result["score"],
            critic_notes=result["notes"],
            created_at=datetime.now(timezone.utc),

        )

        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        result["decision_log_id"] = log.id
        return result
