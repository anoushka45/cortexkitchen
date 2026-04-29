# Scripts

Project utility scripts for seeding and local retrieval checks.

## Current scripts

- `seed_demo_data.py` - seeds the relational demo dataset
- `seed_qdrant_memory.py` - loads complaint and SOP-style memory into Qdrant
- `test_qdrant_retrieval.py` - quick retrieval sanity check script

## Typical usage

Run these from the repository root after the Docker services are up and the API environment is configured.

Example:

```bash
cd apps/api
venv\Scripts\python ..\..\scripts\seed_demo_data.py
venv\Scripts\python ..\..\scripts\seed_qdrant_memory.py
```
