"""Swiggy MCP HTTP client.

Handles JSON-RPC 2.0 calls to all three Swiggy MCP servers (Food, Instamart,
Dineout). Graceful degradation is the primary contract: every failure path
returns None and logs — it never raises, so callers don't need try/except.
"""

import asyncio
import time
import structlog

import httpx

from app.core.settings import get_settings

log = structlog.get_logger()

FOOD_ENDPOINT = "https://mcp.swiggy.com/food"
INSTAMART_ENDPOINT = "https://mcp.swiggy.com/im"
DINEOUT_ENDPOINT = "https://mcp.swiggy.com/dineout"

_TIMEOUT = 30.0


class SwiggyMCPClient:
    """Low-level JSON-RPC client for all three Swiggy MCP servers.

    Instantiate once per request or share across enrichers — it holds no
    mutable per-call state. Token is read from settings on each call so it
    stays fresh if the caller updates settings between calls.
    """

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

        Returns None on any failure (401, 5xx, network error, bad response).
        Retries once on 5xx after a 1-second sleep. Never raises.
        """
        token = get_settings().swiggy_access_token
        server_tag = endpoint.rstrip("/").rsplit("/", 1)[-1]

        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
            "id": 1,
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        return await self._post(endpoint, payload, headers, tool_name, server_tag, attempt=1)

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
                return None

            if response.status_code >= 500:
                if attempt == 1:
                    log.warning(
                        "swiggy_5xx_retrying",
                        tool=tool_name,
                        server=server_tag,
                        status=response.status_code,
                        attempt=attempt,
                    )
                    await asyncio.sleep(1)
                    return await self._post(endpoint, payload, headers, tool_name, server_tag, attempt=2)
                log.error(
                    "swiggy_5xx_failed",
                    tool=tool_name,
                    server=server_tag,
                    status=response.status_code,
                    duration_ms=duration_ms,
                )
                return None

            body = response.json()

            if not body.get("success"):
                err = body.get("error", {})
                log.warning(
                    "swiggy_tool_error",
                    tool=tool_name,
                    server=server_tag,
                    error=err.get("message", "unknown"),
                    duration_ms=duration_ms,
                )
                return None

            log.info(
                "swiggy_tool_ok",
                tool=tool_name,
                server=server_tag,
                duration_ms=duration_ms,
            )
            return body.get("data")

        except Exception as exc:
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            log.error(
                "swiggy_tool_exception",
                tool=tool_name,
                server=server_tag,
                error=str(exc),
                duration_ms=duration_ms,
            )
            return None
