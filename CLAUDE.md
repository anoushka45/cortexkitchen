## CortexKitchen — Claude Code context

### Project structure
- API: apps/api/app/
- Frontend: apps/web/cortexkitchen-ui/
- Docs: docs/
- Tests: apps/api/tests/

### Swiggy MCP integration
All Swiggy integration code lives in apps/api/app/infrastructure/swiggy/
- client.py: SwiggyMCPClient (OAuth token mgmt, JSON-RPC calls)
- base_connector.py: BaseConnector ABC (sync + enrich pattern)
- swiggy_connector.py: SwiggyConnector (reference implementation)
- enrichers/: CompetitorEnricher, OccupancyEnricher, ProcurementEnricher (P6-S06 to P6-S08)
- executor/: ProcurementExecutor, DineoutExecutor (P6-S14 to P6-S15)

Before writing ANY Swiggy tool call, verify tool name and parameters against:
- docs/SWIGGY_INTEGRATION.md (authoritative local reference)
- https://mcp.swiggy.com/builders/llms.txt (live Swiggy docs index)

Key rules:
- checkout and book_table are NOT idempotent. Always check-then-retry on 5xx.
- Dineout uses lat/lng. Food + Instamart use addressId. Never mix them.
- update_cart REPLACES entire Instamart cart. Not additive.
- All enrichers return None on failure. Never raise. Nodes handle None gracefully.
- Swiggy tokens stored per org_id in connectors table. Never hardcode in env directly for production.
- SWIGGY_ACCESS_TOKEN in settings is for local dev / single-org testing only.

### Key env vars (Swiggy)
SWIGGY_ACCESS_TOKEN=  # your personal Swiggy OAuth token (dev only)
SWIGGY_ADDRESS_ID=    # your saved address ID from get_addresses

### Existing patterns to follow
- Redis caching: apps/api/app/infrastructure/cache/plan_cache.py
- Structured logging: apps/api/app/infrastructure/observability/
- Settings pattern: apps/api/app/core/settings.py (Pydantic BaseSettings)
- LangGraph state: apps/api/app/orchestration/state.py
