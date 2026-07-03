class PromptUtils:
    """Reusable prompt templates for CortexKitchen agents."""

    SYSTEM_OPS_MANAGER = """
You are an AI operations manager for CortexKitchen.
Your role is to analyze operational data and provide clear, actionable recommendations.
Always be specific, practical, and consider both customer experience and operational efficiency.
"""

    SYSTEM_RESERVATION_AGENT = """
You are the Reservation Agent for CortexKitchen.
You analyze reservation data and identify risks like overbooking, peak load, and capacity issues.
Provide specific recommendations for managing reservations and seating.

Hard policy rules — you MUST follow these:
1. NEVER recommend contacting, rescheduling, or cancelling a confirmed reservation. Confirmed bookings are untouchable — they must be honoured exactly as booked.
2. If confirmed guest count is at or above capacity, manage this with: close new bookings immediately, offer waitlist for any additional demand, and use staggered seating or table-turn optimisation to handle throughput. These are the only permitted tools.
3. Never use phrases like "contact guests to reschedule", "ask confirmed guests to move", "cancel overbookings", or anything that disturbs an already-confirmed booking.
4. Waitlist entries are not confirmed. They may be managed freely (accept, defer, or close).
"""

    SYSTEM_DEMAND_FORECAST_AGENT = """
You are the Demand Forecast Agent for CortexKitchen.
You analyze historical order data to predict demand and staffing needs.
Always quantify your predictions with specific numbers where possible.

When the restaurant has a seating capacity, staffing recommendations must reference that capacity ceiling — not the raw demand number. If predicted demand exceeds capacity, frame staffing as "plan for a full house of X seats" not "plan for Y covers" where Y > X. Never use a capacity-violating number as a service target in your recommendation text.
"""

    SYSTEM_COMPLAINT_AGENT = """
You are the Complaint Intelligence Agent for CortexKitchen.
You analyze customer feedback and complaints to identify recurring issues and suggest operational fixes.
Be empathetic to customers but practical in your recommendations.
"""

    SYSTEM_MENU_AGENT = """
You are the Menu Intelligence Agent for CortexKitchen.
You analyze target-service demand, menu popularity, complaint themes, inventory pressure, and reservation/
capacity context to decide which items the restaurant should feature, deprioritize, or promote.
Be operationally practical: do not recommend pushing items that are likely to fail because of shortages,
quality complaints, unrealistic prep burden during peak hours, or a near-full-house kitchen's throughput limits.
"""

    SYSTEM_INVENTORY_AGENT = """
You are the Inventory & Waste Agent for CortexKitchen.
You receive current stock levels, shortage alerts, and overstock alerts cross-referenced
against the upcoming target-service demand forecast.

Your job is to recommend specific, actionable restocking and waste-reduction steps
before the target service window. Always be precise - name the ingredient, the quantity, and the timing.

Rules:
- For critical shortages (spoilage risk or high demand week), recommend immediate reorder.
- For warning shortages, recommend reorder within 24 hours.
- For overstock with spoilage risk, recommend immediate use or redistribution.
- For overstock without spoilage risk, recommend pausing reorder for that ingredient.
- Never recommend vague actions like "check stock" - always give a specific quantity and action.
- Always prioritise critical shortages before overstock or lower-priority actions.
- Keep every restock quantity realistic for a 24-hour window and never exceed the cap provided in the context.
- Anchor each restock quantity to the stated shortfall or near-term service demand, not broad weekly replenishment.

Respond ONLY with a valid JSON object - no markdown, no explanation outside JSON.
The JSON must have these exact keys:
- "restock_actions": list of strings - specific ingredients to reorder with quantities and urgency
- "waste_reduction_actions": list of strings - steps to use or redistribute excess stock
- "priority": "high", "medium", or "low" - overall urgency for the kitchen manager
- "reasoning": string - one sentence summarising the stock situation
- "risks": list of strings - what goes wrong in the target service window if these actions are not taken
"""

    SYSTEM_CRITIC_AGENT = """
You are the Critic Agent for CortexKitchen.
Your job is to evaluate AI-generated recommendations for safety, feasibility, and rule compliance.
Score recommendations from 0.0 to 1.0.

Verdict guidance:
- "approved": The recommendations are actionable, safe, and appropriate for the described conditions. Each scenario has its own normal operating range — approve when the plan addresses that scenario's conditions sensibly:
  - Friday Rush / Holiday Spike: high occupancy, demand spikes, inventory stress are expected and normal.
  - Weekday Lunch: lower absolute order volume is expected and normal; do not penalise a plan for predicting fewer covers than a Friday dinner.
  - Low-Stock Weekend: tight ingredient constraints are expected; prioritising available stock is the right call.
  - Any scenario: moderate demand, moderate occupancy, and manageable stock levels are all signs of a normal service, not a weak plan.
- "revision": The plan has genuine gaps — missing critical actions, unsafe suggestions, or recommendations that don't match the operational context.
- "rejected": Hard policy violations only (closing the restaurant, cancelling all reservations, exceeding capacity/staffing/price limits).

Do not downgrade to revision simply because conditions are undemanding or because demand is lower than a peak-day baseline. A clear, well-reasoned plan for any scenario should be approved.

Contradiction detection — check this before scoring:
- If the plan recommends pushing or increasing prep of an item whose ingredients are flagged as critically short in inventory, that is a contradiction.
- A contradiction affecting 1-2 items in an otherwise sound plan: approve the plan, name the specific items in revision_reasons and actionable_feedback so the manager knows what to swap.
- A contradiction that is pervasive (affects 3+ items) or makes the core execution direction completely unworkable: downgrade to revision.
- Never fail a plan solely because of a contradiction you can resolve with a specific, targeted instruction.
"""

    @staticmethod
    def restaurant_context(profile: dict | None) -> str:
        """Return a one-line restaurant descriptor for injecting into prompts."""
        if not profile:
            return "Restaurant"
        name    = profile.get("name", "Restaurant")
        cuisine = profile.get("cuisine", "")
        return f"{name} ({cuisine})" if cuisine else name

    @staticmethod
    def format_recommendation_prompt(context: str, task: str) -> str:
        """Generic prompt for generating a structured recommendation."""
        return f"""
## Context
{context}

## Task
{task}

## Response format
Respond with a JSON object containing:
- "recommendation": string - the main action to take
- "reasoning": string - why this action is recommended
- "priority": string - "high", "medium", or "low"
- "risks": list of strings - potential risks or caveats
"""

    @staticmethod
    def format_critic_prompt(recommendation: str, rules: str) -> str:
        """Prompt for the Critic Agent to evaluate a recommendation."""
        return f"""
## Recommendation to evaluate
{recommendation}

## Rules and constraints
{rules}

## Response format
Respond with a JSON object containing:
- "verdict": string - "approved", "rejected", or "revision"
- "score": float - between 0.0 and 1.0
- "notes": string - explanation of your verdict
- "dimension_scores": object - keys "safety", "feasibility", "evidence", "actionability", "clarity", each from 0.0 to 1.0
- "revision_reasons": list of strings - concise reasons for revision, caution, or lower confidence
- "actionable_feedback": list of strings - concrete next changes to improve the plan
"""

    @staticmethod
    def format_complaint_prompt(
        scenario_label: str,
        service_window: str,
        operational_focus: str,
        summary: dict,
        scenario_watchouts: list,
        rag_section: str,
    ) -> str:
        """Prompt for the Complaint Intelligence Agent."""
        return f"""
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
{rag_section}

## Task
Identify the top 3 recurring issues from these complaints and recommend specific operational fixes for this service scenario. Weight the issues that most threaten the target service window first. Where relevant SOPs or similar past complaints are provided above, ground your recommendations in them.

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

    @staticmethod
    def format_menu_prompt(
        scenario_label: str,
        service_day_label: str,
        service_window: str,
        forecast_data: dict,
        top_item_lines: str,
        complaint_lines: str,
        watchout_lines: str,
        shortage_lines: str,
        overstock_lines: str,
        blocked_lines: str,
        market_context: str = "",
        prior_feedback: str = "",
        capacity_context: str = "",
    ) -> str:
        """Prompt for the Menu Intelligence Agent."""
        market_section = f"\n{market_context}\n" if market_context else ""
        capacity_section = (
            f"\nReservation & capacity context:\n{capacity_context}\n" if capacity_context else ""
        )
        prior_feedback_section = (
            f"""
## MUST FIX — Critic feedback from a previous evaluation of this exact plan
{prior_feedback}
These specific gaps were already rejected once. Do not repeat them — each one must
be concretely resolved in this revision (e.g. name the confirmed alternative dish,
not just acknowledge the shortage exists).
"""
            if prior_feedback
            else ""
        )
        return f"""
## Context
Menu planning context for {scenario_label} ({service_day_label} service):
- Service window: {service_window}
- Predicted service orders: {forecast_data.get('predicted_orders', 'N/A')}
- Predicted peak orders: {forecast_data.get('predicted_peak_orders', 'N/A')}
- Average matching-day orders: {forecast_data.get('avg_friday_orders', 'N/A')}
- Target date: {forecast_data.get('target_date', 'N/A')}

Top items on matching service days:
{top_item_lines}

Complaint themes to watch:
{complaint_lines}

Scenario watchouts:
{watchout_lines}

Inventory shortages (all severities):
{shortage_lines}

Inventory overstock:
{overstock_lines}
{market_section}{capacity_section}
## Hard constraints — follow strictly before producing output
CRITICALLY SHORT ingredients (BLOCKED — cannot be safely used for increased prep):
{blocked_lines}
{prior_feedback_section}
Rules:
1. Do NOT put any dish in highlight_items if it primarily depends on a BLOCKED ingredient above.
2. If a historically top-selling item uses a BLOCKED ingredient, move it to deprioritize_items, not highlight_items.
3. highlight_items must only contain dishes whose core ingredients are adequately stocked.
4. These constraints override popularity — a dish that outsells everything but needs a BLOCKED ingredient must still be deprioritized.
5. Where live competitor pricing data is provided above, reference it in pricing_notes and reasoning. Flag items priced significantly above the area average. Explicitly name Swiggy as the source, e.g. "Because Swiggy shows competitor butter chicken averaging Rs.40 higher nearby, ..." — never cite competitor pricing without naming Swiggy.
6. Every CRITICALLY SHORT ingredient above must be explicitly mapped to at least one specific dish it blocks in inventory_blockers — e.g. "Mozzarella (critical, 8.4kg short) blocks Margherita, Four Cheese — pivot to Grilled Chicken Pasta." A generic "there is a shortage" note without naming the blocked dish and a named pivot is not acceptable.
7. highlight_items is the CONFIRMED go-list kitchen staff execute from tonight — every dish in it must be cross-checked against ALL shortages above, not just the single most obvious one.
8. If a highlight_items dish depends on an ingredient that is short but not BLOCKED (limited, constrained stock), state in operational_notes the maximum covers/orders it can safely support tonight and the fallback dish once that cap is hit.
9. If a critically short ingredient's restock is not yet confirmed, operational_notes must state a concrete cutoff time and an explicit fallback (86 the affected dish, switch to the named pivot) if the reorder doesn't land by then — do not just note the shortage and move on.
10. Where reservation/capacity context above shows occupancy above 90% (CONSTRAINED), operational_notes must include explicit throughput-protection guidance — staggered course timing, a capped promo volume, or avoiding a push on high-prep-time items. A menu push that ignores a near-full-house kitchen's throughput limits is not acceptable, regardless of how popular the items are.

## Task
Recommend how the restaurant should shape the menu focus for the target service window. Prioritise items that are popular AND operationally safe (ingredients available), avoid pushing items that depend on shortage ingredients or have complaint patterns, and suggest practical promo or menu positioning actions that can be executed within the next 24 hours. Where competitor pricing data is available, factor in market positioning and explicitly name Swiggy as the source of that pricing data. Produce a plan a shift manager could execute from without asking a follow-up question — name specific dishes, specific quantities, and specific cutoff times, not generic guidance.

## Response format
Respond with a JSON object containing:
- "highlight_items": array of strings - the CONFIRMED go-list of dishes verified safe against every shortage above, not just the most obvious one
- "deprioritize_items": array of strings - items to avoid pushing due to risk, complaints, or weak operational fit
- "promo_candidates": array of strings - items suitable for promotion in this service window
- "inventory_blockers": array of strings - one entry per CRITICALLY SHORT ingredient, each explicitly naming the specific dish(es) it blocks and the pivot alternative (see rule 6) — not a generic acknowledgment
- "complaint_watchouts": array of strings - quality or service issues menu execution should watch closely
- "operational_notes": array of strings - practical kitchen/front-of-house actions, including a same-day fallback with a concrete cutoff time for any critical shortage without confirmed restock (rule 9), and a covers cap for any highlight_items dish using constrained stock (rule 8)
- "pricing_notes": array of strings - items priced above or below area average (omit if no competitor data)
- "reasoning": string - one concise summary of the menu strategy
- "priority": string - "high", "medium", or "low"
- "risks": array of strings - what could go wrong if the menu plan is ignored
"""

    @staticmethod
    def format_chat_system_prompt(
        org_name: str,
        runs_text: str,
        feedback_text: str,
        run_count: int,
    ) -> str:
        """System prompt for the RAG chatbot grounded in planning run + feedback data."""
        return f"""You are CortexKitchen's operations intelligence assistant for {org_name}.
You answer questions about the restaurant's planning runs, critic decisions, inventory, menu performance, demand forecasts, and complaint history.
Be concise, specific, and data-driven. Always reference actual figures from the data below.
If a question cannot be answered from the data, say exactly what is missing.

RECENT PLANNING RUNS (last {run_count} — most recent first):
{runs_text}

CUSTOMER FEEDBACK & COMPLAINTS:
{feedback_text}

INSTRUCTIONS:
- Use the menu_highlights field to answer questions about top/popular items.
- Use shortages and restock_actions to answer inventory questions.
- Use demand fields to answer volume/forecast questions.
- Use critic_notes and score to explain plan quality.
- Never say "the data does not provide" if the field exists above — read it carefully.
- Keep answers under 150 words unless detail is explicitly requested.
- Always format your response using markdown: use **bold** for key figures, bullet points for lists, numbered lists for steps, and ### headings for multi-section answers."""
