from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.api.schemas.runs import (
    DataHealthResponse,
    DataRange,
    FeedbackHealth,
    InventoryHealth,
    PlanningRunDetail,
    PlanningRunListResponse,
    ScenarioCoverage,
)
from app.domain.scenarios import list_scenarios
from app.domain.services.inventory_service import InventoryService
from app.domain.services.run_service import RunService
from app.infrastructure.db.models import (
    Feedback,
    Inventory,
    MenuItem,
    Order,
    Reservation,
    ReservationStatus,
    SentimentType,
)

router = APIRouter(tags=["runs"])


@router.get("/runs", response_model=PlanningRunListResponse)
def list_runs(
    limit: int = Query(default=25, ge=1, le=100),
    scenario: str | None = None,
    status: str | None = None,
    verdict: str | None = None,
    db: Session = Depends(get_db),
) -> PlanningRunListResponse:
    service = RunService(db)
    runs = service.list_runs(
        limit=limit,
        scenario=scenario,
        status=status,
        verdict=verdict,
    )
    return PlanningRunListResponse(runs=[service.to_summary(run) for run in runs])


@router.get("/runs/{run_id}", response_model=PlanningRunDetail)
def get_run(run_id: int, db: Session = Depends(get_db)) -> PlanningRunDetail:
    service = RunService(db)
    run = service.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Planning run not found.")
    return PlanningRunDetail(**service.to_detail(run))


@router.get("/data-health", response_model=DataHealthResponse)
def data_health(db: Session = Depends(get_db)) -> DataHealthResponse:
    order_min, order_max = db.query(func.min(Order.ordered_at), func.max(Order.ordered_at)).one()
    reservation_min, reservation_max = db.query(
        func.min(Reservation.reserved_at),
        func.max(Reservation.reserved_at),
    ).one()
    feedback_min, feedback_max = db.query(
        func.min(Feedback.created_at),
        func.max(Feedback.created_at),
    ).one()

    feedback_count = db.query(func.count(Feedback.id)).scalar() or 0
    negative = db.query(func.count(Feedback.id)).filter(Feedback.sentiment == SentimentType.negative).scalar() or 0
    positive = db.query(func.count(Feedback.id)).filter(Feedback.sentiment == SentimentType.positive).scalar() or 0
    neutral = db.query(func.count(Feedback.id)).filter(Feedback.sentiment == SentimentType.neutral).scalar() or 0

    inventory_items = db.query(Inventory).all()
    inventory_alerts = InventoryService(db=db, llm=None).compute_alerts(inventory_items)

    return DataHealthResponse(
        orders=DataRange(
            count=db.query(func.count(Order.id)).scalar() or 0,
            date_range=[_date(order_min), _date(order_max)],
        ),
        reservations=DataRange(
            count=db.query(func.count(Reservation.id)).scalar() or 0,
            date_range=[_date(reservation_min), _date(reservation_max)],
        ),
        feedback=FeedbackHealth(
            count=feedback_count,
            date_range=[_date(feedback_min), _date(feedback_max)],
            negative=negative,
            positive=positive,
            neutral=neutral,
            negative_pct=round((negative / feedback_count) * 100, 1) if feedback_count else 0,
        ),
        inventory=InventoryHealth(
            items=len(inventory_items),
            shortage_alerts=len(inventory_alerts["shortage_alerts"]),
            critical_shortages=sum(
                1
                for alert in inventory_alerts["shortage_alerts"]
                if alert.get("severity") == "critical"
            ),
            overstock_alerts=len(inventory_alerts["overstock_alerts"]),
        ),
        menu={"items": db.query(func.count(MenuItem.id)).scalar() or 0},
        scenario_coverage=_scenario_coverage(db),
    )


def _scenario_coverage(db: Session) -> list[ScenarioCoverage]:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    coverage = []
    for scenario in list_scenarios():
        target = _next_matching_service_date(today, scenario["default_weekday"])
        start = target.replace(hour=0, minute=0, second=0)
        end = target.replace(hour=23, minute=59, second=59)
        rows = db.query(Reservation).filter(
            Reservation.reserved_at >= start,
            Reservation.reserved_at <= end,
            Reservation.status.in_([
                ReservationStatus.confirmed,
                ReservationStatus.waitlist,
            ]),
        ).all()
        guests = sum(row.guest_count for row in rows)
        coverage.append(
            ScenarioCoverage(
                scenario=scenario["id"],
                label=scenario["label"],
                date=start.strftime("%Y-%m-%d"),
                reservations=len(rows),
                guests=guests,
                waitlist=sum(1 for row in rows if row.status == ReservationStatus.waitlist),
                occupancy_pct=round((guests / 70) * 100, 1),
            )
        )
    return coverage


def _next_matching_service_date(today: datetime, weekday: int) -> datetime:
    days_ahead = (weekday - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)


def _date(value) -> str | None:
    return value.date().isoformat() if value else None
