"""
CortexKitchen — demo data seed (v2, May 31 2026)

Changes vs v1:
- Updated SEED_AS_OF to May 31 (today)
- Weekday orders now have a real lunch spike (12-14h) with pasta/burger bias
- Added historical weekday lunch peaks and holiday spike Mondays
- Holiday order volumes raised to 80-100 (distinctive pattern)
- Scenario-specific feedback for weekday, holiday, and low-stock cases
- Inventory adjusted to give interesting signals for all 4 scenarios
- Future planning window pushed to June 1 – June 28
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
SEED_AS_OF   = datetime(2026, 5, 31, 12, 0, 0)
HISTORY_DAYS = 135

# ── Notable past dates ──────────────────────────────────────────────────────

FRIDAY_PEAKS = {
    datetime(2026, 4, 24): 138,
    datetime(2026, 5,  1): 127,
    datetime(2026, 5,  8): 108,
    datetime(2026, 5, 15): 119,
    datetime(2026, 5, 22): 131,
    datetime(2026, 5, 29): 112,
}

WEEKDAY_LUNCH_PEAKS = {
    datetime(2026, 4, 22): 48,  # Wed — office area event
    datetime(2026, 4, 28): 52,  # Tue — corporate block booking
    datetime(2026, 5,  5): 44,  # Tue
    datetime(2026, 5, 12): 49,  # Tue
    datetime(2026, 5, 19): 46,  # Tue
    datetime(2026, 5, 26): 51,  # Tue
    datetime(2026, 5, 27): 43,  # Wed
}

HOLIDAY_PEAKS = {
    datetime(2026, 4, 14): 88,  # Ambedkar Jayanti — public holiday
    datetime(2026, 5,  1): 0,   # already a Friday
    datetime(2026, 5, 25): 94,  # pre-summer holiday Monday
}

# ── Future planning window: June 1 – June 28 ────────────────────────────────

FUTURE_SCENARIO_TARGETS = {
    "friday_rush": [
        datetime(2026, 6,  5),
        datetime(2026, 6, 12),
        datetime(2026, 6, 19),
        datetime(2026, 6, 26),
    ],
    "weekday_lunch": [
        datetime(2026, 6,  2),  # Tue
        datetime(2026, 6,  3),  # Wed
        datetime(2026, 6,  9),  # Tue
        datetime(2026, 6, 10),  # Wed
        datetime(2026, 6, 16),  # Tue
        datetime(2026, 6, 17),  # Wed
        datetime(2026, 6, 23),  # Tue
        datetime(2026, 6, 24),  # Wed
    ],
    "holiday_spike": [
        datetime(2026, 6,  1),  # Sun — start-of-June
        datetime(2026, 6,  8),  # Sun
        datetime(2026, 6, 21),  # Sun — Father's Day
    ],
    "low_stock_weekend": [
        datetime(2026, 6,  7),  # Sat
        datetime(2026, 6, 14),  # Sat
        datetime(2026, 6, 28),  # Sun
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
    # Clear lunch spike for weekday scenarios
    return random.choices(
        [12, 13, 14, 15, 19, 20, 21],
        weights=[22, 30, 18,  8,  6,  9,  7],
    )[0]

def hour_holiday() -> int:
    # Later evening — families go out for dinner on holidays
    return random.choices(
        [12, 13, 17, 18, 19, 20, 21, 22],
        weights=[5,  4,  6, 14, 20, 22, 16,  8],
    )[0]

def hour_generic_weekday() -> int:
    return random.choices(
        [12, 13, 14, 19, 20, 21],
        weights=[15, 18, 10,  20, 22, 15],
    )[0]


print("Seeding CortexKitchen v2 demo data...")
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
    # Pizza (Friday + weekend dominant)
    MenuItem(name="Margherita",           category="pizza",    price=349.0, is_available=True),
    MenuItem(name="Pepperoni Feast",       category="pizza",    price=449.0, is_available=True),
    MenuItem(name="BBQ Chicken",           category="pizza",    price=499.0, is_available=True),
    MenuItem(name="Veggie Supreme",        category="pizza",    price=399.0, is_available=True),
    MenuItem(name="Four Cheese",           category="pizza",    price=479.0, is_available=True),
    MenuItem(name="Spicy Paneer",          category="pizza",    price=429.0, is_available=True),
    MenuItem(name="Mushroom Truffle",      category="pizza",    price=529.0, is_available=True),
    MenuItem(name="Chicken Tikka Pizza",   category="pizza",    price=499.0, is_available=True),
    # Pasta (weekday lunch dominant)
    MenuItem(name="Penne Arrabbiata",      category="pasta",    price=299.0, is_available=True),
    MenuItem(name="Spaghetti Carbonara",   category="pasta",    price=349.0, is_available=True),
    MenuItem(name="Pesto Fusilli",         category="pasta",    price=329.0, is_available=True),
    MenuItem(name="Cacio e Pepe",          category="pasta",    price=369.0, is_available=True),
    # Burgers (weekday + holiday)
    MenuItem(name="Classic Smash Burger",  category="burger",   price=349.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger", category="burger",   price=329.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger", category="burger",   price=369.0, is_available=True),
    # Sides
    MenuItem(name="Garlic Bread",          category="sides",    price=149.0, is_available=True),
    MenuItem(name="Loaded Fries",          category="sides",    price=179.0, is_available=True),
    MenuItem(name="Onion Rings",           category="sides",    price=159.0, is_available=True),
    MenuItem(name="Caesar Salad",          category="sides",    price=249.0, is_available=True),
    # Desserts
    MenuItem(name="Tiramisu",              category="dessert",  price=229.0, is_available=True),
    MenuItem(name="Nutella Pizza",         category="dessert",  price=279.0, is_available=True),
    MenuItem(name="Chocolate Brownie",     category="dessert",  price=199.0, is_available=True),
    # Beverages
    MenuItem(name="Classic Lemonade",      category="beverage", price=99.0,  is_available=True),
    MenuItem(name="Nutella Milkshake",     category="beverage", price=179.0, is_available=True),
    MenuItem(name="Coca Cola",             category="beverage", price=79.0,  is_available=True),
    MenuItem(name="Mango Smoothie",        category="beverage", price=149.0, is_available=True),
    MenuItem(name="Iced Coffee",           category="beverage", price=129.0, is_available=True),
]
session.add_all(menu_items)
session.commit()
print(f"  Added {len(menu_items)} menu items")


# ── 2. Inventory — mixed signals across scenarios ────────────────────────────
inventory_items = [
    # Post-May-29 Friday depletion — critical for next Friday (June 5)
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg",    quantity_in_stock=2.1,   reorder_threshold=8.0,  spoilage_risk=True),
    Inventory(ingredient_name="Pizza Dough",        unit="kg",    quantity_in_stock=3.8,   reorder_threshold=10.0, spoilage_risk=True),
    Inventory(ingredient_name="Pepperoni",          unit="kg",    quantity_in_stock=1.6,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Fresh Basil",        unit="kg",    quantity_in_stock=0.18,  reorder_threshold=1.0,  spoilage_risk=True),
    Inventory(ingredient_name="Burger Buns",        unit="units", quantity_in_stock=16.0,  reorder_threshold=20.0, spoilage_risk=True),
    Inventory(ingredient_name="Garlic",             unit="kg",    quantity_in_stock=0.7,   reorder_threshold=1.5,  spoilage_risk=True),
    # Low-stock weekend risk — pasta and sides running thin
    Inventory(ingredient_name="Pasta (dry)",        unit="kg",    quantity_in_stock=6.2,   reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Cream (cooking)",    unit="litres",quantity_in_stock=2.8,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Caesar Dressing",    unit="litres",quantity_in_stock=1.4,   reorder_threshold=2.0,  spoilage_risk=True),
    # Adequate for weekday operations
    Inventory(ingredient_name="Tomato Sauce",       unit="litres",quantity_in_stock=16.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Chicken",            unit="kg",    quantity_in_stock=14.0,  reorder_threshold=6.0,  spoilage_risk=True),
    Inventory(ingredient_name="Paneer",             unit="kg",    quantity_in_stock=6.0,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil",          unit="litres",quantity_in_stock=9.0,   reorder_threshold=3.0,  spoilage_risk=False),
    Inventory(ingredient_name="Nutella",            unit="kg",    quantity_in_stock=3.5,   reorder_threshold=2.0,  spoilage_risk=False),
    Inventory(ingredient_name="Coca Cola Cans",     unit="units", quantity_in_stock=400.0, reorder_threshold=40.0, spoilage_risk=False),
    Inventory(ingredient_name="Tiramisu Cream",     unit="kg",    quantity_in_stock=10.0,  reorder_threshold=3.0,  spoilage_risk=True),
    # Holiday spike risk — beverages may run low
    Inventory(ingredient_name="Mango Pulp",         unit="kg",    quantity_in_stock=3.2,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Cold Brew Coffee",   unit="litres",quantity_in_stock=2.1,   reorder_threshold=3.0,  spoilage_risk=True),
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

    if   d in {dt.date() for dt in FRIDAY_PEAKS}:        count = random.randint(14, 18)
    elif is_holiday:                                       count = random.randint(12, 16)
    elif is_weekday_lunch_peak:                            count = random.randint(9, 12)
    elif is_friday:                                        count = random.randint(10, 14)
    elif is_weekend:                                       count = random.randint(6, 10)
    else:                                                  count = random.randint(3, 6)

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


# ── Future reservations ───────────────────────────────────────────────────────
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

# Friday rushes — June
FRIDAY_CFG = {
    datetime(2026, 6,  5): (17, 13,  1, [19, 20, 21]),
    datetime(2026, 6, 12): (15, 12,  0, [19, 20, 21]),
    datetime(2026, 6, 19): (16, 13,  0, [19, 20, 21]),
    datetime(2026, 6, 26): (14, 11, -1, [18, 19, 20, 21]),
}
for d, (cnt, wl, adj, hrs) in FRIDAY_CFG.items():
    reservations.extend(make_future_res(d, cnt, wl, hrs,
        [None, None, "Birthday celebration", "Window seat please", "Anniversary dinner"], adj))

# Weekday lunches — office crowd
WDL_CFG = {
    datetime(2026, 6,  2): (9,  8, [12, 13, 14]),
    datetime(2026, 6,  3): (8,  7, [12, 13, 14]),
    datetime(2026, 6,  9): (10, 8, [12, 13, 14]),
    datetime(2026, 6, 10): (9,  8, [12, 13, 14]),
    datetime(2026, 6, 16): (11, 9, [12, 13, 14]),
    datetime(2026, 6, 17): (9,  8, [12, 13, 14]),
    datetime(2026, 6, 23): (10, 8, [12, 13, 14]),
    datetime(2026, 6, 24): (8,  7, [12, 13, 14]),
}
for d, (cnt, wl, hrs) in WDL_CFG.items():
    reservations.extend(make_future_res(d, cnt, wl, hrs,
        [None, None, "Office lunch", "Business meeting", "Quick lunch"], -1))

# Holiday spikes — larger groups
HOLIDAY_CFG = {
    datetime(2026, 6,  1): (16, 11,  2, [18, 19, 20, 21]),
    datetime(2026, 6,  8): (14, 10,  1, [18, 19, 20, 21]),
    datetime(2026, 6, 21): (18, 12,  2, [17, 18, 19, 20, 21]),  # Father's Day
}
for d, (cnt, wl, adj, hrs) in HOLIDAY_CFG.items():
    reservations.extend(make_future_res(d, cnt, wl, hrs,
        [None, "Festival outing", "Birthday celebration", "Large family group",
         "Father's Day dinner", "Anniversary"], adj))

# Low-stock weekends
LSW_CFG = {
    datetime(2026, 6,  7): (10, 8, [13, 18, 19, 20]),
    datetime(2026, 6, 14): (11, 9, [13, 18, 19, 20]),
    datetime(2026, 6, 28): (9,  8, [13, 18, 19, 20]),
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

    if   d in FRIDAY_PEAK_DATES:        order_count = FRIDAY_PEAKS.get(current_date, random.randint(85, 115))
    elif d in WEEKDAY_LUNCH_PEAKS:      order_count = WEEKDAY_LUNCH_PEAKS[current_date]
    elif is_holiday:                     order_count = HOLIDAY_PEAKS.get(current_date, random.randint(75, 95))
    elif is_friday:                      order_count = random.randint(80, 115)
    elif is_weekend:                     order_count = random.randint(45, 65)
    elif is_wdl:                         order_count = random.randint(38, 52)
    else:                                order_count = random.randint(20, 32)

    for _ in range(order_count):
        # Item selection varies by scenario
        if d in FRIDAY_PEAK_DATES and random.random() < 0.70:
            item = random.choice(popular_pizza)
        elif is_wdl or (not is_friday and not is_weekend and not is_holiday and random.random() < 0.55):
            # Weekday lunch: pasta + burgers dominate
            item = random.choices(
                [random.choice(pasta_items), random.choice(burger_items),
                 random.choice(pizza_items), random.choice(sides_items)],
                weights=[40, 30, 20, 10],
            )[0]
        elif is_holiday:
            # Holiday: diverse, larger groups order variety
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

        if d in FRIDAY_PEAK_DATES:        h = hour_friday()
        elif is_wdl:                       h = hour_weekday_lunch()
        elif is_holiday:                   h = hour_holiday()
        elif is_weekend:                   h = hour_weekend()
        else:                              h = hour_generic_weekday()

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
orders_db     = session.query(Order).all()
sample_orders = random.sample(orders_db, min(160, len(orders_db)))

# Friday / general pizza complaints
friday_complaints = [
    "Pizza took over 45 minutes to arrive, completely unacceptable on a Friday night.",
    "The Pepperoni Feast was cold when it arrived. Very disappointing.",
    "Ran out of Garlic Bread at 8pm on a Friday. Needs better planning.",
    "Waiting time for seating was 30 minutes even with a reservation.",
    "Four Cheese pizza had very little cheese. Felt cheated.",
    "May 22 service was chaos — waited 50 minutes for a pizza that came out cold.",
    "Ran out of Garlic Bread again on May 29. Third Friday in a row. Unacceptable!",
    "Reserved for 4 on May 22 but waited 25 minutes past our confirmed booking time.",
    "Portion sizes seem smaller recently. Margherita feels thin for the price.",
    "Long queues on May 15 with no updates from staff. Very poor communication.",
]
# Weekday lunch complaints
weekday_complaints = [
    "Pasta at 1pm — waited 35 minutes for a simple Carbonara. Office lunch ruined.",
    "Ordered 3 pastas for a business lunch; one was cold and had to be redone.",
    "The Cacio e Pepe was undersalted. For a weekday special it should be better.",
    "Caesar Salad came without croutons. Small thing but frustrating for a quick lunch.",
    "Burger bun was soggy at 12:30pm. Looked like it had been sitting under heat too long.",
    "Lunch took 40 minutes on a Tuesday. We had to go back to office late.",
    "Service was slow even though the restaurant was only half full at 1pm on Wednesday.",
]
# Holiday complaints
holiday_complaints = [
    "June 1 was packed — staff were clearly overwhelmed. We waited 45 minutes for our table.",
    "Holiday Monday and you ran out of Mango Smoothie by 7pm. Disappointing.",
    "Large group of 8 — seating took forever. No coordination from front of house.",
    "Father's Day reservation confirmed but we waited 20 mins past booking time.",
    "Holiday menu should have more variety. Same old items on a special occasion.",
    "Ran out of Tiramisu on a holiday Sunday. Not acceptable for peak planning.",
]
positives = [
    "Absolutely loved the Chicken Tikka Pizza! Will definitely be back.",
    "Mushroom Truffle pizza was outstanding. Best pizza in the city!",
    "Great ambience and very friendly staff. Loved the experience.",
    "Tiramisu was heavenly. Perfect end to a great meal.",
    "Fast service even on a busy Friday night. Impressed!",
    "The Carbonara was creamy and perfectly cooked. Loved it.",
    "Best Smash Burger I've had in a long time. Crispy and juicy!",
    "May 29 experience was exceptional! Spicy Paneer pizza is now my favourite.",
    "Even on May 22 Friday rush, our pizza arrived in 18 minutes. Impressive!",
    "Weekday lunch is brilliant — pasta and burger combo is great value.",
    "The Cacio e Pepe on Tuesday was restaurant quality. Surprising for a casual place.",
    "Office team loved the quick weekday lunch. Will make it our regular spot.",
    "Holiday dinner on June 1 was smooth despite the crowds. Well managed!",
    "The staff remembered our anniversary from last month. Beautiful touch!",
    "Best Nutella Milkshake in the city. We visit every week just for that!",
    "May 22 was our anniversary dinner and the team made it so special. Thank you!",
]
neutrals = [
    "Decent food but nothing extraordinary. Average experience overall.",
    "Prices are a bit high for the portion size.",
    "Good location, parking was a bit tricky.",
    "Food was fine, nothing stood out. Might try another place next time.",
    "Ambience is nice but service felt rushed on a Saturday evening.",
    "Lunch was okay. Pasta was a bit plain for the price.",
]

all_complaints = friday_complaints + weekday_complaints + holiday_complaints
feedback_list = []
for i, order in enumerate(sample_orders):
    if i < 55:
        text, sentiment = random.choice(all_complaints), SentimentType.negative
    elif i < 130:
        text, sentiment = random.choice(positives),     SentimentType.positive
    else:
        text, sentiment = random.choice(neutrals),      SentimentType.neutral

    feedback_list.append(Feedback(
        order_id   = order.id,
        raw_text   = text,
        sentiment  = sentiment,
        source     = random.choice(list(FeedbackSource)),
        created_at = order.ordered_at + timedelta(hours=random.randint(1, 48)),
    ))

session.add_all(feedback_list)
session.commit()
print(f"  Added {len(feedback_list)} feedback entries")


# ── 6. Decision logs ─────────────────────────────────────────────────────────
decision_logs = [
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="Friday peaks May 22 (131), May 29 (112) — sustained demand above 110 orders.",
        retrieved_context="4-week Friday trend: 108–138. June 5 projected 125–135.",
        reasoning_summary="June 5 is a high-confidence peak. Pre-stage pizza bases by 5pm, add 2 kitchen staff.",
        action_recommended="Stage 80+ pizza bases by 5pm June 5. Book 2 extra kitchen staff 18:00-22:00.",
        critic_verdict=CriticVerdict.approved, critic_score=0.92,
        critic_notes="Forecast is data-backed. Staffing recommendation is feasible.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Post-May-29: Mozzarella 2.1kg (threshold 8kg), Dough 3.8kg (10kg), Pepperoni 1.6kg (4kg).",
        retrieved_context="6 items below threshold. June 5 Friday is 5 days away.",
        reasoning_summary="Multi-ingredient critical shortage. June 5 service failure risk high without emergency restock.",
        action_recommended="Emergency reorder by June 2: 5.9kg mozzarella, 6.2kg dough, 2.4kg pepperoni, 0.82kg basil.",
        critic_verdict=CriticVerdict.approved, critic_score=0.96,
        critic_notes="Urgent and justified. Quantities are realistic.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="Weekday lunch peaks: Tue Apr 28 (52), May 19 (46), May 26 (51) — office district pattern.",
        retrieved_context="Pasta and burger orders dominate 12-14:00. Average 47 orders on peak Tuesdays.",
        reasoning_summary="June 2 and 9 Tuesdays will likely hit 48-54 orders. Pasta prep is the constraint.",
        action_recommended="Pre-cook pasta bases by 11:30am on June 2 and 9. Staff one extra server 12-15:00.",
        critic_verdict=CriticVerdict.approved, critic_score=0.88,
        critic_notes="Weekday lunch pattern is well-evidenced. Recommendation is specific and actionable.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="7 weekday lunch complaints about slow service and cold food (12-15:00 window).",
        retrieved_context="Complaints cluster: pasta wait times 30-40min, soggy burger buns, underseasoned dishes.",
        reasoning_summary="Weekday kitchen is not primed for lunch rush. Pre-prep and timing fixes needed.",
        action_recommended="Pre-portion pasta and salad by 11:30am. Set 20-min target for all weekday lunch orders.",
        critic_verdict=CriticVerdict.approved, critic_score=0.85,
        critic_notes="Specific, actionable, addresses root cause. Good complaint-driven ops recommendation.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="June 21 Father's Day Sunday: largest holiday spike projected. Historical June 1 Sunday hit 94 orders.",
        retrieved_context="Father's Day adds 25-30% uplift vs standard Sunday. Large group bookings already at 18.",
        reasoning_summary="June 21 may reach 110-120 orders — above Friday levels. Full holiday protocol needed.",
        action_recommended="Run full Friday protocol on June 21: 3 kitchen staff, holiday specials pre-prepped, beverage stock doubled.",
        critic_verdict=CriticVerdict.approved, critic_score=0.90,
        critic_notes="Father's Day uplift is well-documented. Running Friday protocol is the right call.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mango Pulp 3.2kg (threshold 4kg), Cold Brew 2.1L (threshold 3L) — holiday beverage risk.",
        retrieved_context="Holiday Sundays show 40% higher beverage orders. June 21 Father's Day is highest-risk date.",
        reasoning_summary="Beverage stock will fail by 7pm on June 21 without mid-week reorder.",
        action_recommended="Order 4kg Mango Pulp and 3L Cold Brew by June 17 to cover Father's Day demand.",
        critic_verdict=CriticVerdict.approved, critic_score=0.87,
        critic_notes="Proactive perishable restock — well-timed for holiday demand.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Weekend low-stock risk: Pasta 6.2kg (threshold 8kg), Cream 2.8L (threshold 4L), Caesar Dressing 1.4L (threshold 2L).",
        retrieved_context="Weekend pasta orders 25% higher than weekdays. June 7-8 weekend will deplete remaining stock.",
        reasoning_summary="Three ingredients will fall below threshold by June 7 Saturday evening service.",
        action_recommended="Restock Pasta (+4kg), Cream (+2.5L), Caesar Dressing (+1.5L) by June 5.",
        critic_verdict=CriticVerdict.approved, critic_score=0.89,
        critic_notes="Low-stock weekend call is well-timed. Quantities are specific and justified.",
    ),
]
session.add_all(decision_logs)
session.commit()
print(f"  Added {len(decision_logs)} decision logs")

session.close()

print("\nCortexKitchen v2 demo data seeded successfully.")
print(f"  History   : {(SEED_AS_OF - timedelta(days=HISTORY_DAYS)).date()} – {SEED_AS_OF.date()}")
print(f"  Future    : June 1 – June 28, 2026")
print(f"  Friday peaks     : 6 historical peaks (108–138 orders)")
print(f"  Weekday lunches  : 7 historical peaks (43–52 orders, pasta/burger dominant)")
print(f"  Holiday spikes   : 2 historical Mondays (88–94 orders)")
print(f"  Inventory        : 9 items below threshold across all 4 scenario types")
print(f"  Feedback         : {len(feedback_list)} entries — Friday + weekday + holiday specific")
