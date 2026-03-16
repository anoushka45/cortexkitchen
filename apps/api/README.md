# CortexKitchen API

FastAPI backend for CortexKitchen.

## Current Scope
Phase 1 API scaffold:
- app bootstrapping
- settings/config
- health endpoints
- dependency health placeholders
- base error handling

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload


Available endpoints

/

/api/v1/health

/api/v1/health/dependencies