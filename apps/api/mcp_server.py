"""
CortexKitchen MCP Server — P4-12

Exposes two tools to Claude Desktop (or any MCP client):
  • run_planning_scenario — triggers the multi-agent planning pipeline
  • get_run_history       — fetches recent planning runs with critic verdicts

Runs as a stdio MCP server. Authenticates against the CortexKitchen API
on first tool call and reuses the JWT for the session.

Usage (stdio):
    python mcp_server.py

Configure in Claude Desktop via claude_desktop_config.json — see
docs/mcp_claude_desktop_config.json for the exact snippet.
"""

import asyncio
import json
import os
import sys
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

# ── Config ───────────────────────────────────────────────────────────────────

API_BASE = os.environ.get("CORTEX_API_BASE", "http://localhost:8000/api/v1")
API_EMAIL = os.environ.get("CORTEX_EMAIL", "")
API_PASSWORD = os.environ.get("CORTEX_PASSWORD", "")

SUPPORTED_SCENARIOS = [
    "friday_rush",
    "weekday_lunch",
    "holiday_spike",
    "low_stock_weekend",
]

# ── Server + auth state ───────────────────────────────────────────────────────

server = Server("cortexkitchen")
_token: str | None = None


async def _get_token() -> str:
    global _token
    if _token:
        return _token
    if not API_EMAIL or not API_PASSWORD:
        raise RuntimeError(
            "CORTEX_EMAIL and CORTEX_PASSWORD must be set in the environment."
        )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_BASE}/auth/login",
            json={"email": API_EMAIL, "password": API_PASSWORD},
        )
        resp.raise_for_status()
        _token = resp.json()["access_token"]
    return _token


async def _api(method: str, path: str, **kwargs) -> dict:
    token = await _get_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.request(
            method, f"{API_BASE}{path}", headers=headers, **kwargs
        )
        resp.raise_for_status()
        return resp.json()


# ── Tool definitions ──────────────────────────────────────────────────────────

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="run_planning_scenario",
            description=(
                "Trigger a CortexKitchen multi-agent planning run for a restaurant service scenario. "
                "Returns demand forecast, reservation outlook, complaint analysis, menu insights, "
                "inventory actions, and a critic verdict with score. "
                f"Supported scenarios: {', '.join(SUPPORTED_SCENARIOS)}."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "scenario": {
                        "type": "string",
                        "description": f"Planning scenario to run. One of: {', '.join(SUPPORTED_SCENARIOS)}.",
                        "enum": SUPPORTED_SCENARIOS,
                    },
                    "target_date": {
                        "type": "string",
                        "description": "Optional target date in YYYY-MM-DD format. Defaults to the next matching service day.",
                    },
                    "restaurant_id": {
                        "type": "integer",
                        "description": "Optional restaurant profile ID to use. If omitted, uses default org settings.",
                    },
                },
                "required": ["scenario"],
            },
        ),
        types.Tool(
            name="get_run_history",
            description=(
                "Retrieve recent CortexKitchen planning runs with scenario, date, critic verdict, "
                "and score. Optionally filter by scenario or critic verdict."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of runs to return (1–50). Defaults to 10.",
                        "default": 10,
                    },
                    "scenario": {
                        "type": "string",
                        "description": "Filter by scenario ID.",
                        "enum": SUPPORTED_SCENARIOS,
                    },
                    "verdict": {
                        "type": "string",
                        "description": "Filter by critic verdict.",
                        "enum": ["approved", "revision", "rejected"],
                    },
                },
                "required": [],
            },
        ),
    ]


# ── Tool handlers ─────────────────────────────────────────────────────────────

@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    if name == "run_planning_scenario":
        return await _handle_run_planning(arguments)
    if name == "get_run_history":
        return await _handle_get_runs(arguments)
    raise ValueError(f"Unknown tool: {name}")


async def _handle_run_planning(args: dict) -> list[types.TextContent]:
    scenario = args["scenario"]
    payload: dict[str, Any] = {"scenario": scenario}
    if args.get("target_date"):
        payload["target_date"] = args["target_date"]
    if args.get("restaurant_id"):
        payload["restaurant_id"] = args["restaurant_id"]

    try:
        result = await _api("POST", "/planning/run", json=payload)
    except httpx.HTTPStatusError as exc:
        return [types.TextContent(type="text", text=f"Planning run failed: {exc.response.text}")]
    except Exception as exc:
        return [types.TextContent(type="text", text=f"Planning run failed: {exc}")]

    critic = result.get("critic", {})
    meta = result.get("meta", {})
    recs = result.get("recommendations", {})

    lines = [
        f"# CortexKitchen Planning Run — {scenario.replace('_', ' ').title()}",
        f"**Target date:** {result.get('target_date', 'N/A')}",
        f"**Status:** {result.get('status', 'unknown')}",
        "",
        f"## Critic verdict: {critic.get('verdict', 'unknown').upper()} (score {critic.get('score', 0):.2f})",
        f"{critic.get('notes', '')}",
        "",
        "## Demand forecast",
        recs.get("forecast", {}).get("recommendation", "—"),
        "",
        "## Reservations",
        recs.get("reservation", {}).get("recommendation", "—"),
        "",
        "## Complaints",
        recs.get("complaint", {}).get("overall_summary", "—"),
        "",
        "## Menu insights",
        recs.get("menu", {}).get("reasoning", "—"),
        "",
        "## Inventory",
        recs.get("inventory", {}).get("reasoning", "—"),
        "",
        f"**Run ID:** {meta.get('run_id', 'N/A')} | "
        f"**LLM:** {meta.get('llm_provider', 'N/A')}/{meta.get('llm_model', 'N/A')} | "
        f"**Cost:** ${meta.get('total_cost_usd', 0):.4f} | "
        f"**Duration:** {meta.get('total_duration_ms', 0):.0f}ms",
    ]

    return [types.TextContent(type="text", text="\n".join(lines))]


async def _handle_get_runs(args: dict) -> list[types.TextContent]:
    params: dict[str, Any] = {"limit": min(int(args.get("limit", 10)), 50)}
    if args.get("scenario"):
        params["scenario"] = args["scenario"]
    if args.get("verdict"):
        params["verdict"] = args["verdict"]

    try:
        result = await _api("GET", "/runs", params=params)
    except httpx.HTTPStatusError as exc:
        return [types.TextContent(type="text", text=f"Failed to fetch runs: {exc.response.text}")]
    except Exception as exc:
        return [types.TextContent(type="text", text=f"Failed to fetch runs: {exc}")]

    runs = result.get("runs", [])
    if not runs:
        return [types.TextContent(type="text", text="No planning runs found.")]

    lines = ["# CortexKitchen — Recent Planning Runs", ""]
    for run in runs:
        critic = run.get("critic_verdict", "unknown")
        score = run.get("critic_score", 0.0)
        lines.append(
            f"- **Run #{run.get('id')}** | {run.get('scenario', '?')} | "
            f"{run.get('target_date', '?')} | "
            f"Verdict: **{critic}** ({score:.2f}) | "
            f"Status: {run.get('status', '?')}"
        )

    lines += ["", f"*{len(runs)} run(s) returned.*"]
    return [types.TextContent(type="text", text="\n".join(lines))]


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
