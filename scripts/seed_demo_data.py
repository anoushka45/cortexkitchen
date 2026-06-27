"""
CortexKitchen — demo data seed (v3, June 26 2026)

Changes vs v2:
- SEED_AS_OF updated to June 26 2026 (today)
- HISTORY_DAYS extended to 161 (Jan 16 – Jun 26)
- June historical peaks added: Fridays Jun 5/12/19, weekday lunches, Father's Day Jun 21 (105 orders)
- Future planning window pushed to July 3 – July 31
- July 3 and July 17 Fridays seeded with high-occupancy reservations (>90%) to trigger Diff 2
- Recent feedback (June 1–26) seeded at ~28% negative — gray zone for Diff 4 (25–30%)
- Inventory adjusted to reflect post-June depletion patterns
- Decision logs updated to reference June actuals
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

from app.infrastructure.db.models import (
    CriticVerdict,
    DecisionLog,
    Feedback,
    FeedbackSource,
    Inventory,
    MenuItem,
    Order,
    PlanningRun,
    Reservation,
    ReservationStatus,
    SentimentType,
)

DATABASE_URL = "postgresql://cortex:cortexpass@localhost:5432/cortexkitchen"
SEED_AS_OF   = datetime(2026, 6, 26, 12, 0, 0)
HISTORY_DAYS = 161   # Jan 16 – Jun 26

# ── Historical Friday peaks ──────────────────────────────────────────────────

FRIDAY_PEAKS = {
    # April / May
    datetime(2026, 4, 24): 138,
    datetime(2026, 5,  1): 127,
    datetime(2026, 5,  8): 108,
    datetime(2026, 5, 15): 119,
    datetime(2026, 5, 22): 131,
    datetime(2026, 5, 29): 112,
    # June
    datetime(2026, 6,  5): 122,
    datetime(2026, 6, 12): 108,
    datetime(2026, 6, 19): 115,
    # Jun 26 is today — morning orders only, handled by generic Friday path
}

WEEKDAY_LUNCH_PEAKS = {
    # May
    datetime(2026, 4, 22): 48,
    datetime(2026, 4, 28): 52,
    datetime(2026, 5,  5): 44,
    datetime(2026, 5, 12): 49,
    datetime(2026, 5, 19): 46,
    datetime(2026, 5, 26): 51,
    datetime(2026, 5, 27): 43,
    # June
    datetime(2026, 6,  2): 47,
    datetime(2026, 6,  3): 41,
    datetime(2026, 6,  9): 49,
    datetime(2026, 6, 10): 43,
    datetime(2026, 6, 16): 45,
    datetime(2026, 6, 17): 38,
    datetime(2026, 6, 23): 50,
    datetime(2026, 6, 24): 44,
}

HOLIDAY_PEAKS = {
    datetime(2026, 4, 14): 88,   # Ambedkar Jayanti
    datetime(2026, 5, 25): 94,   # pre-summer holiday Monday
    datetime(2026, 6, 21): 105,  # Father's Day Sunday — biggest spike yet
}

# ── Future planning window: July 3 – July 31 ────────────────────────────────

FUTURE_SCENARIO_TARGETS = {
    "friday_rush": [
        datetime(2026, 7,  3),   # high occupancy — seeded to trigger Diff 2
        datetime(2026, 7, 10),   # Guru Purnima weekend — elevated
        datetime(2026, 7, 17),   # high occupancy — seeded to trigger Diff 2
        datetime(2026, 7, 24),
    ],
    "weekday_lunch": [
        datetime(2026, 7,  1),   # Wed
        datetime(2026, 7,  7),   # Tue
        datetime(2026, 7,  8),   # Wed
        datetime(2026, 7, 14),   # Tue
        datetime(2026, 7, 15),   # Wed
        datetime(2026, 7, 22),   # Tue
        datetime(2026, 7, 29),   # Tue
    ],
    "holiday_spike": [
        datetime(2026, 7,  5),   # Sun
        datetime(2026, 7, 12),   # Sun
        datetime(2026, 7, 19),   # Sun — Guru Purnima
    ],
    "low_stock_weekend": [
        datetime(2026, 7,  4),   # Sat
        datetime(2026, 7, 11),   # Sat
        datetime(2026, 7, 25),   # Sat
    ],
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


print("Seeding CortexKitchen v3 demo data...")
print(f"  As-of : {SEED_AS_OF.date()} | History: {HISTORY_DAYS} days")

# ── Clear ────────────────────────────────────────────────────────────────────
session.query(DecisionLog).delete()
session.query(PlanningRun).delete()
session.query(Feedback).delete()
session.query(Order).delete()
session.query(Reservation).delete()
session.query(Inventory).delete()
session.query(MenuItem).delete()
session.commit()
print("  Cleared existing data")


# ── 1. Menu items ─────────────────────────────────────────────────────────────
menu_items = [
    MenuItem(name="Margherita",           category="pizza",    price=349.0, is_available=True),
    MenuItem(name="Pepperoni Feast",       category="pizza",    price=449.0, is_available=True),
    MenuItem(name="BBQ Chicken",           category="pizza",    price=499.0, is_available=True),
    MenuItem(name="Veggie Supreme",        category="pizza",    price=399.0, is_available=True),
    MenuItem(name="Four Cheese",           category="pizza",    price=479.0, is_available=True),
    MenuItem(name="Spicy Paneer",          category="pizza",    price=429.0, is_available=True),
    MenuItem(name="Mushroom Truffle",      category="pizza",    price=529.0, is_available=True),
    MenuItem(name="Chicken Tikka Pizza",   category="pizza",    price=499.0, is_available=True),
    MenuItem(name="Penne Arrabbiata",      category="pasta",    price=299.0, is_available=True),
    MenuItem(name="Spaghetti Carbonara",   category="pasta",    price=349.0, is_available=True),
    MenuItem(name="Pesto Fusilli",         category="pasta",    price=329.0, is_available=True),
    MenuItem(name="Cacio e Pepe",          category="pasta",    price=369.0, is_available=True),
    MenuItem(name="Classic Smash Burger",  category="burger",   price=349.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger", category="burger",   price=329.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger", category="burger",   price=369.0, is_available=True),
    MenuItem(name="Garlic Bread",          category="sides",    price=149.0, is_available=True),
    MenuItem(name="Loaded Fries",          category="sides",    price=179.0, is_available=True),
    MenuItem(name="Onion Rings",           category="sides",    price=159.0, is_available=True),
    MenuItem(name="Caesar Salad",          category="sides",    price=249.0, is_available=True),
    MenuItem(name="Tiramisu",              category="dessert",  price=229.0, is_available=True),
    MenuItem(name="Nutella Pizza",         category="dessert",  price=279.0, is_available=True),
    MenuItem(name="Chocolate Brownie",     category="dessert",  price=199.0, is_available=True),
    MenuItem(name="Classic Lemonade",      category="beverage", price=99.0,  is_available=True),
    MenuItem(name="Nutella Milkshake",     category="beverage", price=179.0, is_available=True),
    MenuItem(name="Coca Cola",             category="beverage", price=79.0,  is_available=True),
    MenuItem(name="Mango Smoothie",        category="beverage", price=149.0, is_available=True),
    MenuItem(name="Iced Coffee",           category="beverage", price=129.0, is_available=True),
]
session.add_all(menu_items)
session.commit()
print(f"  Added {len(menu_items)} menu items")


# ── 2. Inventory — post-June depletion ──────────────────────────────────────
# High-frequency items further depleted after June Friday rushes
inventory_items = [
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg",    quantity_in_stock=1.8,   reorder_threshold=8.0,  spoilage_risk=True),
    Inventory(ingredient_name="Pizza Dough",        unit="kg",    quantity_in_stock=3.2,   reorder_threshold=10.0, spoilage_risk=True),
    Inventory(ingredient_name="Pepperoni",          unit="kg",    quantity_in_stock=1.2,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Fresh Basil",        unit="kg",    quantity_in_stock=0.14,  reorder_threshold=1.0,  spoilage_risk=True),
    Inventory(ingredient_name="Burger Buns",        unit="units", quantity_in_stock=14.0,  reorder_threshold=20.0, spoilage_risk=True),
    Inventory(ingredient_name="Garlic",             unit="kg",    quantity_in_stock=0.6,   reorder_threshold=1.5,  spoilage_risk=True),
    Inventory(ingredient_name="Pasta (dry)",        unit="kg",    quantity_in_stock=5.4,   reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Cream (cooking)",    unit="litres",quantity_in_stock=2.2,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Caesar Dressing",    unit="litres",quantity_in_stock=1.1,   reorder_threshold=2.0,  spoilage_risk=True),
    Inventory(ingredient_name="Tomato Sauce",       unit="litres",quantity_in_stock=14.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Chicken",            unit="kg",    quantity_in_stock=12.0,  reorder_threshold=6.0,  spoilage_risk=True),
    Inventory(ingredient_name="Paneer",             unit="kg",    quantity_in_stock=5.5,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil",          unit="litres",quantity_in_stock=8.0,   reorder_threshold=3.0,  spoilage_risk=False),
    Inventory(ingredient_name="Nutella",            unit="kg",    quantity_in_stock=3.2,   reorder_threshold=2.0,  spoilage_risk=False),
    Inventory(ingredient_name="Coca Cola Cans",     unit="units", quantity_in_stock=380.0, reorder_threshold=40.0, spoilage_risk=False),
    Inventory(ingredient_name="Tiramisu Cream",     unit="kg",    quantity_in_stock=8.5,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Mango Pulp",         unit="kg",    quantity_in_stock=2.8,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Cold Brew Coffee",   unit="litres",quantity_in_stock=1.8,   reorder_threshold=3.0,  spoilage_risk=True),
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


# ── Future reservations (July) ────────────────────────────────────────────────
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

# July 3 — high occupancy Friday (target >90% with org capacity=110)
# 18 reservations, guest_adj=+2 → avg 6.05 × 18 = ~109 guests / 110 = 99% → triggers Diff 2
reservations.extend(make_future_res(
    datetime(2026, 7, 3), count=18, waitlist_from=15,
    hour_choices=[18, 19, 19, 20, 20, 21],
    notes_choices=[None, "Birthday celebration", "Window seat please", "Anniversary dinner", "Corporate dinner"],
    guest_adj=2,
))

# July 10 — Guru Purnima Friday, moderately elevated (80-85%)
reservations.extend(make_future_res(
    datetime(2026, 7, 10), count=13, waitlist_from=11,
    hour_choices=[18, 19, 20, 21],
    notes_choices=[None, None, "Festive dinner", "Birthday celebration"],
    guest_adj=0,
))

# July 17 — high occupancy Friday (target >90% with org capacity=110)
# 17 reservations, guest_adj=+2 → avg 6.05 × 17 = ~103 guests / 110 = 93.6% → triggers Diff 2
reservations.extend(make_future_res(
    datetime(2026, 7, 17), count=17, waitlist_from=14,
    hour_choices=[18, 19, 19, 20, 20, 21],
    notes_choices=[None, "Anniversary dinner", "Birthday celebration", "Corporate event", "Window seat please"],
    guest_adj=2,
))

# July 24 — normal busy Friday (75-80%)
reservations.extend(make_future_res(
    datetime(2026, 7, 24), count=12, waitlist_from=10,
    hour_choices=[18, 19, 20, 21],
    notes_choices=[None, None, "Birthday celebration", "Window seat please"],
    guest_adj=0,
))

# Weekday lunches — July
WDL_CFG = {
    datetime(2026, 7,  1): (9,  8, [12, 13, 14]),
    datetime(2026, 7,  7): (10, 8, [12, 13, 14]),
    datetime(2026, 7,  8): (9,  8, [12, 13, 14]),
    datetime(2026, 7, 14): (11, 9, [12, 13, 14]),
    datetime(2026, 7, 15): (9,  8, [12, 13, 14]),
    datetime(2026, 7, 22): (10, 8, [12, 13, 14]),
    datetime(2026, 7, 29): (9,  8, [12, 13, 14]),
}
for d, (cnt, wl, hrs) in WDL_CFG.items():
    reservations.extend(make_future_res(d, cnt, wl, hrs,
        [None, None, "Office lunch", "Business meeting", "Quick lunch"], -1))

# Holiday spikes — July
HOLIDAY_CFG = {
    datetime(2026, 7,  5): (15, 10,  1, [18, 19, 20, 21]),
    datetime(2026, 7, 12): (14, 10,  1, [18, 19, 20, 21]),
    datetime(2026, 7, 19): (17, 12,  2, [17, 18, 19, 20, 21]),  # Guru Purnima
}
for d, (cnt, wl, adj, hrs) in HOLIDAY_CFG.items():
    reservations.extend(make_future_res(d, cnt, wl, hrs,
        [None, "Festival outing", "Birthday celebration", "Large family group", "Anniversary"], adj))

# Low-stock weekends — July
LSW_CFG = {
    datetime(2026, 7,  4): (10, 8, [13, 18, 19, 20]),
    datetime(2026, 7, 11): (11, 9, [13, 18, 19, 20]),
    datetime(2026, 7, 25): (9,  8, [13, 18, 19, 20]),
}
for d, (cnt, wl, hrs) in LSW_CFG.items():
    reservations.extend(make_future_res(d, cnt, wl, hrs,
        [None, "Weekend dinner", "Casual outing"], -1))

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

FRIDAY_PEAK_DATES      = {d.date() for d in FRIDAY_PEAKS}
WEEKDAY_LUNCH_DATES    = {d.date() for d in WEEKDAY_LUNCH_PEAKS}
HOLIDAY_DATES          = {d.date() for d in HOLIDAY_PEAKS if HOLIDAY_PEAKS[d] > 0}

orders = []
for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    d = current_date.date()
    is_friday  = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]
    is_wdl     = d in WEEKDAY_LUNCH_DATES
    is_holiday = d in HOLIDAY_DATES

    if   d in FRIDAY_PEAK_DATES:    order_count = FRIDAY_PEAKS.get(current_date, random.randint(85, 115))
    elif d in WEEKDAY_LUNCH_PEAKS:  order_count = WEEKDAY_LUNCH_PEAKS[current_date]
    elif is_holiday:                 order_count = HOLIDAY_PEAKS.get(current_date, random.randint(80, 105))
    elif is_friday:                  order_count = random.randint(80, 115)
    elif is_weekend:                 order_count = random.randint(45, 65)
    elif is_wdl:                     order_count = random.randint(38, 52)
    # Jun 26 is today — only morning orders (lunch window only, not dinner yet)
    elif current_date.date() == SEED_AS_OF.date():
                                     order_count = random.randint(12, 20)
    else:                            order_count = random.randint(20, 32)

    for _ in range(order_count):
        if d in FRIDAY_PEAK_DATES and random.random() < 0.70:
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

        if d in FRIDAY_PEAK_DATES:   h = hour_friday()
        elif is_wdl:                  h = hour_weekday_lunch()
        elif is_holiday:              h = hour_holiday()
        elif is_weekend:              h = hour_weekend()
        elif current_date.date() == SEED_AS_OF.date():
                                      h = random.choice([12, 13, 14])
        else:                         h = hour_generic_weekday()

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
# - Pre-June (Jan 16 – May 31): ~35% negative — historically elevated
# - June (Jun 1 – Jun 26):      ~28% negative — gray zone for Diff 4 (25-30% threshold)

orders_db    = session.query(Order).all()
june_cutoff  = datetime(2026, 6, 1)

pre_june_orders = [o for o in orders_db if o.ordered_at < june_cutoff]
june_orders     = [o for o in orders_db if o.ordered_at >= june_cutoff]

sample_pre_june = random.sample(pre_june_orders, min(120, len(pre_june_orders)))
sample_june     = random.sample(june_orders,     min(55,  len(june_orders)))

friday_complaints = [
    "Pizza took over 45 minutes to arrive, completely unacceptable on a Friday night.",
    "The Pepperoni Feast was cold when it arrived. Very disappointing.",
    "Ran out of Garlic Bread at 8pm on a Friday. Needs better planning.",
    "Waiting time for seating was 30 minutes even with a reservation.",
    "Four Cheese pizza had very little cheese. Felt cheated.",
    "June 19 service was chaos — waited 50 minutes for a pizza that came out cold.",
    "Ran out of Garlic Bread again on June 12. Third week in a row. Unacceptable!",
    "Reserved for 4 on June 5 but waited 25 minutes past our confirmed booking time.",
    "Portion sizes seem smaller recently. Margherita feels thin for the price.",
    "Long queues on June 19 with no updates from staff. Very poor communication.",
    "May 22 service was chaos — waited 50 minutes for a pizza that came out cold.",
    "Ran out of Garlic Bread again on May 29. Unacceptable!",
]
weekday_complaints = [
    "Pasta at 1pm — waited 35 minutes for a simple Carbonara. Office lunch ruined.",
    "Ordered 3 pastas for a business lunch; one was cold and had to be redone.",
    "The Cacio e Pepe was undersalted. For a weekday special it should be better.",
    "Caesar Salad came without croutons. Small thing but frustrating for a quick lunch.",
    "Burger bun was soggy at 12:30pm. Looked like it had been sitting under heat too long.",
    "Lunch took 40 minutes on a Tuesday. We had to go back to office late.",
    "Service was slow even though the restaurant was only half full at 1pm.",
]
holiday_complaints = [
    "Father's Day was packed — staff were clearly overwhelmed. We waited 45 minutes.",
    "June 21 and you ran out of Mango Smoothie by 7pm. Disappointing.",
    "Large group of 8 on Father's Day — seating took forever.",
    "Holiday reservation confirmed but we waited 20 mins past booking time.",
    "Ran out of Tiramisu on Father's Day Sunday. Not acceptable for peak planning.",
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
    "June 5 Friday rush experience was exceptional! Spicy Paneer pizza is my favourite.",
    "Weekday lunch is brilliant — pasta and burger combo is great value.",
    "The Cacio e Pepe on Tuesday was restaurant quality. Surprising for a casual place.",
    "Father's Day dinner was smooth despite the crowds. Well managed!",
    "The staff remembered our anniversary from last month. Beautiful touch!",
    "Best Nutella Milkshake in the city. We visit every week just for that!",
    "June 19 Friday — our pizza arrived in 18 minutes. Impressive!",
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

# Pre-June: ~35% negative (42/120)
for i, order in enumerate(sample_pre_june):
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

# June: ~28% negative — gray zone (15/55 = 27.3%)
# This is what ComplaintService sees for the last 28 days → Diff 4 fires
for i, order in enumerate(sample_june):
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
print(f"  Added {len(feedback_list)} feedback entries ({len(sample_pre_june)} pre-June ~35% neg, {len(sample_june)} June ~27% neg)")


# ── 6. Decision logs ─────────────────────────────────────────────────────────
decision_logs = [
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="June Friday peaks: Jun 5 (122), Jun 12 (108), Jun 19 (115) — sustained demand above 108 orders.",
        retrieved_context="5-week June trend: 108–122. July 3 projected 125–135.",
        reasoning_summary="July 3 is a high-confidence peak. Pre-stage pizza bases by 5pm, add 2 kitchen staff.",
        action_recommended="Stage 80+ pizza bases by 5pm July 3. Book 2 extra kitchen staff 18:00-22:00.",
        critic_verdict=CriticVerdict.approved, critic_score=0.92,
        critic_notes="Forecast is data-backed. Staffing recommendation is feasible.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Post-June: Mozzarella 1.8kg (threshold 8kg), Dough 3.2kg (10kg), Pepperoni 1.2kg (4kg). Further depleted vs May.",
        retrieved_context="9 items below threshold. July 3 Friday is 7 days away.",
        reasoning_summary="Multi-ingredient critical shortage. July 3 service failure risk high without emergency restock.",
        action_recommended="Emergency reorder by June 30: 6.2kg mozzarella, 6.8kg dough, 2.8kg pepperoni, 0.86kg basil.",
        critic_verdict=CriticVerdict.approved, critic_score=0.96,
        critic_notes="Urgent and justified. Quantities are realistic.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="June weekday lunch peaks: Jun 23 (50), Jun 24 (44), Jun 9 (49) — office district pattern holding.",
        retrieved_context="Pasta and burger orders dominate 12-14:00. Average 45 orders on peak Tuesdays in June.",
        reasoning_summary="July 7 and 14 Tuesdays will likely hit 46-52 orders. Pasta prep is the constraint.",
        action_recommended="Pre-cook pasta bases by 11:30am on July 7 and 14. Staff one extra server 12-15:00.",
        critic_verdict=CriticVerdict.approved, critic_score=0.88,
        critic_notes="Weekday lunch pattern is well-evidenced. Recommendation is specific and actionable.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="15 complaints in June about slow service and cold food. Notable: garlic bread stockouts on Jun 12 and Jun 19.",
        retrieved_context="Complaints cluster: Friday wait times, garlic bread availability, portion sizes.",
        reasoning_summary="Garlic bread shortage is a recurring Friday issue. Needs pre-service restock discipline.",
        action_recommended="Add garlic bread to Thursday restock checklist. Set 20-min target for all Friday orders.",
        critic_verdict=CriticVerdict.approved, critic_score=0.85,
        critic_notes="Specific, actionable, addresses root cause.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="July 19 Guru Purnima Sunday: holiday spike projected. Father's Day Jun 21 hit 105 orders.",
        retrieved_context="Guru Purnima adds 20-25% uplift vs standard Sunday. Large group bookings already at 17.",
        reasoning_summary="July 19 may reach 100-115 orders. Full holiday protocol needed.",
        action_recommended="Run full Friday protocol on July 19: 3 kitchen staff, beverage stock doubled.",
        critic_verdict=CriticVerdict.approved, critic_score=0.90,
        critic_notes="Holiday uplift is well-documented. Running Friday protocol is the right call.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mango Pulp 2.8kg (threshold 4kg), Cold Brew 1.8L (threshold 3L) — holiday beverage risk elevated.",
        retrieved_context="Father's Day Jun 21 depleted Mango Pulp faster than forecast. July 19 Guru Purnima is next high-risk date.",
        reasoning_summary="Beverage stock will fail by 7pm on July 19 without mid-week reorder.",
        action_recommended="Order 4kg Mango Pulp and 3L Cold Brew by July 15 to cover Guru Purnima demand.",
        critic_verdict=CriticVerdict.approved, critic_score=0.87,
        critic_notes="Proactive perishable restock — well-timed for holiday demand.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Weekend low-stock risk: Pasta 5.4kg (threshold 8kg), Cream 2.2L (threshold 4L), Caesar Dressing 1.1L (threshold 2L).",
        retrieved_context="June weekends depleted pasta and cream faster than May. July 4-5 weekend will be critical.",
        reasoning_summary="Three ingredients will fall below safe threshold by July 4 Saturday evening service.",
        action_recommended="Restock Pasta (+4kg), Cream (+2.5L), Caesar Dressing (+1.5L) by July 2.",
        critic_verdict=CriticVerdict.approved, critic_score=0.89,
        critic_notes="Low-stock weekend call is well-timed. Quantities are specific and justified.",
    ),
]
session.add_all(decision_logs)
session.commit()
print(f"  Added {len(decision_logs)} decision logs")

session.close()

print("\nCortexKitchen v3 demo data seeded successfully.")
print(f"  History   : {(SEED_AS_OF - timedelta(days=HISTORY_DAYS)).date()} – {SEED_AS_OF.date()}")
print(f"  Future    : July 3 – July 31, 2026")
print(f"  Friday peaks     : 9 historical peaks (108–138 orders, Apr–Jun)")
print(f"  Weekday lunches  : 14 historical peaks (38–52 orders, May–Jun)")
print(f"  Holiday spikes   : 3 historical dates incl. Father's Day Jun 21 (105 orders)")
print(f"  Inventory        : 11 items below threshold (depleted post-June)")
print(f"  Feedback         : {len(feedback_list)} entries — pre-June ~35% neg, June ~27% neg (Diff 4 gray zone)")
print(f"  High-occupancy   : Jul 3 (18 reservations +1 guest adj) and Jul 17 (17 reservations +1) -- >90% occupancy")
