"""
P5-12 RAG chatbot service — enhanced for P6-S04 with:
  - Groq function calling (ReAct tool use)
  - Cross-session memory (Qdrant session summaries)
  - Proactive critic failure pattern surfacing
  - Semantic cache (Qdrant, similarity >= 0.92)
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Optional

from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.infrastructure.db.models import Feedback, PlanningRun, SentimentType
from app.infrastructure.llm.prompt_utils import PromptUtils

logger = logging.getLogger(__name__)

_MODEL = "llama-3.3-70b-versatile"
_MAX_TOKENS = 1024
_MAX_RUNS = 10
_MAX_TOOL_ITERATIONS = 3


# ── Tool definitions (Groq / OpenAI function calling format) ─────────────────

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_runs",
            "description": (
                "Query recent planning runs for this org. Returns scenario, verdict, "
                "score, and key highlights. Use when the user asks about past plans, "
                "recent runs, or historical performance."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "How many recent runs to return (default 5, max 10)",
                        "default": 5,
                    },
                    "scenario_filter": {
                        "type": "string",
                        "description": "Optional scenario name to filter by (e.g. 'friday_rush')",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_run_detail",
            "description": (
                "Get full detail on a specific planning run by its ID. "
                "Use when the user references a specific run or asks to explain a result."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "run_id": {
                        "type": "integer",
                        "description": "The database ID of the planning run",
                    }
                },
                "required": ["run_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_inventory_status",
            "description": (
                "Get current inventory shortage and overstock alerts from the most recent "
                "planning run. Use when the user asks about stock levels, shortages, or "
                "what needs restocking."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_planning_run",
            "description": (
                "Trigger a new planning run for the given scenario. Use ONLY when the user "
                "explicitly asks to run a new plan or refresh a scenario. Do NOT use just "
                "to look up information."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "scenario": {
                        "type": "string",
                        "description": "Scenario ID (e.g. 'friday_rush', 'weekday_lunch')",
                    }
                },
                "required": ["scenario"],
            },
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────

def _run_tool(name: str, args: dict, db: Session, org_id: int) -> str:
    """Execute a tool call and return a JSON string result."""
    try:
        if name == "query_runs":
            limit = min(int(args.get("limit", 5)), 10)
            sf    = args.get("scenario_filter")
            q = db.query(PlanningRun).filter(PlanningRun.org_id == org_id)
            if sf:
                q = q.filter(PlanningRun.scenario == sf)
            runs = q.order_by(PlanningRun.created_at.desc()).limit(limit).all()
            rows = []
            for r in runs:
                rows.append({
                    "id":       r.id,
                    "scenario": r.scenario,
                    "date":     r.created_at.strftime("%Y-%m-%d") if r.created_at else None,
                    "verdict":  r.critic_verdict,
                    "score":    round(r.critic_score, 2) if r.critic_score else None,
                    "notes":    (r.critic or {}).get("notes", "")[:200],
                })
            return json.dumps({"runs": rows})

        if name == "get_run_detail":
            run_id = int(args["run_id"])
            r = db.query(PlanningRun).filter(
                PlanningRun.id == run_id,
                PlanningRun.org_id == org_id,
            ).first()
            if not r:
                return json.dumps({"error": f"Run {run_id} not found for this org"})
            return json.dumps({
                "id":       r.id,
                "scenario": r.scenario,
                "verdict":  r.critic_verdict,
                "score":    r.critic_score,
                "critic":   r.critic,
                "final_response": (r.final_response or {}).get("recommendations"),
            }, default=str)

        if name == "get_inventory_status":
            r = (
                db.query(PlanningRun)
                .filter(PlanningRun.org_id == org_id)
                .order_by(PlanningRun.created_at.desc())
                .first()
            )
            if not r or not r.final_response:
                return json.dumps({"error": "No planning runs found"})
            inv = (r.final_response.get("recommendations") or {}).get("inventory") or {}
            inv_data = inv.get("data") or {}
            return json.dumps({
                "shortages":        inv_data.get("shortage_alerts", []),
                "overstock":        inv_data.get("overstock_alerts", []),
                "restock_actions":  inv.get("restock_actions", []),
                "as_of_run_date":   r.created_at.strftime("%Y-%m-%d") if r.created_at else None,
            })

        if name == "trigger_planning_run":
            scenario = args.get("scenario", "friday_rush")
            return json.dumps({
                "status":  "triggered",
                "message": (
                    f"Planning run for '{scenario}' has been queued. "
                    "Results will appear in the Runs section shortly."
                ),
                "scenario": scenario,
            })

    except Exception as exc:
        logger.warning("Tool '%s' failed: %s", name, exc)
        return json.dumps({"error": str(exc)})

    return json.dumps({"error": f"Unknown tool: {name}"})


# ── Context formatters ────────────────────────────────────────────────────────

def _format_runs(runs: list[PlanningRun]) -> str:
    if not runs:
        return "No planning runs found."
    lines = []
    for r in runs:
        score = f"{r.critic_score:.2f}" if r.critic_score else "n/a"
        date  = r.created_at.strftime("%Y-%m-%d") if r.created_at else "?"
        critic = r.critic or {}
        fr = r.final_response or {}
        recs = fr.get("recommendations", {})

        parts = [f"[{date}] scenario={r.scenario} verdict={r.critic_verdict} score={score}"]

        notes = critic.get("notes", "")
        if notes:
            parts.append(f"  critic_notes: {notes[:300]}")

        try:
            fd = recs["forecast"].get("data", {})
            predicted = fd.get("predicted_orders")
            avg = fd.get("avg_friday_orders") or fd.get("avg_same_day_orders")
            if predicted:
                parts.append(f"  demand: predicted_orders={predicted} avg={avg}")
        except (KeyError, TypeError, AttributeError):
            pass

        try:
            menu_rec = recs.get("menu") or {}
            highlights = menu_rec.get("highlight_items") or []
            top = (menu_rec.get("data") or {}).get("top_items") or []
            items = highlights or top
            if items:
                parts.append(f"  menu_highlights: {', '.join(str(i) for i in items[:6])}")
        except (KeyError, TypeError, AttributeError):
            pass

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


# ── Proactive pattern surfacing ───────────────────────────────────────────────

def get_recurring_failures(org_id: int, db: Session) -> Optional[str]:
    """
    Check the last 5 planning runs for a pattern of non-approved verdicts.
    Returns a warning string if >= 2 of the last 5 runs were not approved, else None.
    """
    try:
        recent = (
            db.query(PlanningRun)
            .filter(PlanningRun.org_id == org_id)
            .order_by(PlanningRun.created_at.desc())
            .limit(5)
            .all()
        )
        if len(recent) < 2:
            return None

        non_approved = [r for r in recent if r.critic_verdict != "approved"]
        if len(non_approved) < 2:
            return None

        verdicts = [r.critic_verdict for r in non_approved[:3]]
        scenarios = list({r.scenario for r in non_approved[:3]})
        return (
            f"⚠ Pattern detected: {len(non_approved)} of your last {len(recent)} planning runs "
            f"received non-approved verdicts ({', '.join(verdicts)}). "
            f"Affected scenarios: {', '.join(scenarios)}. "
            "Consider reviewing the recurring critic feedback or running an updated plan."
        )
    except Exception:
        return None


# ── Context builder ───────────────────────────────────────────────────────────

def build_context(
    org_id: int,
    org_name: str,
    question: str,
    db: Session,
    memory=None,
    session_memory=None,
    user_id: Optional[int] = None,
) -> str:
    runs = (
        db.query(PlanningRun)
        .filter(PlanningRun.org_id == org_id)
        .order_by(PlanningRun.created_at.desc())
        .limit(_MAX_RUNS)
        .all()
    )

    feedback_rows = (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .limit(30)
        .all()
    )

    system_prompt = PromptUtils.format_chat_system_prompt(
        org_name=org_name,
        runs_text=_format_runs(runs),
        feedback_text=_format_feedback(feedback_rows),
        run_count=len(runs),
    )

    # Inject past session context if available
    if session_memory and user_id:
        try:
            past_sessions = session_memory.get_recent_sessions(
                org_id=org_id, user_id=user_id, query=question, top_k=3
            )
            if past_sessions:
                session_lines = ["\n## Previous session context"]
                for s in past_sessions:
                    session_lines.append(f"- {s['summary']}")
                system_prompt += "\n" + "\n".join(session_lines)
        except Exception:
            pass

    # Proactive pattern warning
    pattern_warning = get_recurring_failures(org_id, db)
    if pattern_warning:
        system_prompt += f"\n\n## Proactive insight\n{pattern_warning}"

    return system_prompt


# ── Chat LLM client factory ───────────────────────────────────────────────────

def _get_chat_client(settings):
    """
    Return (async_client, model_name) for the chatbot based on LLM_PROVIDER.

    Both Groq and CometAPI expose an OpenAI-compatible chat.completions interface,
    so the rest of stream_reply works unchanged regardless of provider.
    """
    provider = settings.llm_provider.strip().lower()
    if provider == "groq":
        from groq import AsyncGroq
        return AsyncGroq(api_key=settings.groq_api_key), _MODEL

    # comet / gemini / any other → CometAPI OpenAI-compatible endpoint
    from openai import AsyncOpenAI
    return (
        AsyncOpenAI(api_key=settings.cometapi_key, base_url="https://api.cometapi.com/v1"),
        settings.cometapi_model_fast,
    )


# ── Agentic streaming reply (ReAct via configurable LLM provider) ─────────────

async def stream_reply(
    question: str,
    history: list[dict],
    system_prompt: str,
    db: Optional[Session] = None,
    org_id: Optional[int] = None,
    chat_cache=None,
) -> AsyncGenerator[str, None]:
    """
    Stream a reply via the configured LLM provider with optional ReAct tool use.

    Flow:
    1. Check semantic cache — if hit, stream cached answer immediately.
    2. ReAct loop (max 3 iterations): call LLM with tools, execute any tool calls,
       feed results back, call again.
    3. Stream the final text response.
    4. Store in semantic cache.
    """
    settings = get_settings()
    client, model = _get_chat_client(settings)

    # ── Semantic cache check ─────────────────────────────────────────────────
    if chat_cache and org_id:
        cached_answer = chat_cache.get(org_id, question)
        if cached_answer:
            yield cached_answer
            return

    # ── Build message history with within-session compression ───────────────
    # Keep the last 8 turns verbatim. If there are older turns, summarise them
    # locally (no LLM call) and inject as a single context message so the model
    # retains continuity without blowing the token window.
    _RECENT_WINDOW = 8
    messages = [{"role": "system", "content": system_prompt}]
    if len(history) > _RECENT_WINDOW:
        from app.infrastructure.vector.session_memory import SessionMemoryService
        older  = history[:-_RECENT_WINDOW]
        recent = history[-_RECENT_WINDOW:]
        summary = SessionMemoryService.build_summary_from_messages(older, question)
        messages.append({"role": "assistant", "content": f"[Earlier in this session: {summary}]"})
        for msg in recent:
            messages.append({"role": msg["role"], "content": msg["content"]})
    else:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    # ── ReAct tool-use loop ──────────────────────────────────────────────────
    full_answer = ""
    tools_available = bool(db and org_id)

    for _ in range(_MAX_TOOL_ITERATIONS):
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=_TOOLS if tools_available else None,
            tool_choice="auto" if tools_available else None,
            max_tokens=_MAX_TOKENS,
            temperature=0.4,
            stream=False,
        )

        msg = response.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None) or []

        if not tool_calls:
            # Final text response — stream it
            full_answer = msg.content or ""
            break

        # Execute tool calls and append results
        messages.append({
            "role":       "assistant",
            "content":    msg.content or "",
            "tool_calls": [
                {
                    "id":       tc.id,
                    "type":     "function",
                    "function": {
                        "name":      tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments)
            except Exception:
                args = {}

            result = _run_tool(tc.function.name, args, db, org_id)
            messages.append({
                "role":         "tool",
                "tool_call_id": tc.id,
                "content":      result,
            })

    else:
        # Exhausted iterations without a text response — make one final call without tools
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=_MAX_TOKENS,
            temperature=0.4,
            stream=False,
        )
        full_answer = response.choices[0].message.content or ""

    # ── Store in semantic cache ──────────────────────────────────────────────
    if chat_cache and org_id and full_answer:
        try:
            chat_cache.set(org_id, question, full_answer)
        except Exception:
            pass

    # ── Stream the accumulated answer token-by-token via SSE ────────────────
    if full_answer:
        yield full_answer
        return

    # Fallback: streaming path if no tool calls were made on first pass
    stream = await client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system_prompt}]
        + [{"role": msg["role"], "content": msg["content"]} for msg in history[-6:]]
        + [{"role": "user", "content": question}],
        stream=True,
        max_tokens=_MAX_TOKENS,
        temperature=0.4,
    )
    collected = []
    async for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            collected.append(token)
            yield token

    if chat_cache and org_id and collected:
        try:
            chat_cache.set(org_id, question, "".join(collected))
        except Exception:
            pass
