# CortexKitchen Infrastructure

This folder documents the local infrastructure used by CortexKitchen.

## Local services

| Service | Purpose | Port |
| --- | --- | --- |
| PostgreSQL | Primary relational data store | 5432 |
| Qdrant | Vector memory and retrieval | 6333 |
| Redis | Cache and short-term runtime support | 6379 |

## Start the stack

From the repository root:

```bash
docker compose up -d
```

## Stop the stack

```bash
docker compose down
```

## Ports

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5432 | |
| Qdrant REST | 6333 | Primary API port |
| Qdrant gRPC | 6334 | |
| Redis | 6379 | |

## Notes

- This is a local development stack, not a production deployment layout.
- Persistent Docker volumes (`postgres_data`, `qdrant_data`, `redis_data`) are defined in `docker-compose.yml`. Data survives container restarts.
- To reset all data: `docker compose down -v` then re-run the seed scripts.
