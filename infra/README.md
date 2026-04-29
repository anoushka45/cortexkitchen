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

## Notes

- This is a local development stack, not a production deployment layout.
- Persistent Docker volumes are defined in the root `docker-compose.yml`.
