# Scripts

Project utility scripts for seeding and local setup.

Last updated: June 2026.

## Scripts

| Script | Purpose |
|--------|---------|
| `seed_demo_data.py` | Seeds the full relational demo dataset — orders, reservations, feedback, inventory, menu items |
| `seed_qdrant_memory.py` | Loads complaint patterns and SOP-style memory into Qdrant (`complaints_memory` collection) |
| `test_qdrant_retrieval.py` | Quick retrieval sanity check — verifies Qdrant is seeded and returning results |

Note: `build_golden_dataset.py` (the LangSmith regression eval dataset builder) lives in `apps/api/scripts/`.

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

- ~6500 orders across Jan–May 2026
- ~1200 reservations with scenario-matched pressure dates
- ~160 feedback records (positive + negative + neutral)
- 18 inventory items with shortage and overstock signals
- 27 menu items
- Qdrant `complaints_memory` collection populated with complaint embeddings

## Reset everything

```bash
docker compose down -v   # wipe all persistent volumes
docker compose up -d     # restart fresh
# then re-run seed scripts
```
