# CortexKitchen Infrastructure

Local infrastructure for CortexKitchen. All services run via Docker Compose.

Last updated: June 2026.

## Services

| Service | Purpose | Port |
|---------|---------|------|
| PostgreSQL 16 | Primary relational data store — all structured data, planning runs, auth | 5432 |
| Qdrant | Vector memory for complaint RAG and SOP retrieval | 6333 (REST), 6334 (gRPC) |
| Redis 7 | Plan cache (1hr TTL by scenario + date) | 6379 |

## Start the stack

```bash
docker compose up -d
```

## Stop the stack

```bash
docker compose down
```

## Reset all data

```bash
docker compose down -v   # removes persistent volumes
docker compose up -d
# then re-run seed scripts
```

Persistent Docker volumes (`postgres_data`, `qdrant_data`, `redis_data`) are defined in `docker-compose.yml`. Data survives normal container restarts — only `down -v` wipes it.

## Notes

- This is a local development stack, not a production deployment
- Redis is actively used for plan caching in Phase 5 (1hr TTL by `org_id + scenario + date`)
- Qdrant uses a shared collection with `org_id` payload filters for multi-tenant isolation
- PostgreSQL uses `org_id` column scoping on all run and settings queries
