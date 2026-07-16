# Scripts

Project utility scripts for seeding, local setup, and eval dataset management.

## Scripts

| Script | Purpose |
|--------|---------|
| `seed_demo_data.py` | Seeds the full relational demo dataset: orders, reservations, feedback, inventory, menu items. Dates and random seed are computed relative to script run-time, not hardcoded calendar dates, so a reseed always anchors to "today" and inventory shortages, popular dishes, and RAG memory content vary day to day instead of being fixed forever |
| `seed_qdrant_memory.py` | Loads complaint patterns and SOP-style memory into Qdrant (`complaints_memory` collection) |
| `test_qdrant_retrieval.py` | Quick retrieval sanity check: verifies Qdrant is seeded and returning results |
| `build_golden_dataset.py` | Builds the `cortexkitchen-golden-v1` LangSmith regression eval dataset from approved planning runs |
| `build_ragas_dataset.py` | Extracts RAGAS eval candidate samples from real planning runs; output is not yet promoted into the golden fixtures |
| `build_deepeval_dataset.py` | Extracts DeepEval eval candidate samples from real planning runs; output is not yet promoted into the golden fixtures |
| `get_swiggy_token.py` | Refreshes the dev-only Swiggy OAuth access token (5-day TTL) |

## Typical usage

Run from the repository root after Docker services are up and the API virtual environment is activated.

```bash
cd apps/api
venv\Scripts\activate   # Windows
# or: source venv/bin/activate  (macOS/Linux)

python ..\..\scripts\seed_demo_data.py
python ..\..\scripts\seed_qdrant_memory.py
```

## Expected output after seeding

- Several months of historical orders, anchored to the run date, not a fixed calendar range
- Reservations for the next roughly 2.5 months, matched to each scenario's weekday pattern
- Feedback records spanning positive, negative, and neutral sentiment
- 18 inventory items, with 1 to 4 randomly selected to run low each seed day (varies day to day, not a fixed set of ingredients)
- 27 menu items
- Qdrant `complaints_memory` collection populated with complaint embeddings

## Reset everything

```bash
docker compose down -v   # wipe all persistent volumes
docker compose up -d     # restart fresh
# then re-run seed scripts
```
