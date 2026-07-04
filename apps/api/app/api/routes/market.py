"""market.py — live market intelligence, independent of any planning run.

GET /api/v1/market/pulse fetches current Swiggy market data (competitor
pricing, area demand, Instamart procurement) directly via the enrichers used
inside the planning pipeline, but without requiring a plan to be run first.
Each enricher already caches its own result in Redis for 30 minutes (keyed by
org_id + date), so calling this endpoint repeatedly (e.g. every dashboard
load) does not re-hit the Swiggy MCP server each time.
"""

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.domain.services.inventory_service import InventoryService
from app.infrastructure.db.models import MenuItem, Organization
from app.infrastructure.swiggy.client import SwiggyMCPClient
from app.infrastructure.swiggy.enrichers.competitor import CompetitorEnricher
from app.infrastructure.swiggy.enrichers.occupancy import OccupancyEnricher
from app.infrastructure.swiggy.enrichers.procurement import ProcurementEnricher

router = APIRouter(prefix="/market", tags=["market"])


class PricingComparison(BaseModel):
    item: str
    your_price: float
    area_avg: float
    diff_pct: float   # always positive -- see `direction` for above/below
    direction: Literal["above", "below"]


class CompetitorPricing(BaseModel):
    restaurants_checked: list[str]
    comparisons: list[PricingComparison]
    fetched_at: str | None = None


class AreaOccupancy(BaseModel):
    signal: Literal["HIGH", "MEDIUM", "LOW"] | None = None
    tonight_busy: bool | None = None
    competitors_checked: int = 0
    fetched_at: str | None = None


class ProcurementItem(BaseModel):
    name: str
    price: float
    unit: str
    in_stock: bool


class MarketPulseResponse(BaseModel):
    swiggy_connected: bool
    competitor_pricing: CompetitorPricing | None = None
    area_occupancy: AreaOccupancy | None = None
    procurement: list[ProcurementItem] = []


@router.get("/pulse", response_model=MarketPulseResponse)
async def get_market_pulse(
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MarketPulseResponse:
    client = SwiggyMCPClient()
    if not client.is_available():
        return MarketPulseResponse(swiggy_connected=False)

    org = db.query(Organization).filter(Organization.id == current["org_id"]).first()
    cuisine = (org.settings or {}).get("cuisine_type", "restaurant") if org else "restaurant"

    our_items = [
        {"name": item.name, "price": item.price}
        for item in db.query(MenuItem).filter(MenuItem.is_available.is_(True)).all()
    ]

    inventory_service = InventoryService(db=db, llm=None)
    shortage_data = await inventory_service.compute_shortage_data()
    shortage_names = [
        alert["ingredient"]
        for alert in shortage_data["actionable_shortages"]
        if isinstance(alert, dict) and alert.get("ingredient")
    ]

    context = {"org_id": current["org_id"], "cuisine": cuisine, "our_items": our_items}

    competitor_ctx, occupancy_ctx = await asyncio.gather(
        CompetitorEnricher(client).enrich(context),
        OccupancyEnricher(client).enrich(context),
    )

    procurement_ctx = None
    if shortage_names:
        procurement_ctx = await ProcurementEnricher(client).enrich({
            "org_id": current["org_id"],
            "shortage_items": shortage_names,
        })

    competitor_pricing = None
    if competitor_ctx:
        area_avg = competitor_ctx.get("area_avg") or {}
        our_price_by_name = {str(i["name"]).strip().lower(): i["price"] for i in our_items}

        comparisons: list[PricingComparison] = []
        for dish, avg_price in area_avg.items():
            our_price = our_price_by_name.get(dish)
            if our_price is None or not avg_price:
                continue
            raw_diff_pct = (our_price - avg_price) / avg_price * 100
            comparisons.append(PricingComparison(
                item=dish.title(),
                your_price=our_price,
                area_avg=avg_price,
                diff_pct=round(abs(raw_diff_pct), 1),
                direction="above" if raw_diff_pct >= 0 else "below",
            ))
        comparisons.sort(key=lambda c: c.diff_pct, reverse=True)

        competitor_pricing = CompetitorPricing(
            restaurants_checked=competitor_ctx.get("restaurants") or [],
            comparisons=comparisons[:8],
            fetched_at=competitor_ctx.get("fetched_at"),
        )

    area_occupancy = None
    if occupancy_ctx:
        area_occupancy = AreaOccupancy(
            signal=occupancy_ctx.get("occupancy_signal"),
            tonight_busy=occupancy_ctx.get("tonight_busy"),
            competitors_checked=occupancy_ctx.get("competitors_checked") or 0,
            fetched_at=occupancy_ctx.get("fetched_at"),
        )

    procurement: list[ProcurementItem] = []
    if procurement_ctx:
        for opt in procurement_ctx.get("procurement_options") or []:
            procurement.append(ProcurementItem(
                name=str(opt.get("ingredient", "")).title(),
                price=float(opt.get("price") or 0),
                unit=str(opt.get("unit") or ""),
                in_stock=bool(opt.get("inStock", False)),
            ))

    return MarketPulseResponse(
        swiggy_connected=True,
        competitor_pricing=competitor_pricing,
        area_occupancy=area_occupancy,
        procurement=procurement,
    )
