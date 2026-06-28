"""Swiggy MCP HTTP client.

Handles JSON-RPC 2.0 calls to all three Swiggy MCP servers (Food, Instamart,
Dineout). Graceful degradation is the primary contract: every failure path
returns None and logs — it never raises, so callers don't need try/except.

Observability:
  - Per-call traces accumulated in self._traces; drain via drain_traces().
  - Circuit breaker per endpoint (Redis-backed): 3 failures in 5 min → open
    for 30 min. Open circuit short-circuits to None immediately (no HTTP call).
"""

import asyncio
import time
import structlog

import httpx

from app.core.settings import get_settings

log = structlog.get_logger()

FOOD_ENDPOINT      = "https://mcp.swiggy.com/food"
INSTAMART_ENDPOINT = "https://mcp.swiggy.com/im"
DINEOUT_ENDPOINT   = "https://mcp.swiggy.com/dineout"

_TIMEOUT  = 30.0
_PROVIDER = "swiggy"


class SwiggyMCPClient:
    """Low-level JSON-RPC client for all three Swiggy MCP servers.

    Instantiate once per request or share across enrichers — it holds no
    mutable per-call state except _traces. Token is read from settings on
    each call so it stays fresh if the caller updates settings between calls.
    """

    def __init__(self) -> None:
        self._traces: list[dict] = []

    def drain_traces(self) -> list[dict]:
        """Return and clear accumulated call traces."""
        traces, self._traces = self._traces, []
        return traces

    def is_available(self) -> bool:
        """True when a token is configured and non-empty."""
        return bool(get_settings().swiggy_access_token)

    async def call_tool(
        self,
        endpoint: str,
        tool_name: str,
        arguments: dict,
    ) -> dict | None:
        """POST a JSON-RPC tools/call and return the data payload.

        Returns None on any failure (401, 5xx, network error, bad response,
        or open circuit). Retries once on 5xx after a 1-second sleep. Never raises.
        """
        from app.infrastructure.swiggy.circuit_breaker import (
            is_open, record_failure, record_success,
        )

        token      = get_settings().swiggy_access_token
        server_tag = endpoint.rstrip("/").rsplit("/", 1)[-1]

        # ── Circuit breaker check ────────────────────────────────────────────
        if await is_open(_PROVIDER, server_tag):
            log.warning(
                "swiggy_circuit_open_skipping",
                tool=tool_name,
                server=server_tag,
            )
            self._traces.append({
                "provider":    _PROVIDER,
                "endpoint":    server_tag,
                "tool":        tool_name,
                "status":      "circuit_open",
                "duration_ms": 0,
            })
            return None

        payload = {
            "jsonrpc": "2.0",
            "method":  "tools/call",
            "params":  {"name": tool_name, "arguments": arguments},
            "id":      1,
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
        }

        result = await self._post(
            endpoint, payload, headers, tool_name, server_tag, attempt=1
        )

        if result is None:
            await record_failure(_PROVIDER, server_tag)
        else:
            await record_success(_PROVIDER, server_tag)

        return result

    async def _post(
        self,
        endpoint: str,
        payload: dict,
        headers: dict,
        tool_name: str,
        server_tag: str,
        attempt: int,
    ) -> dict | None:
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(endpoint, json=payload, headers=headers)

            duration_ms = round((time.perf_counter() - t0) * 1000, 1)

            if response.status_code == 401:
                log.warning(
                    "swiggy_token_expired",
                    tool=tool_name,
                    server=server_tag,
                    detail="Swiggy token expired or invalid -- re-authentication needed",
                )
                self._traces.append({
                    "provider": _PROVIDER, "endpoint": server_tag,
                    "tool": tool_name, "status": "auth_error",
                    "duration_ms": duration_ms, "attempt": attempt,
                })
                return None

            if response.status_code >= 500:
                if attempt == 1:
                    log.warning(
                        "swiggy_5xx_retrying",
                        tool=tool_name, server=server_tag,
                        status=response.status_code, attempt=attempt,
                    )
                    await asyncio.sleep(1)
                    return await self._post(
                        endpoint, payload, headers, tool_name, server_tag, attempt=2
                    )
                log.error(
                    "swiggy_5xx_failed",
                    tool=tool_name, server=server_tag,
                    status=response.status_code, duration_ms=duration_ms,
                )
                self._traces.append({
                    "provider": _PROVIDER, "endpoint": server_tag,
                    "tool": tool_name, "status": f"http_{response.status_code}",
                    "duration_ms": duration_ms, "attempt": attempt,
                })
                return None

            body = response.json()

            if not body.get("success"):
                err = body.get("error", {})
                log.warning(
                    "swiggy_tool_error",
                    tool=tool_name, server=server_tag,
                    error=err.get("message", "unknown"), duration_ms=duration_ms,
                )
                self._traces.append({
                    "provider": _PROVIDER, "endpoint": server_tag,
                    "tool": tool_name, "status": "tool_error",
                    "error": err.get("message", "unknown"),
                    "duration_ms": duration_ms, "attempt": attempt,
                })
                return None

            log.info(
                "swiggy_tool_ok",
                tool=tool_name, server=server_tag, duration_ms=duration_ms,
            )
            self._traces.append({
                "provider":    _PROVIDER,
                "endpoint":    server_tag,
                "tool":        tool_name,
                "status":      "ok",
                "duration_ms": duration_ms,
                "attempt":     attempt,
            })
            return body.get("data")

        except Exception as exc:
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            log.error(
                "swiggy_tool_exception",
                tool=tool_name, server=server_tag,
                error=str(exc), duration_ms=duration_ms,
            )
            self._traces.append({
                "provider":    _PROVIDER,
                "endpoint":    server_tag,
                "tool":        tool_name,
                "status":      "exception",
                "error":       str(exc),
                "duration_ms": duration_ms,
                "attempt":     attempt,
            })
            return None
