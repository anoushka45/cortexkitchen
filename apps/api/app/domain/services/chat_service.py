
"""
P5-12 RAG chatbot service.

Retrieves context from Postgres (recent planning runs) and Qdrant (similar
complaints), builds a grounded system prompt, then streams a Groq reply
token-by-token.
"""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.infrastructure.db.models import Feedback, PlanningRun, SentimentType

_MODEL = "llama-3.3-70b-versatile"
_MAX_TOKENS = 1024
_MAX_RUNS = 10


def _format_runs(runs: list[PlanningRun]) -> str:
    if not runs:
        return "No planning runs found."
    lines = []
    for r in runs:
        score = f"{r.critic_score:.2f}" if r.critic_score else "n/a"
        date  = r.created_at.strftime("%Y-%m-%d") if r.created_at else "?"
        critic = r.critic or {}
        fr = r.final_response or {}
        recs = fr.get("recommendations", {})  # final_response uses "recommendations" not "agents"

        parts = [f"[{date}] scenario={r.scenario} verdict={r.critic_verdict} score={score}"]

        # Critic notes
        notes = critic.get("notes", "")
        if notes:
            parts.append(f"  critic_notes: {notes[:300]}")

        # Demand forecast
        try:
            fd = recs["forecast"].get("data", {})
            predicted = fd.get("predicted_orders")
            avg = fd.get("avg_friday_orders") or fd.get("avg_same_day_orders")
            if predicted:
                parts.append(f"  demand: predicted_orders={predicted} avg={avg}")
        except (KeyError, TypeError, AttributeError):
            pass

        # Menu intelligence
        try:
            menu_rec = recs.get("menu") or {}
            highlights = menu_rec.get("highlight_items") or []
            top = (menu_rec.get("data") or {}).get("top_items") or []
            items = highlights or top
            if items:
                parts.append(f"  menu_highlights: {', '.join(str(i) for i in items[:6])}")
        except (KeyError, TypeError, AttributeError):
            pass

        # Inventory
        try:
            inv = recs.get("inventory") or {}
            inv_data = inv.get("data") or {}
            shortages = inv_data.get("shortage_alerts", [])
            if shortages:
                names = [a.get("ingredient", a.get("item", "?")) for a in shortages[:4]]
                parts.append(f"  shortages: {', '.join(names)}")
            restock = inv.get("restock_actions", [])
            if restock:
                parts.append(f"  restock_actions: {'; '.join(str(a) for a in restock[:3])}")
        except (KeyError, TypeError, AttributeError):
            pass

        # Reservations
        try:
            res = recs.get("reservation") or {}
            res_data = res.get("data") or {}
            guests = res_data.get("total_guests")
            occ = res_data.get("occupancy_pct")
            if guests:
                parts.append(f"  reservations: total_guests={guests} occupancy={occ}%")
        except (KeyError, TypeError, AttributeError):
            pass

        lines.append("\n".join(parts))
    return "\n\n".join(lines)


def _format_feedback(rows) -> str:
    if not rows:
        return "No feedback records found."
    neg = [r for r in rows if r.sentiment and r.sentiment.value == "negative"]
    pos = [r for r in rows if r.sentiment and r.sentiment.value == "positive"]
    samples = neg[:5] or rows[:5]
    lines = [f"Total feedback: {len(rows)} ({len(neg)} negative, {len(pos)} positive)"]
    if samples:
        lines.append("Sample negative feedback:")
        for fb in samples:
            lines.append(f"  - {str(fb.raw_text or '')[:150]}")
    return "\n".join(lines)



def build_context(
    org_id: int,
    org_name: str,
    question: str,
    db: Session,
    memory=None,
) -> str:
    runs = (
        db.query(PlanningRun)
        .filter(PlanningRun.org_id == org_id)
        .order_by(PlanningRun.created_at.desc())
        .limit(_MAX_RUNS)
        .all()
    )

    # Query Feedback table directly — more reliable than Qdrant (pre-dates org_id stamping)
    feedback_rows = (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .limit(30)
        .all()
    )

    return f"""You are CortexKitchen's operations intelligence assistant for {org_name}.
You answer questions about the restaurant's planning runs, critic decisions, inventory, menu performance, demand forecasts, and complaint history.
Be concise, specific, and data-driven. Always reference actual figures from the data below.
If a question cannot be answered from the data, say exactly what is missing.

RECENT PLANNING RUNS (last {len(runs)} — most recent first):
{_format_runs(runs)}

CUSTOMER FEEDBACK & COMPLAINTS:
{_format_feedback(feedback_rows)}

INSTRUCTIONS:
- Use the menu_highlights field to answer questions about top/popular items.
- Use shortages and restock_actions to answer inventory questions.
- Use demand fields to answer volume/forecast questions.
- Use critic_notes and score to explain plan quality.
- Never say "the data does not provide" if the field exists above — read it carefully.
- Keep answers under 150 words unless detail is explicitly requested.
- Always format your response using markdown: use **bold** for key figures, bullet points for lists, numbered lists for steps, and ### headings for multi-section answers."""


async def stream_reply(
    question: str,
    history: list[dict],
    system_prompt: str,
) -> AsyncGenerator[str, None]:
    from groq import AsyncGroq

    settings = get_settings()
    client = AsyncGroq(api_key=settings.groq_api_key)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-6:]:  # keep last 3 turns (6 messages)
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    response = await client.chat.completions.create(
        model=_MODEL,
        messages=messages,
        stream=True,
        max_tokens=_MAX_TOKENS,
        temperature=0.4,
    )

    async for chunk in response:
        token = chunk.choices[0].delta.content
        if token:
            yield token
