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

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.settings import get_settings
from app.domain.services.inventory_service import InventoryService
from app.domain.services.run_service import RunService
from app.infrastructure.db.models import MenuItem, Organization
from app.infrastructure.swiggy.client import SwiggyMCPClient
from app.infrastructure.swiggy.enrichers.competitor import CompetitorEnricher
from app.infrastructure.swiggy.enrichers.occupancy import OccupancyEnricher
from app.infrastructure.swiggy.enrichers.procurement import ProcurementEnricher

router = APIRouter(prefix="/market", tags=["market"])


class PricingComparison(BaseModel):
    item: str
    area_avg: float
    your_price: float | None = None
    diff_pct: float | None = None   # always positive -- see `direction` for above/below
    direction: Literal["above", "below"] | None = None


class CompetitorDeal(BaseModel):
    restaurant: str
    deal_title: str
    discount: float
    code: str = ""


class PricingImpactItem(BaseModel):
    item: str
    our_price: float
    area_avg: float
    gap_pct: float
    direction: Literal["above", "below"]
    volume_change_pct: float
    weekly_revenue_impact_inr: float


class NamedDish(BaseModel):
    name: str
    price: float
    restaurant: str


class CategoryPricing(BaseModel):
    category: str
    your_avg: float
    area_avg: float
    diff_pct: float
    verdict: Literal["above", "below", "in line"]
    competitor_dishes_sampled: int
    cheapest_dish: NamedDish
    priciest_dish: NamedDish


class CompetitorLandscapeEntry(BaseModel):
    name: str
    rating: float
    total_ratings: str = ""
    cost_for_two: float
    distance_km: float
    delivery_time_range: str = ""
    cuisines: list[str] = []
    offer: str = ""
    veg: bool = False


class PositioningInsight(BaseModel):
    your_cost_for_two_estimate: float
    rank: int
    total: int
    cheaper_than_count: int
    pricier_than_count: int


class MenuBreadth(BaseModel):
    your_item_count: int
    competitor_avg_item_count: float
    competitors_sampled: int


class CuisineCrowding(BaseModel):
    cuisine: str
    matching_count: int
    total_checked: int


class VegMix(BaseModel):
    veg_count: int
    total: int


class CompetitorPricing(BaseModel):
    restaurants_checked: list[str]
    comparisons: list[PricingComparison]
    competitor_deals: list[CompetitorDeal] = []
    pricing_impact: list[PricingImpactItem] = []
    category_pricing: list[CategoryPricing] = []
    competitor_landscape: list[CompetitorLandscapeEntry] = []
    positioning: PositioningInsight | None = None
    menu_breadth: MenuBreadth | None = None
    cuisine_crowding: CuisineCrowding | None = None
    veg_mix: VegMix | None = None
    fetched_at: str | None = None


class CompetitorDineoutDeal(BaseModel):
    name: str
    deals: list[dict]
    amenities: list[str] = []
    timings: str = ""


class SlotDeal(BaseModel):
    time: str
    deal_title: str
    discount_pct: float
    is_free: bool


class SlotAvailability(BaseModel):
    time: str
    avg_availability: float
    signal: Literal["HIGH", "MEDIUM", "LOW"]


class AreaOccupancy(BaseModel):
    signal: Literal["HIGH", "MEDIUM", "LOW"] | None = None
    tonight_busy: bool | None = None
    competitors_checked: int = 0
    competitor_dineout_deals: list[CompetitorDineoutDeal] = []
    slot_deals_found: list[SlotDeal] = []
    slot_availability_by_time: list[SlotAvailability] = []
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
        {"name": item.name, "price": item.price, "category": item.category}
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

        # Show EVERY competitor dish found (up to a display cap), not just the handful
        # that happen to exact-string-match one of our own item names -- "competitor
        # pricing across all dishes" means all dishes, matched or not. Matched dishes
        # (our_price present) surface first so the actionable comparisons lead.
        comparisons: list[PricingComparison] = []
        for dish, avg_price in area_avg.items():
            if not avg_price:
                continue
            our_price = our_price_by_name.get(dish)
            if our_price is not None:
                raw_diff_pct = (our_price - avg_price) / avg_price * 100
                comparisons.append(PricingComparison(
                    item=dish.title(),
                    area_avg=avg_price,
                    your_price=our_price,
                    diff_pct=round(abs(raw_diff_pct), 1),
                    direction="above" if raw_diff_pct >= 0 else "below",
                ))
            else:
                comparisons.append(PricingComparison(item=dish.title(), area_avg=avg_price))

        comparisons.sort(key=lambda c: (c.your_price is None, -(c.diff_pct or 0), -c.area_avg))
        comparisons = comparisons[:40]

        positioning_data = competitor_ctx.get("positioning")

        competitor_pricing = CompetitorPricing(
            restaurants_checked=competitor_ctx.get("restaurants") or [],
            comparisons=comparisons,
            competitor_deals=[
                CompetitorDeal(**deal) for deal in (competitor_ctx.get("competitor_deals") or [])
            ],
            pricing_impact=[
                PricingImpactItem(**impact) for impact in (competitor_ctx.get("pricing_impact") or [])
            ],
            category_pricing=[
                CategoryPricing(**cat) for cat in (competitor_ctx.get("category_pricing") or [])
            ],
            competitor_landscape=[
                CompetitorLandscapeEntry(**e) for e in (competitor_ctx.get("competitor_landscape") or [])
            ],
            positioning=PositioningInsight(**positioning_data) if positioning_data else None,
            menu_breadth=MenuBreadth(**competitor_ctx["menu_breadth"]) if competitor_ctx.get("menu_breadth") else None,
            cuisine_crowding=CuisineCrowding(**competitor_ctx["cuisine_crowding"]) if competitor_ctx.get("cuisine_crowding") else None,
            veg_mix=VegMix(**competitor_ctx["veg_mix"]) if competitor_ctx.get("veg_mix") else None,
            fetched_at=competitor_ctx.get("fetched_at"),
        )

    area_occupancy = None
    if occupancy_ctx:
        area_occupancy = AreaOccupancy(
            signal=occupancy_ctx.get("occupancy_signal"),
            tonight_busy=occupancy_ctx.get("tonight_busy"),
            competitors_checked=occupancy_ctx.get("competitors_checked") or 0,
            competitor_dineout_deals=[
                CompetitorDineoutDeal(**d) for d in (occupancy_ctx.get("competitor_dineout_deals") or [])
            ],
            slot_deals_found=[
                SlotDeal(**d) for d in (occupancy_ctx.get("slot_deals_found") or [])
            ],
            slot_availability_by_time=[
                SlotAvailability(**s) for s in (occupancy_ctx.get("slot_availability_by_time") or [])
            ],
            fetched_at=occupancy_ctx.get("fetched_at"),
        )

    # NOTE: your_go_to_items (Instamart "frequent reorder" data) is deliberately not
    # used here or anywhere else on this page. It returns the PERSONAL Swiggy consumer
    # account's own purchase history (seen live: pet food, personal groceries) — not
    # restaurant procurement data. See CLAUDE.md's Swiggy MCP consumer-data warning.
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


# ── Live ingredient price lookup (on-demand, not cached) ───────────────────────

class IngredientSearchResult(BaseModel):
    name: str
    category: str
    price: float
    unit: str
    in_stock: bool


class IngredientSearchResponse(BaseModel):
    swiggy_connected: bool
    query: str
    results: list[IngredientSearchResult] = []


@router.get("/ingredient-search", response_model=IngredientSearchResponse)
async def search_ingredient(
    query: str = Query(..., min_length=1, max_length=80),
    current: dict = Depends(get_current_user),
) -> IngredientSearchResponse:
    """On-demand Instamart search — owner types an ingredient, sees live price/stock.

    Independent of shortage computation, unlike the shortage-driven procurement list
    in /market/pulse. Not cached — this is an explicit user action, freshness matters
    more than avoiding a repeat Swiggy call for the exact same query.
    """
    client = SwiggyMCPClient()
    if not client.is_available():
        return IngredientSearchResponse(swiggy_connected=False, query=query)

    address_id = get_settings().swiggy_address_id or ""
    results = await ProcurementEnricher(client).search_live(address_id, query)

    return IngredientSearchResponse(
        swiggy_connected=True,
        query=query,
        results=[
            IngredientSearchResult(
                name=r["name"], category=r["category"], price=r["price"],
                unit=r["unit"], in_stock=r["inStock"],
            )
            for r in (results or [])
        ],
    )


# ── Price trends across past planning runs (P6-MI11) ──────────────────────────
# No new Swiggy calls — reads market_intel already stored in each PlanningRun's
# final_response, so this is free to call on every /market page load.

class PricePoint(BaseModel):
    date: str
    area_avg: float


class OccupancyPoint(BaseModel):
    date: str
    signal: Literal["HIGH", "MEDIUM", "LOW"]


class MarketTrendsResponse(BaseModel):
    price_trends: dict[str, list[PricePoint]] = {}
    occupancy_trend: list[OccupancyPoint] = []
    days_returned: int
    note: str | None = None


@router.get("/trends", response_model=MarketTrendsResponse)
async def get_market_trends(
    days: int = Query(default=7, ge=1, le=90),
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MarketTrendsResponse:
    # Scan a generous window of recent runs since not every run necessarily has
    # market_intel data (Swiggy unavailable, cache miss, etc) — we want up to
    # `days` runs that actually carry it, not just the last `days` runs overall.
    runs = RunService(db).list_runs(current["org_id"], limit=max(days * 3, 30))

    price_series: dict[str, list[PricePoint]] = {}
    occupancy_series: list[OccupancyPoint] = []
    points_collected = 0

    for run in runs:
        if points_collected >= days:
            break

        market_intel = (run.final_response or {}).get("market_intel") or {}
        area_avg = market_intel.get("competitor_pricing") or {}
        occupancy_signal = market_intel.get("area_occupancy")
        run_date = market_intel.get("fetched_at") or run.target_date or (
            run.created_at.date().isoformat() if run.created_at else None
        )

        if not run_date or (not area_avg and not occupancy_signal):
            continue

        for dish, avg_price in area_avg.items():
            price_series.setdefault(dish, []).append(
                PricePoint(date=run_date, area_avg=float(avg_price))
            )

        if occupancy_signal in ("HIGH", "MEDIUM", "LOW"):
            occupancy_series.append(OccupancyPoint(date=run_date, signal=occupancy_signal))

        points_collected += 1

    # Runs are newest-first from list_runs(); flip to chronological order for charting.
    for points in price_series.values():
        points.reverse()
    occupancy_series.reverse()

    note = None
    if points_collected < 3:
        note = "Run 3+ plans with Swiggy market intelligence enabled to see pricing trends."

    return MarketTrendsResponse(
        price_trends=price_series,
        occupancy_trend=occupancy_series,
        days_returned=points_collected,
        note=note,
    )
