"""
CortexKitchen — demo data seed (v4, date-relative)

Changes vs v3:
- All dates are computed relative to script run-time (SEED_AS_OF = now()),
  not hardcoded literal 2026 calendar dates. Re-running this script always
  produces a dataset anchored to "today," so scenario_coverage, the demand
  forecast history, and reservation waitlists stay live indefinitely instead
  of going stale once the calendar rolls past a fixed future window.
- Future reservation targets are computed with the same weekday-matching
  logic the backend uses (_next_matching_service_date in runs.py), for
  10 upcoming occurrences per scenario (~2.5 months), so "Plan tonight"
  always has real reservation data to react to no matter when this runs.
- Inventory rebalanced: 3 of 18 items genuinely low (was 11 of 18 -- a
  permanent, date-independent shortage state), so "running low" reads as
  a real signal instead of fixed lore.
"""

import os
import random
import sys
from datetime import datetime, timedelta

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")),
)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.domain.scenarios import list_scenarios
from app.infrastructure.db.models import (
    ActionQueue,
    ActionStatus,
    ActionTier,
    CriticVerdict,
    DecisionLog,
    Expense,
    ExpenseCategory,
    ExpenseRecurrence,
    Feedback,
    FeedbackSource,
    Inventory,
    MenuItem,
    Order,
    PlanningRun,
    Reservation,
    ReservationStatus,
    SentimentType,
    Vendor,
    VendorPriceQuote,
)

DATABASE_URL = "postgresql://cortex:cortexpass@localhost:5432/cortexkitchen"
SEED_AS_OF   = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)
HISTORY_DAYS = 161   # ~23 weeks of trailing history, ending today

SCENARIO_WEEKDAY = {s["id"]: s["default_weekday"] for s in list_scenarios()}  # Mon=0..Sun=6
FUTURE_OCCURRENCES = 10  # ~2.5 months of upcoming weekly targets per scenario


def fmt(d: datetime) -> str:
    return f"{d.strftime('%b')} {d.day}"


def recent_weekday_dates(anchor: datetime, weekday: int, n: int) -> list[datetime]:
    """n dates matching `weekday`, most recent strictly before/on anchor first,
    spaced a week apart, returned oldest-first."""
    delta = (anchor.weekday() - weekday) % 7
    if delta == 0:
        delta = 7
    most_recent = anchor - timedelta(days=delta)
    return [most_recent - timedelta(weeks=i) for i in range(n)][::-1]


def upcoming_weekday_dates(anchor: datetime, weekday: int, n: int) -> list[datetime]:
    """n future dates matching `weekday`, strictly after anchor, weekly cadence,
    soonest-first -- mirrors _next_matching_service_date in runs.py."""
    days_ahead = (weekday - anchor.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    first = anchor + timedelta(days=days_ahead)
    return [first + timedelta(weeks=i) for i in range(n)]


# ── Historical Friday peaks — last 9 Fridays before today ───────────────────
FRIDAY_PEAK_DATES  = recent_weekday_dates(SEED_AS_OF, weekday=4, n=9)
FRIDAY_PEAK_COUNTS = [138, 127, 108, 119, 131, 112, 122, 108, 115]
FRIDAY_PEAKS = dict(zip(FRIDAY_PEAK_DATES, FRIDAY_PEAK_COUNTS))

# ── Historical weekday-lunch peaks — alternating Tue/Wed over ~8 weeks ──────
_lunch_dates = sorted(
    recent_weekday_dates(SEED_AS_OF, weekday=1, n=8) + recent_weekday_dates(SEED_AS_OF, weekday=2, n=8)
)[-15:]
WEEKDAY_LUNCH_COUNTS = [48, 52, 44, 49, 46, 51, 43, 47, 41, 49, 43, 45, 38, 50, 44]
WEEKDAY_LUNCH_PEAKS  = dict(zip(_lunch_dates, WEEKDAY_LUNCH_COUNTS))

# ── Historical holiday-style spikes — three one-off dates in the trailing history
HOLIDAY_PEAK_DATES  = [
    SEED_AS_OF - timedelta(weeks=10, days=3),
    SEED_AS_OF - timedelta(weeks=6, days=1),
    SEED_AS_OF - timedelta(weeks=1, days=2),
]
HOLIDAY_PEAK_COUNTS = [88, 94, 105]
HOLIDAY_PEAKS = dict(zip(HOLIDAY_PEAK_DATES, HOLIDAY_PEAK_COUNTS))

# ── Future planning window — next 10 occurrences per scenario ──────────────
FUTURE_SCENARIO_TARGETS = {
    scenario_id: upcoming_weekday_dates(SEED_AS_OF, weekday, FUTURE_OCCURRENCES)
    for scenario_id, weekday in SCENARIO_WEEKDAY.items()
}

engine  = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()
random.seed(42)


# ── Hour distributions ───────────────────────────────────────────────────────

def hour_friday() -> int:
    return random.choices(
        [12, 13, 14, 17, 18, 19, 20, 21, 22],
        weights=[3,  4,  3,  4, 14, 20, 20, 16,  8],
    )[0]

def hour_weekend() -> int:
    return random.choices(
        [11, 12, 13, 14, 18, 19, 20, 21],
        weights=[4,  8,  9,  6,  8, 13, 14, 10],
    )[0]

def hour_weekday_lunch() -> int:
    return random.choices(
        [12, 13, 14, 15, 19, 20, 21],
        weights=[22, 30, 18,  8,  6,  9,  7],
    )[0]

def hour_holiday() -> int:
    return random.choices(
        [12, 13, 17, 18, 19, 20, 21, 22],
        weights=[5,  4,  6, 14, 20, 22, 16,  8],
    )[0]

def hour_generic_weekday() -> int:
    return random.choices(
        [12, 13, 14, 19, 20, 21],
        weights=[15, 18, 10, 20, 22, 15],
    )[0]


print("Seeding CortexKitchen v4 demo data (date-relative)...")
print(f"  As-of : {SEED_AS_OF.date()} | History: {HISTORY_DAYS} days")

# ── Clear ────────────────────────────────────────────────────────────────────
session.query(DecisionLog).delete()
session.query(PlanningRun).delete()
session.query(Feedback).delete()
session.query(Order).delete()
session.query(Reservation).delete()
session.query(Inventory).delete()
session.query(MenuItem).delete()
session.query(Expense).delete()
session.query(ActionQueue).delete()
session.query(VendorPriceQuote).delete()
session.query(Vendor).delete()
session.commit()
print("  Cleared existing data")


# ── 1. Menu items ─────────────────────────────────────────────────────────────
# cost_price is an estimated per-unit production cost (~25-40% food-cost ratio,
# varying by category -- pizzas/burgers run higher due to cheese/meat, beverages
# and desserts run lower). Used to compute COGS/profit on the dashboard until
# ingredient-level recipe costing (Option B) replaces it.
menu_items = [
    MenuItem(name="Margherita",           category="pizza",    price=349.0, cost_price=115.0, is_available=True),
    MenuItem(name="Pepperoni Feast",       category="pizza",    price=449.0, cost_price=162.0, is_available=True),
    MenuItem(name="BBQ Chicken",           category="pizza",    price=499.0, cost_price=175.0, is_available=True),
    MenuItem(name="Veggie Supreme",        category="pizza",    price=399.0, cost_price=120.0, is_available=True),
    MenuItem(name="Four Cheese",           category="pizza",    price=479.0, cost_price=182.0, is_available=True),
    MenuItem(name="Spicy Paneer",          category="pizza",    price=429.0, cost_price=137.0, is_available=True),
    MenuItem(name="Mushroom Truffle",      category="pizza",    price=529.0, cost_price=212.0, is_available=True),
    MenuItem(name="Chicken Tikka Pizza",   category="pizza",    price=499.0, cost_price=175.0, is_available=True),
    MenuItem(name="Penne Arrabbiata",      category="pasta",    price=299.0, cost_price=84.0,  is_available=True),
    MenuItem(name="Spaghetti Carbonara",   category="pasta",    price=349.0, cost_price=112.0, is_available=True),
    MenuItem(name="Pesto Fusilli",         category="pasta",    price=329.0, cost_price=99.0,  is_available=True),
    MenuItem(name="Cacio e Pepe",          category="pasta",    price=369.0, cost_price=111.0, is_available=True),
    MenuItem(name="Classic Smash Burger",  category="burger",   price=349.0, cost_price=122.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger", category="burger",   price=329.0, cost_price=112.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger", category="burger",   price=369.0, cost_price=133.0, is_available=True),
    MenuItem(name="Garlic Bread",          category="sides",    price=149.0, cost_price=37.0,  is_available=True),
    MenuItem(name="Loaded Fries",          category="sides",    price=179.0, cost_price=50.0,  is_available=True),
    MenuItem(name="Onion Rings",           category="sides",    price=159.0, cost_price=40.0,  is_available=True),
    MenuItem(name="Caesar Salad",          category="sides",    price=249.0, cost_price=75.0,  is_available=True),
    MenuItem(name="Tiramisu",              category="dessert",  price=229.0, cost_price=64.0,  is_available=True),
    MenuItem(name="Nutella Pizza",         category="dessert",  price=279.0, cost_price=89.0,  is_available=True),
    MenuItem(name="Chocolate Brownie",     category="dessert",  price=199.0, cost_price=50.0,  is_available=True),
    MenuItem(name="Classic Lemonade",      category="beverage", price=99.0,  cost_price=15.0,  is_available=True),
    MenuItem(name="Nutella Milkshake",     category="beverage", price=179.0, cost_price=39.0,  is_available=True),
    MenuItem(name="Coca Cola",             category="beverage", price=79.0,  cost_price=9.0,   is_available=True),
    MenuItem(name="Mango Smoothie",        category="beverage", price=149.0, cost_price=30.0,  is_available=True),
    MenuItem(name="Iced Coffee",           category="beverage", price=129.0, cost_price=23.0,  is_available=True),
]
session.add_all(menu_items)
session.commit()
print(f"  Added {len(menu_items)} menu items")


# ── 2. Inventory — realistic mix, 3 of 18 genuinely low ─────────────────────
inventory_items = [
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg",    quantity_in_stock=2.6,   reorder_threshold=8.0,  spoilage_risk=True),   # low
    Inventory(ingredient_name="Pizza Dough",        unit="kg",    quantity_in_stock=13.5,  reorder_threshold=10.0, spoilage_risk=True),
    Inventory(ingredient_name="Pepperoni",          unit="kg",    quantity_in_stock=6.8,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Fresh Basil",        unit="kg",    quantity_in_stock=0.35,  reorder_threshold=1.0,  spoilage_risk=True),   # low
    Inventory(ingredient_name="Burger Buns",        unit="units", quantity_in_stock=48.0,  reorder_threshold=20.0, spoilage_risk=True),
    Inventory(ingredient_name="Garlic",             unit="kg",    quantity_in_stock=0.9,   reorder_threshold=1.5,  spoilage_risk=True),   # low
    Inventory(ingredient_name="Pasta (dry)",        unit="kg",    quantity_in_stock=14.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Cream (cooking)",    unit="litres",quantity_in_stock=7.5,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Caesar Dressing",    unit="litres",quantity_in_stock=4.2,   reorder_threshold=2.0,  spoilage_risk=True),
    Inventory(ingredient_name="Tomato Sauce",       unit="litres",quantity_in_stock=16.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Chicken",            unit="kg",    quantity_in_stock=13.5,  reorder_threshold=6.0,  spoilage_risk=True),
    Inventory(ingredient_name="Paneer",             unit="kg",    quantity_in_stock=6.0,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil",          unit="litres",quantity_in_stock=9.0,   reorder_threshold=3.0,  spoilage_risk=False),
    Inventory(ingredient_name="Nutella",            unit="kg",    quantity_in_stock=4.5,   reorder_threshold=2.0,  spoilage_risk=False),
    Inventory(ingredient_name="Coca Cola Cans",     unit="units", quantity_in_stock=420.0, reorder_threshold=40.0, spoilage_risk=False),
    Inventory(ingredient_name="Tiramisu Cream",     unit="kg",    quantity_in_stock=9.0,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Mango Pulp",         unit="kg",    quantity_in_stock=6.0,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Cold Brew Coffee",   unit="litres",quantity_in_stock=5.5,   reorder_threshold=3.0,  spoilage_risk=True),
]
session.add_all(inventory_items)
session.commit()
print(f"  Added {len(inventory_items)} inventory items")


# ── 3. Reservations ───────────────────────────────────────────────────────────
ALL_GUEST_NAMES = [
    "Priya Sharma",  "Rohan Mehta",    "Ananya Singh",  "Arjun Patel",
    "Sneha Iyer",    "Vikram Nair",    "Pooja Desai",   "Karan Malhotra",
    "Isha Joshi",    "Dev Kapoor",     "Riya Verma",    "Aditya Rao",
    "Meera Shah",    "Kabir Sethi",    "Naina Kapoor",  "Sahil Bhatia",
    "Tanya Gupta",   "Rahul Sharma",   "Divya Menon",   "Nikhil Jain",
    "Sanya Bose",    "Aman Khanna",    "Kavya Pillai",  "Rohit Shetty",
]

reservations = []
base_date = SEED_AS_OF - timedelta(days=HISTORY_DAYS)

for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    d = current_date.date()
    is_friday  = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]
    is_weekday_lunch_peak = d in {dt.date() for dt in WEEKDAY_LUNCH_PEAKS}
    is_holiday = d in {dt.date() for dt in HOLIDAY_PEAKS if HOLIDAY_PEAKS[dt] > 0}

    if   d in {dt.date() for dt in FRIDAY_PEAKS}:   count = random.randint(14, 18)
    elif is_holiday:                                  count = random.randint(14, 18)
    elif is_weekday_lunch_peak:                       count = random.randint(9, 12)
    elif is_friday:                                   count = random.randint(10, 14)
    elif is_weekend:                                  count = random.randint(6, 10)
    else:                                             count = random.randint(3, 6)

    for _ in range(count):
        if is_friday or is_weekend or is_holiday:
            hour = random.choice([13, 18, 19, 20, 21])
        elif is_weekday_lunch_peak:
            hour = random.choice([12, 12, 13, 13, 14, 19, 20])
        else:
            hour = random.choice([13, 19, 20])

        status = random.choices(
            [ReservationStatus.confirmed, ReservationStatus.completed,
             ReservationStatus.cancelled,  ReservationStatus.waitlist],
            weights=[15, 65, 10, 10],
        )[0]

        reservations.append(Reservation(
            guest_name   = random.choice(ALL_GUEST_NAMES),
            guest_count  = random.randint(2, 8) if is_holiday else random.randint(2, 6),
            reserved_at  = current_date.replace(hour=hour, minute=random.choice([0, 15, 30, 45])),
            status       = status,
            table_number = random.randint(1, 15),
            notes        = random.choice([
                None, None, None, None,
                "Window seat please", "Birthday celebration",
                "Office lunch", "Anniversary dinner", "Large group — need extra chairs",
                "Allergic to nuts", "Business meeting", "Family celebration",
            ]),
        ))


# ── Future reservations ──────────────────────────────────────────────────────
FUTURE_NAMES = [
    ("Priya Sharma", 4),   ("Rohan Mehta", 2),    ("Ananya Singh", 6),
    ("Arjun Patel",  3),   ("Sneha Iyer",  5),    ("Vikram Nair",  2),
    ("Pooja Desai",  4),   ("Karan Malhotra", 8), ("Isha Joshi",   2),
    ("Dev Kapoor",   3),   ("Riya Verma",  4),    ("Aditya Rao",   6),
    ("Meera Shah",   5),   ("Kabir Sethi", 4),    ("Naina Kapoor", 3),
    ("Sahil Bhatia", 6),   ("Tanya Gupta", 2),    ("Rahul Sharma", 4),
    ("Divya Menon",  5),   ("Nikhil Jain", 3),
]

def make_future_res(target, count, waitlist_from, hour_choices, notes_choices, guest_adj=0):
    out = []
    for idx, (name, guests) in enumerate(FUTURE_NAMES[:count]):
        out.append(Reservation(
            guest_name   = name,
            guest_count  = max(2, guests + guest_adj),
            reserved_at  = target.replace(
                hour=random.choice(hour_choices),
                minute=random.choice([0, 15, 30, 45]),
            ),
            status = ReservationStatus.waitlist if idx >= waitlist_from else ReservationStatus.confirmed,
            table_number = random.randint(1, 15),
            notes = random.choice(notes_choices),
        ))
    return out

# Friday Rush — first + third occurrence seeded high-occupancy (>90%, triggers Diff 2)
FRIDAY_RUSH_CONFIGS = [
    dict(count=18, waitlist_from=15, hours=[18, 19, 19, 20, 20, 21],
         notes=[None, "Birthday celebration", "Window seat please", "Anniversary dinner", "Corporate dinner"], guest_adj=2),
    dict(count=13, waitlist_from=11, hours=[18, 19, 20, 21],
         notes=[None, None, "Festive dinner", "Birthday celebration"], guest_adj=0),
    dict(count=17, waitlist_from=14, hours=[18, 19, 19, 20, 20, 21],
         notes=[None, "Anniversary dinner", "Birthday celebration", "Corporate event", "Window seat please"], guest_adj=2),
    dict(count=12, waitlist_from=10, hours=[18, 19, 20, 21],
         notes=[None, None, "Birthday celebration", "Window seat please"], guest_adj=0),
]
DEFAULT_FRIDAY_CONFIG = dict(count=11, waitlist_from=9, hours=[18, 19, 20, 21],
    notes=[None, None, "Birthday celebration", "Window seat please"], guest_adj=0)

WEEKDAY_LUNCH_CONFIGS = [
    dict(count=9,  waitlist_from=8,  hours=[12, 13, 14], guest_adj=-1),
    dict(count=10, waitlist_from=8,  hours=[12, 13, 14], guest_adj=-1),
    dict(count=9,  waitlist_from=8,  hours=[12, 13, 14], guest_adj=-1),
    dict(count=11, waitlist_from=9,  hours=[12, 13, 14], guest_adj=-1),
    dict(count=9,  waitlist_from=8,  hours=[12, 13, 14], guest_adj=-1),
    dict(count=10, waitlist_from=8,  hours=[12, 13, 14], guest_adj=-1),
    dict(count=9,  waitlist_from=8,  hours=[12, 13, 14], guest_adj=-1),
]
WEEKDAY_LUNCH_NOTES = [None, None, "Office lunch", "Business meeting", "Quick lunch"]
DEFAULT_WEEKDAY_LUNCH_CONFIG = dict(count=9, waitlist_from=8, hours=[12, 13, 14], guest_adj=-1)

HOLIDAY_SPIKE_CONFIGS = [
    dict(count=15, waitlist_from=10, hours=[18, 19, 20, 21], adj=1),
    dict(count=14, waitlist_from=10, hours=[18, 19, 20, 21], adj=1),
    dict(count=17, waitlist_from=12, hours=[17, 18, 19, 20, 21], adj=2),
]
HOLIDAY_SPIKE_NOTES = [None, "Festival outing", "Birthday celebration", "Large family group", "Anniversary"]
DEFAULT_HOLIDAY_CONFIG = dict(count=13, waitlist_from=10, hours=[18, 19, 20, 21], adj=1)

LOW_STOCK_WEEKEND_CONFIGS = [
    dict(count=10, waitlist_from=8, hours=[13, 18, 19, 20]),
    dict(count=11, waitlist_from=9, hours=[13, 18, 19, 20]),
    dict(count=9,  waitlist_from=8, hours=[13, 18, 19, 20]),
]
LOW_STOCK_WEEKEND_NOTES = [None, "Weekend dinner", "Casual outing"]
DEFAULT_LSW_CONFIG = dict(count=9, waitlist_from=8, hours=[13, 18, 19, 20])

for i, target in enumerate(FUTURE_SCENARIO_TARGETS["friday_rush"]):
    cfg = FRIDAY_RUSH_CONFIGS[i] if i < len(FRIDAY_RUSH_CONFIGS) else DEFAULT_FRIDAY_CONFIG
    reservations.extend(make_future_res(target, cfg["count"], cfg["waitlist_from"], cfg["hours"], cfg["notes"], cfg["guest_adj"]))

for i, target in enumerate(FUTURE_SCENARIO_TARGETS["weekday_lunch"]):
    cfg = WEEKDAY_LUNCH_CONFIGS[i] if i < len(WEEKDAY_LUNCH_CONFIGS) else DEFAULT_WEEKDAY_LUNCH_CONFIG
    reservations.extend(make_future_res(target, cfg["count"], cfg["waitlist_from"], cfg["hours"], WEEKDAY_LUNCH_NOTES, cfg["guest_adj"]))

for i, target in enumerate(FUTURE_SCENARIO_TARGETS["holiday_spike"]):
    cfg = HOLIDAY_SPIKE_CONFIGS[i] if i < len(HOLIDAY_SPIKE_CONFIGS) else DEFAULT_HOLIDAY_CONFIG
    reservations.extend(make_future_res(target, cfg["count"], cfg["waitlist_from"], cfg["hours"], HOLIDAY_SPIKE_NOTES, cfg["adj"]))

for i, target in enumerate(FUTURE_SCENARIO_TARGETS["low_stock_weekend"]):
    cfg = LOW_STOCK_WEEKEND_CONFIGS[i] if i < len(LOW_STOCK_WEEKEND_CONFIGS) else DEFAULT_LSW_CONFIG
    reservations.extend(make_future_res(target, cfg["count"], cfg["waitlist_from"], cfg["hours"], LOW_STOCK_WEEKEND_NOTES, -1))

session.add_all(reservations)
session.commit()
print(f"  Added {len(reservations)} reservations")


# ── 4. Orders (historical) ────────────────────────────────────────────────────
menu_items_db = session.query(MenuItem).all()
pizza_items   = [m for m in menu_items_db if m.category == "pizza"]
pasta_items   = [m for m in menu_items_db if m.category == "pasta"]
burger_items  = [m for m in menu_items_db if m.category == "burger"]
sides_items   = [m for m in menu_items_db if m.category == "sides"]
other_items   = [m for m in menu_items_db if m.category not in ("pizza",)]
popular_pizza = [m for m in pizza_items if m.name in
                 {"Margherita", "Pepperoni Feast", "Chicken Tikka Pizza"}]

FRIDAY_PEAK_DATES_SET   = {d.date() for d in FRIDAY_PEAKS}
WEEKDAY_LUNCH_DATES_SET = {d.date() for d in WEEKDAY_LUNCH_PEAKS}
HOLIDAY_DATES_SET       = {d.date() for d in HOLIDAY_PEAKS if HOLIDAY_PEAKS[d] > 0}

orders = []
for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    d = current_date.date()
    is_friday  = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]
    is_wdl     = d in WEEKDAY_LUNCH_DATES_SET
    is_holiday = d in HOLIDAY_DATES_SET

    if   d in FRIDAY_PEAK_DATES_SET:  order_count = FRIDAY_PEAKS.get(current_date, random.randint(85, 115))
    elif d in WEEKDAY_LUNCH_DATES_SET: order_count = WEEKDAY_LUNCH_PEAKS.get(current_date, random.randint(38, 52))
    elif is_holiday:                   order_count = HOLIDAY_PEAKS.get(current_date, random.randint(80, 105))
    elif is_friday:                    order_count = random.randint(80, 115)
    elif is_weekend:                   order_count = random.randint(45, 65)
    elif is_wdl:                       order_count = random.randint(38, 52)
    elif current_date.date() == SEED_AS_OF.date():
                                       order_count = random.randint(12, 20)  # today — partial day so far
    else:                              order_count = random.randint(20, 32)

    for _ in range(order_count):
        if d in FRIDAY_PEAK_DATES_SET and random.random() < 0.70:
            item = random.choice(popular_pizza)
        elif is_wdl or (not is_friday and not is_weekend and not is_holiday and random.random() < 0.55):
            item = random.choices(
                [random.choice(pasta_items), random.choice(burger_items),
                 random.choice(pizza_items), random.choice(sides_items)],
                weights=[40, 30, 20, 10],
            )[0]
        elif is_holiday:
            item = random.choices(
                [random.choice(pizza_items), random.choice(burger_items),
                 random.choice(pasta_items), random.choice(sides_items)],
                weights=[35, 25, 25, 15],
            )[0]
        elif is_weekend:
            item = random.choice(pizza_items) if random.random() < 0.60 else random.choice(other_items)
        else:
            item = random.choice(pizza_items) if random.random() < 0.60 else random.choice(other_items)

        quantity = random.randint(1, 3)

        if d in FRIDAY_PEAK_DATES_SET: h = hour_friday()
        elif is_wdl:                    h = hour_weekday_lunch()
        elif is_holiday:                h = hour_holiday()
        elif is_weekend:                h = hour_weekend()
        elif current_date.date() == SEED_AS_OF.date():
                                        h = random.choice([12, 13, 14])
        else:                           h = hour_generic_weekday()

        orders.append(Order(
            menu_item_id = item.id,
            quantity     = quantity,
            total_price  = round(item.price * quantity, 2),
            ordered_at   = current_date.replace(hour=h, minute=random.randint(0, 59)),
            is_delivery  = random.choice([True, False]),
        ))

session.add_all(orders)
session.commit()
print(f"  Added {len(orders)} orders over {HISTORY_DAYS + 1} days")


# ── 5. Feedback ───────────────────────────────────────────────────────────────
# Two pools:
# - Older than 28 days: ~35% negative — historically elevated
# - Last 28 days:       ~28% negative — gray zone for Diff 4 (25-30% threshold)

orders_db     = session.query(Order).all()
recent_cutoff = SEED_AS_OF - timedelta(days=28)

older_orders  = [o for o in orders_db if o.ordered_at < recent_cutoff]
recent_orders = [o for o in orders_db if o.ordered_at >= recent_cutoff]

sample_older  = random.sample(older_orders,  min(120, len(older_orders)))
sample_recent = random.sample(recent_orders, min(55,  len(recent_orders)))

friday_complaints = [
    "Pizza took over 45 minutes to arrive, completely unacceptable on a Friday night.",
    "The Pepperoni Feast was cold when it arrived. Very disappointing.",
    "Ran out of Garlic Bread at 8pm on a Friday. Needs better planning.",
    "Waiting time for seating was 30 minutes even with a reservation.",
    "Four Cheese pizza had very little cheese. Felt cheated.",
    "Friday service was chaos — waited 50 minutes for a pizza that came out cold.",
    "Ran out of Garlic Bread again — third week in a row. Unacceptable!",
    "Reserved for 4 but waited 25 minutes past our confirmed booking time.",
    "Portion sizes seem smaller recently. Margherita feels thin for the price.",
    "Long queues on a Friday with no updates from staff. Very poor communication.",
]
weekday_complaints = [
    "Pasta at 1pm — waited 35 minutes for a simple Carbonara. Office lunch ruined.",
    "Ordered 3 pastas for a business lunch; one was cold and had to be redone.",
    "The Cacio e Pepe was undersalted. For a weekday special it should be better.",
    "Caesar Salad came without croutons. Small thing but frustrating for a quick lunch.",
    "Burger bun was soggy at 12:30pm. Looked like it had been sitting under heat too long.",
    "Lunch took 40 minutes on a weekday. We had to go back to office late.",
    "Service was slow even though the restaurant was only half full at 1pm.",
]
holiday_complaints = [
    "The holiday spike was packed — staff were clearly overwhelmed. We waited 45 minutes.",
    "Ran out of Mango Smoothie by 7pm on the holiday. Disappointing.",
    "Large group of 8 on the holiday — seating took forever.",
    "Holiday reservation confirmed but we waited 20 mins past booking time.",
    "Ran out of Tiramisu on the holiday spike. Not acceptable for peak planning.",
]
recent_mild_complaints = [
    "Service felt a bit slow this week, though the food was good.",
    "Wait time slightly longer than usual on a weekday evening.",
    "Portion of Caesar Salad was smaller than expected.",
    "Pizza was great but took longer than the 30-minute estimate.",
    "A bit noisy on Friday — hard to have a conversation.",
]
positives = [
    "Absolutely loved the Chicken Tikka Pizza! Will definitely be back.",
    "Mushroom Truffle pizza was outstanding. Best pizza in the city!",
    "Great ambience and very friendly staff. Loved the experience.",
    "Tiramisu was heavenly. Perfect end to a great meal.",
    "Fast service even on a busy Friday night. Impressed!",
    "The Carbonara was creamy and perfectly cooked. Loved it.",
    "Best Smash Burger I've had in a long time. Crispy and juicy!",
    "This week's Friday rush experience was exceptional! Spicy Paneer pizza is my favourite.",
    "Weekday lunch is brilliant — pasta and burger combo is great value.",
    "The Cacio e Pepe on a weekday was restaurant quality. Surprising for a casual place.",
    "The holiday dinner was smooth despite the crowds. Well managed!",
    "The staff remembered our anniversary from last month. Beautiful touch!",
    "Best Nutella Milkshake in the city. We visit every week just for that!",
    "This Friday our pizza arrived in 18 minutes. Impressive!",
    "Office team loved the quick weekday lunch. Will make it our regular spot.",
    "Perfect evening — food, service, ambience all on point.",
    "The BBQ Chicken pizza is phenomenal. Have ordered it 3 times this month.",
    "Loaded Fries are addictive. Best side in the city.",
]
neutrals = [
    "Decent food but nothing extraordinary. Average experience overall.",
    "Prices are a bit high for the portion size.",
    "Good location, parking was a bit tricky.",
    "Food was fine, nothing stood out. Might try another place next time.",
    "Ambience is nice but service felt rushed on a Saturday evening.",
    "Lunch was okay. Pasta was a bit plain for the price.",
]

all_historical_complaints = friday_complaints + weekday_complaints + holiday_complaints
feedback_list = []

# Older than 28 days: ~35% negative (42/120)
for i, order in enumerate(sample_older):
    if i < 42:
        text, sentiment = random.choice(all_historical_complaints), SentimentType.negative
    elif i < 96:
        text, sentiment = random.choice(positives),                 SentimentType.positive
    else:
        text, sentiment = random.choice(neutrals),                  SentimentType.neutral
    feedback_list.append(Feedback(
        order_id   = order.id,
        raw_text   = text,
        sentiment  = sentiment,
        source     = random.choice(list(FeedbackSource)),
        created_at = order.ordered_at + timedelta(hours=random.randint(1, 48)),
    ))

# Last 28 days: ~28% negative — gray zone (this is what ComplaintService sees → Diff 4 fires)
for i, order in enumerate(sample_recent):
    if i < 15:
        text, sentiment = random.choice(recent_mild_complaints + friday_complaints[:4]), SentimentType.negative
    elif i < 43:
        text, sentiment = random.choice(positives),  SentimentType.positive
    else:
        text, sentiment = random.choice(neutrals),   SentimentType.neutral
    feedback_list.append(Feedback(
        order_id   = order.id,
        raw_text   = text,
        sentiment  = sentiment,
        source     = random.choice(list(FeedbackSource)),
        created_at = order.ordered_at + timedelta(hours=random.randint(1, 48)),
    ))

session.add_all(feedback_list)
session.commit()
print(f"  Added {len(feedback_list)} feedback entries ({len(sample_older)} older ~35% neg, {len(sample_recent)} last-28d ~27% neg)")


# ── 6. Decision logs ─────────────────────────────────────────────────────────
next_friday_rush = FUTURE_SCENARIO_TARGETS["friday_rush"][0]
next_weekday_lunch = FUTURE_SCENARIO_TARGETS["weekday_lunch"][0]
next_holiday_spike = FUTURE_SCENARIO_TARGETS["holiday_spike"][2]  # the biggest-configured one
next_low_stock = FUTURE_SCENARIO_TARGETS["low_stock_weekend"][0]

recent_friday_summary = ", ".join(f"{fmt(d)} ({c})" for d, c in list(FRIDAY_PEAKS.items())[-3:])
recent_lunch_summary  = ", ".join(f"{fmt(d)} ({c})" for d, c in list(WEEKDAY_LUNCH_PEAKS.items())[-3:])

decision_logs = [
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary=f"Recent Friday peaks: {recent_friday_summary} — sustained demand above 108 orders.",
        retrieved_context=f"5-week trend: 108-138. {fmt(next_friday_rush)} projected 125-135.",
        reasoning_summary=f"{fmt(next_friday_rush)} is a high-confidence peak. Pre-stage pizza bases by 5pm, add 2 kitchen staff.",
        action_recommended=f"Stage 80+ pizza bases by 5pm {fmt(next_friday_rush)}. Book 2 extra kitchen staff 18:00-22:00.",
        critic_verdict=CriticVerdict.approved, critic_score=0.92,
        critic_notes="Forecast is data-backed. Staffing recommendation is feasible.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mozzarella 2.6kg (threshold 8kg), Fresh Basil 0.35kg (threshold 1kg), Garlic 0.9kg (threshold 1.5kg) running low.",
        retrieved_context=f"3 items below threshold. {fmt(next_friday_rush)} is the next Friday Rush service.",
        reasoning_summary=f"Multi-ingredient shortage risk ahead of {fmt(next_friday_rush)} service.",
        action_recommended=f"Reorder by {fmt(next_friday_rush - timedelta(days=2))}: 6kg mozzarella, 1kg basil, 1kg garlic.",
        critic_verdict=CriticVerdict.approved, critic_score=0.96,
        critic_notes="Urgent and justified. Quantities are realistic.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary=f"Weekday lunch peaks: {recent_lunch_summary} — office district pattern holding.",
        retrieved_context="Pasta and burger orders dominate 12-14:00. Average 45 orders on peak days.",
        reasoning_summary=f"{fmt(next_weekday_lunch)} will likely hit 46-52 orders. Pasta prep is the constraint.",
        action_recommended=f"Pre-cook pasta bases by 11:30am on {fmt(next_weekday_lunch)}. Staff one extra server 12-15:00.",
        critic_verdict=CriticVerdict.approved, critic_score=0.88,
        critic_notes="Weekday lunch pattern is well-evidenced. Recommendation is specific and actionable.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="15 recent complaints about slow service and cold food. Notable: garlic bread stockouts on recent Fridays.",
        retrieved_context="Complaints cluster: Friday wait times, garlic bread availability, portion sizes.",
        reasoning_summary="Garlic bread shortage is a recurring Friday issue. Needs pre-service restock discipline.",
        action_recommended="Add garlic bread to Thursday restock checklist. Set 20-min target for all Friday orders.",
        critic_verdict=CriticVerdict.approved, critic_score=0.85,
        critic_notes="Specific, actionable, addresses root cause.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary=f"{fmt(next_holiday_spike)} holiday-style spike projected, in line with recent spikes.",
        retrieved_context="Holiday demand adds 20-25% uplift vs a standard day. Large group bookings already elevated.",
        reasoning_summary=f"{fmt(next_holiday_spike)} may reach 100-115 orders. Full holiday protocol needed.",
        action_recommended=f"Run full Friday protocol on {fmt(next_holiday_spike)}: 3 kitchen staff, beverage stock doubled.",
        critic_verdict=CriticVerdict.approved, critic_score=0.90,
        critic_notes="Holiday uplift is well-documented. Running Friday protocol is the right call.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mango Pulp 6kg (threshold 4kg), Cold Brew 5.5L (threshold 3L) — comfortable now, but beverage draw accelerates on holiday spikes.",
        retrieved_context=f"Past holiday spikes depleted beverages faster than forecast. {fmt(next_holiday_spike)} is the next high-risk date.",
        reasoning_summary=f"Beverage stock should be rechecked ahead of {fmt(next_holiday_spike)}.",
        action_recommended=f"Recheck Mango Pulp and Cold Brew levels by {fmt(next_holiday_spike - timedelta(days=4))}.",
        critic_verdict=CriticVerdict.approved, critic_score=0.87,
        critic_notes="Proactive perishable restock — well-timed for holiday demand.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Weekend watch items: Pasta, Cream, Caesar Dressing — historically depleted faster on busy weekends.",
        retrieved_context=f"{fmt(next_low_stock)} is the next Low-Stock Weekend service.",
        reasoning_summary=f"Ingredients should be topped up ahead of {fmt(next_low_stock)} evening service.",
        action_recommended=f"Restock Pasta, Cream, and Caesar Dressing by {fmt(next_low_stock - timedelta(days=2))}.",
        critic_verdict=CriticVerdict.approved, critic_score=0.89,
        critic_notes="Low-stock weekend call is well-timed. Quantities are specific and justified.",
    ),
]
# ── 7. Expenses — fixed/recurring costs backing the financial health score ──
# DEMO_ORG_ID=1 ("Casa Mia") is the seeded owner account's org. Effective dates
# anchor to the start of the history window so recurring costs are active for
# the whole trailing period, not just from today.
DEMO_ORG_ID = 1
expenses = [
    Expense(org_id=DEMO_ORG_ID, category=ExpenseCategory.rent, amount=85000.0,
            recurrence=ExpenseRecurrence.monthly, effective_date=base_date,
            note="Restaurant premises rent"),
    Expense(org_id=DEMO_ORG_ID, category=ExpenseCategory.utilities, amount=22000.0,
            recurrence=ExpenseRecurrence.monthly, effective_date=base_date,
            note="Electricity, water, gas"),
    Expense(org_id=DEMO_ORG_ID, category=ExpenseCategory.marketing, amount=3500.0,
            recurrence=ExpenseRecurrence.weekly, effective_date=base_date,
            note="Swiggy/Zomato ad spend + local promotions"),
    Expense(org_id=DEMO_ORG_ID, category=ExpenseCategory.other, amount=15000.0,
            recurrence=ExpenseRecurrence.one_time, effective_date=SEED_AS_OF - timedelta(days=9),
            note="Diwali decor + festive signage"),
]
session.add_all(expenses)
session.commit()
print(f"  Added {len(expenses)} expenses (rent, utilities, marketing, one-time)")


# ── 8. Vendors -- local procurement contacts (P6-A10) ───────────────────────
# Confirmed via the 2026-07-08 restaurant-owner call: real procurement here is
# manual (phone/market visits/WhatsApp to known vendors), not e-commerce
# checkout -- Instamart is seeded here as just one vendor among several, not
# the default.
vendors = [
    Vendor(org_id=DEMO_ORG_ID, name="Ramesh Traders", category="dairy",
           is_online=False, whatsapp_number="+919876543210"),
    Vendor(org_id=DEMO_ORG_ID, name="Green Valley Produce", category="produce",
           is_online=False, whatsapp_number="+919876512345"),
    Vendor(org_id=DEMO_ORG_ID, name="Instamart", category="general",
           is_online=True, whatsapp_number=None),
]
session.add_all(vendors)
session.commit()
ramesh_traders = vendors[0]
print(f"  Added {len(vendors)} vendors (Ramesh Traders, Green Valley Produce, Instamart)")

vendor_price_quotes = [
    VendorPriceQuote(vendor_id=vendors[0].id, ingredient="Mozzarella Cheese", price=380.0),
    VendorPriceQuote(vendor_id=vendors[2].id, ingredient="Mozzarella Cheese", price=420.0),
    VendorPriceQuote(vendor_id=vendors[1].id, ingredient="Fresh Basil", price=45.0),
]
session.add_all(vendor_price_quotes)
session.commit()
print(f"  Added {len(vendor_price_quotes)} vendor price quotes")


# ── 9. Action Queue — demo pending actions ──────────────────────────────────
# Two realistic pending actions tied to the genuinely-low inventory items above,
# so the Action Queue UI has real content before the workflow trigger engine
# (P6-A11) exists to create these automatically.
action_queue_items = [
    ActionQueue(
        org_id=DEMO_ORG_ID, category="restock_alert", tier=ActionTier.recommendation,
        status=ActionStatus.pending, title="Fresh Basil running low -- 0.35kg vs 1kg threshold",
        payload={"ingredient": "Fresh Basil", "quantity_in_stock": 0.35, "reorder_threshold": 1.0},
    ),
    ActionQueue(
        org_id=DEMO_ORG_ID, category="whatsapp_vendor_order", tier=ActionTier.approve_required,
        status=ActionStatus.pending, title="Order Mozzarella Cheese from Ramesh Traders",
        payload={
            "vendor_id": ramesh_traders.id, "vendor": ramesh_traders.name, "ingredient": "Mozzarella Cheese",
            "quantity_in_stock": 2.6, "reorder_threshold": 8.0,
            "message_draft": "Ramesh bhai, mozzarella is almost done, only 2.6kg left. Can you send "
                             "6kg by tomorrow morning? Same rate as usual, thanks!",
        },
    ),
]
session.add_all(action_queue_items)
session.commit()
print(f"  Added {len(action_queue_items)} Action Queue demo items (pending)")


session.add_all(decision_logs)
session.commit()
print(f"  Added {len(decision_logs)} decision logs")

session.close()

print("\nCortexKitchen v4 demo data seeded successfully.")
print(f"  History   : {(SEED_AS_OF - timedelta(days=HISTORY_DAYS)).date()} – {SEED_AS_OF.date()}")
print(f"  Future    : {FUTURE_SCENARIO_TARGETS['friday_rush'][0].date()} – {FUTURE_SCENARIO_TARGETS['friday_rush'][-1].date()} ({FUTURE_OCCURRENCES} occurrences per scenario)")
print(f"  Friday peaks     : {len(FRIDAY_PEAKS)} historical peaks (108–138 orders)")
print(f"  Weekday lunches  : {len(WEEKDAY_LUNCH_PEAKS)} historical peaks (38–52 orders)")
print(f"  Holiday spikes   : {len(HOLIDAY_PEAKS)} historical dates")
print(f"  Inventory        : 3 of {len(inventory_items)} items below threshold")
print(f"  Feedback         : {len(feedback_list)} entries — older ~35% neg, last 28d ~27% neg (Diff 4 gray zone)")
print(f"  High-occupancy   : {fmt(FUTURE_SCENARIO_TARGETS['friday_rush'][0])} and {fmt(FUTURE_SCENARIO_TARGETS['friday_rush'][2])} seeded >90% occupancy")
print(f"  Expenses         : {len(expenses)} entries — rent + utilities (monthly), marketing (weekly), 1 one-time cost")
print(f"  Action Queue     : {len(action_queue_items)} pending demo items")
print(f"  Vendors          : {len(vendors)} vendors, {len(vendor_price_quotes)} price quotes")
