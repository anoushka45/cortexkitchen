# CortexKitchen — Infrastructure

This folder contains all local infrastructure configuration for CortexKitchen.

---

## Services

| Service    | Purpose                        | Local Port |
|------------|--------------------------------|------------|
| PostgreSQL | Primary relational database    | 5432       |
| Qdrant     | Vector memory (RAG)            | 6333       |
| Redis      | Cache + runtime state          | 6379       |

---

## Prerequisites

- Docker Desktop (v4.x or later)
- WSL 2 enabled and set as default
- Docker data directory moved to a drive with sufficient space

---

## Starting the stack

From the root of the repo:
```bash