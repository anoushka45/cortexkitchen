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
SEED_AS_OF   = datetime(2026, 5, 16, 12, 0, 0)   # Saturday May 16 — today
HISTORY_DAYS = 120                                 # covers back to ~Jan 16, 2026

# ── Historical notable Fridays ──────────────────────────
FRIDAY_RUSH_DATE = datetime(2026, 4, 24)   # record: 138 orders
MAY_1_FRIDAY     = datetime(2026, 5,  1)   # confirmed peak: 127 orders
MAY_8_FRIDAY     = datetime(2026, 5,  8)   # normal peak:   108 orders
MAY_15_FRIDAY    = datetime(2026, 5, 15)   # yesterday peak: 119 orders

# ── Future planning window: May 17 → June 14 ───────────
FUTURE_FRIDAY_TARGETS = [
    datetime(2026, 5, 22),
    datetime(2026, 5, 29),
    datetime(2026, 6,  5),
    datetime(2026, 6, 12),
]

FUTURE_SCENARIO_TARGETS = {
    "friday_rush": [
        datetime(2026, 5, 22),
        datetime(2026, 5, 29),
        datetime(2026, 6,  5),
        datetime(2026, 6, 12),
    ],
    "weekend_high": [
        datetime(2026, 5, 23),   # Sat
        datetime(2026, 5, 24),   # Sun
        datetime(2026, 5, 30),   # Sat
        datetime(2026, 5, 31),   # Sun
        datetime(2026, 6,  6),   # Sat
        datetime(2026, 6,  7),   # Sun
        datetime(2026, 6, 13),   # Sat
        datetime(2026, 6, 14),   # Sun
    ],
    "weekday_lunch": [
        datetime(2026, 5, 19),   # Tue
        datetime(2026, 5, 20),   # Wed
        datetime(2026, 5, 26),   # Tue
        datetime(2026, 5, 27),   # Wed
        datetime(2026, 6,  2),   # Tue
        datetime(2026, 6,  3),   # Wed
        datetime(2026, 6,  9),   # Tue
        datetime(2026, 6, 10),   # Wed
    ],
    "holiday_spike": [
        datetime(2026, 5, 25),   # Mon — pre-summer
        datetime(2026, 6,  1),   # Mon — start-of-June
        datetime(2026, 6,  8),   # Mon
    ],
    "low_stock_weekend": [
        datetime(2026, 5, 17),   # Sun — post-May-15 depletion (unique)
        datetime(2026, 5, 24),   # Sun — also in weekend_high
        datetime(2026, 6,  6),   # Sat — also in weekend_high
        datetime(2026, 6, 14),   # Sun — also in weekend_high
    ],
}

engine  = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

random.seed(42)


def weighted_hour(is_friday: bool, is_weekend: bool) -> int:
    if is_friday:
        return random.choices(
            [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
            weights=[3,  5,  4,  3,  3,  5, 14, 20, 18, 14,  9],
        )[0]
    if is_weekend:
        return random.choices(
            [12, 13, 14, 17, 18, 19, 20, 21, 22],
            weights=[5,  8,  6,  4,  9, 13, 14, 11,  5],
        )[0]
    return random.choice([12, 13, 14, 19, 20, 21])


print("Seeding CortexKitchen demo data...")
print(f"  As-of date  : {SEED_AS_OF.date()} (Saturday)")
print(f"  History     : Jan 16 – May 16 ({HISTORY_DAYS} days)")
print(f"  Past peaks  : Apr 24 (138), May 1 (127), May 8 (108), May 15 (119)")
print(f"  Future Fri  : {', '.join(str(d.date()) for d in FUTURE_FRIDAY_TARGETS)}")

# ── Clear existing data ─────────────────────────────────
session.query(DecisionLog).delete()
session.query(PlanningRun).delete()
session.query(Feedback).delete()
session.query(Order).delete()
session.query(Reservation).delete()
session.query(Inventory).delete()
session.query(MenuItem).delete()
session.commit()
print("  Cleared existing data")

# ── 1. Menu items ───────────────────────────────────────
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
    MenuItem(name="Classic Smash Burger",  category="burger",   price=349.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger", category="burger",   price=329.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger", category="burger",   price=369.0, is_available=True),
    MenuItem(name="Garlic Bread",          category="sides",    price=149.0, is_available=True),
    MenuItem(name="Loaded Fries",          category="sides",    price=179.0, is_available=True),
    MenuItem(name="Onion Rings",           category="sides",    price=159.0, is_available=True),
    MenuItem(name="Tiramisu",              category="dessert",  price=229.0, is_available=True),
    MenuItem(name="Nutella Pizza",         category="dessert",  price=279.0, is_available=True),
    MenuItem(name="Chocolate Brownie",     category="dessert",  price=199.0, is_available=True),
    MenuItem(name="Classic Lemonade",      category="beverage", price=99.0,  is_available=True),
    MenuItem(name="Nutella Milkshake",     category="beverage", price=179.0, is_available=True),
    MenuItem(name="Coca Cola",             category="beverage", price=79.0,  is_available=True),
    MenuItem(name="Mango Smoothie",        category="beverage", price=149.0, is_available=True),
]
session.add_all(menu_items)
session.commit()
print(f"  Added {len(menu_items)} menu items")

# ── 2. Inventory — post-May 15 state (multiple critical shortages) ──
inventory_items = [
    # CRITICAL — below reorder threshold after yesterday's Friday rush
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg",    quantity_in_stock=1.8,   reorder_threshold=8.0,  spoilage_risk=True),
    Inventory(ingredient_name="Pizza Dough",        unit="kg",    quantity_in_stock=3.2,   reorder_threshold=10.0, spoilage_risk=True),
    Inventory(ingredient_name="Pepperoni",          unit="kg",    quantity_in_stock=1.4,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Fresh Basil",        unit="kg",    quantity_in_stock=0.15,  reorder_threshold=1.0,  spoilage_risk=True),
    Inventory(ingredient_name="Burger Buns",        unit="units", quantity_in_stock=14.0,  reorder_threshold=20.0, spoilage_risk=True),
    Inventory(ingredient_name="Garlic",             unit="kg",    quantity_in_stock=0.6,   reorder_threshold=1.5,  spoilage_risk=True),
    # ADEQUATE — above threshold
    Inventory(ingredient_name="Tomato Sauce",       unit="litres",quantity_in_stock=14.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Chicken",            unit="kg",    quantity_in_stock=12.0,  reorder_threshold=6.0,  spoilage_risk=True),
    Inventory(ingredient_name="Paneer",             unit="kg",    quantity_in_stock=5.5,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil",          unit="litres",quantity_in_stock=8.5,   reorder_threshold=3.0,  spoilage_risk=False),
    Inventory(ingredient_name="Nutella",            unit="kg",    quantity_in_stock=3.2,   reorder_threshold=2.0,  spoilage_risk=False),
    Inventory(ingredient_name="Pasta",              unit="kg",    quantity_in_stock=62.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Coca Cola Cans",     unit="units", quantity_in_stock=380.0, reorder_threshold=40.0, spoilage_risk=False),
    Inventory(ingredient_name="Tiramisu Cream",     unit="kg",    quantity_in_stock=9.5,   reorder_threshold=3.0,  spoilage_risk=True),
]
session.add_all(inventory_items)
session.commit()
print(f"  Added {len(inventory_items)} inventory items (6 critical shortages)")

# ── 3. Reservations ─────────────────────────────────────
ALL_GUEST_NAMES = [
    "Priya Sharma", "Rohan Mehta", "Ananya Singh", "Arjun Patel",
    "Sneha Iyer",   "Vikram Nair", "Pooja Desai",  "Karan Malhotra",
    "Isha Joshi",   "Dev Kapoor",  "Riya Verma",   "Aditya Rao",
    "Meera Shah",   "Kabir Sethi", "Naina Kapoor", "Sahil Bhatia",
    "Tanya Gupta",  "Rahul Sharma","Divya Menon",  "Nikhil Jain",
]

reservations = []
base_date    = SEED_AS_OF - timedelta(days=HISTORY_DAYS)

# Historical loop: Jan 16 → May 16
for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    is_friday    = current_date.weekday() == 4
    is_weekend   = current_date.weekday() in [5, 6]

    if   current_date.date() == FRIDAY_RUSH_DATE.date(): count = 18
    elif current_date.date() == MAY_1_FRIDAY.date():     count = 17
    elif current_date.date() == MAY_8_FRIDAY.date():     count = 14
    elif current_date.date() == MAY_15_FRIDAY.date():    count = 16
    elif current_date.date() == datetime(2026, 4, 25).date(): count = 11
    elif current_date.date() == SEED_AS_OF.date():       count = 5
    elif is_friday:   count = random.randint(10, 15)
    elif is_weekend:  count = random.randint(6, 9)
    else:             count = random.randint(2, 5)

    for _ in range(count):
        hour = random.choice([13, 14, 18, 19, 20, 21] if is_friday or is_weekend else [13, 19, 20])
        if current_date.date() >= SEED_AS_OF.date():
            status = random.choice([ReservationStatus.confirmed, ReservationStatus.waitlist])
        else:
            status = random.choices(
                [ReservationStatus.confirmed, ReservationStatus.completed,
                 ReservationStatus.cancelled,  ReservationStatus.waitlist],
                weights=[18, 62, 10, 10],
            )[0]

        reservations.append(Reservation(
            guest_name   = random.choice(ALL_GUEST_NAMES),
            guest_count  = random.randint(2, 8),
            reserved_at  = current_date.replace(hour=hour, minute=random.choice([0, 15, 30, 45])),
            status       = status,
            table_number = random.randint(1, 15),
            notes        = random.choice([
                None, None, None,
                "Window seat please", "Birthday celebration",
                "Allergic to nuts",   "Anniversary dinner", "Office lunch",
            ]),
        ))

# Future bookings pool
FUTURE_NAMES = [
    ("Priya Sharma", 4),  ("Rohan Mehta", 2),   ("Ananya Singh", 6),
    ("Arjun Patel", 3),   ("Sneha Iyer", 5),     ("Vikram Nair", 2),
    ("Pooja Desai", 4),   ("Karan Malhotra", 8), ("Isha Joshi", 2),
    ("Dev Kapoor", 3),    ("Riya Verma", 4),     ("Aditya Rao", 6),
    ("Meera Shah", 5),    ("Kabir Sethi", 4),    ("Naina Kapoor", 3),
    ("Sahil Bhatia", 6),  ("Tanya Gupta", 2),    ("Rahul Sharma", 4),
    ("Divya Menon", 5),   ("Nikhil Jain", 3),
]


def make_future_reservations(target_date, count, waitlist_from, guest_adj, hour_choices, notes_choices):
    result = []
    for idx, (name, guests) in enumerate(FUTURE_NAMES[:count]):
        result.append(Reservation(
            guest_name   = name,
            guest_count  = max(2, guests + guest_adj),
            reserved_at  = target_date.replace(
                hour   = random.choice(hour_choices),
                minute = random.choice([0, 15, 30, 45]),
            ),
            status       = ReservationStatus.waitlist if idx >= waitlist_from else ReservationStatus.confirmed,
            table_number = random.randint(1, 15),
            notes        = random.choice(notes_choices),
        ))
    return result


# Friday rushes
FRIDAY_CFG = {
    datetime(2026, 5, 22).date(): (16, 13,  0),
    datetime(2026, 5, 29).date(): (13, 11, -1),
    datetime(2026, 6,  5).date(): (17, 14,  1),
    datetime(2026, 6, 12).date(): (15, 12,  0),
}
for d in FUTURE_SCENARIO_TARGETS["friday_rush"]:
    cnt, wl, adj = FRIDAY_CFG[d.date()]
    reservations.extend(make_future_reservations(
        d, cnt, wl, adj, [19, 20, 21],
        [None, None, "Birthday celebration", "Window seat please", "Anniversary dinner"],
    ))

# Weekend high
WEEKEND_CFG = {
    datetime(2026, 5, 23).date(): (11,  9,  0),
    datetime(2026, 5, 24).date(): ( 9,  8, -1),
    datetime(2026, 5, 30).date(): (10,  8,  0),
    datetime(2026, 5, 31).date(): ( 8,  7, -1),
    datetime(2026, 6,  6).date(): (12, 10,  1),
    datetime(2026, 6,  7).date(): (10,  8,  0),
    datetime(2026, 6, 13).date(): (11,  9,  0),
    datetime(2026, 6, 14).date(): ( 9,  7, -1),
}
for d in FUTURE_SCENARIO_TARGETS["weekend_high"]:
    cnt, wl, adj = WEEKEND_CFG[d.date()]
    reservations.extend(make_future_reservations(
        d, cnt, wl, adj, [13, 14, 18, 19, 20, 21],
        [None, None, "Weekend dinner", "Birthday celebration", "Family brunch"],
    ))

# Weekday lunches
WDL_CFG = {
    datetime(2026, 5, 19).date(): ( 7,  6, -1),
    datetime(2026, 5, 20).date(): ( 8,  7,  0),
    datetime(2026, 5, 26).date(): ( 9,  8,  0),
    datetime(2026, 5, 27).date(): ( 7,  6, -1),
    datetime(2026, 6,  2).date(): ( 9,  8,  0),
    datetime(2026, 6,  3).date(): ( 8,  7,  0),
    datetime(2026, 6,  9).date(): (10,  8,  1),
    datetime(2026, 6, 10).date(): ( 8,  7,  0),
}
for d in FUTURE_SCENARIO_TARGETS["weekday_lunch"]:
    cnt, wl, adj = WDL_CFG[d.date()]
    reservations.extend(make_future_reservations(
        d, cnt, wl, adj, [12, 13, 14],
        [None, None, "Office lunch", "Business meeting", "Window seat please"],
    ))

# Holiday spikes (Mon)
HOLIDAY_CFG = {
    datetime(2026, 5, 25).date(): (14, 11,  1),
    datetime(2026, 6,  1).date(): (16, 12,  1),
    datetime(2026, 6,  8).date(): (13, 10,  0),
}
for d in FUTURE_SCENARIO_TARGETS["holiday_spike"]:
    cnt, wl, adj = HOLIDAY_CFG[d.date()]
    reservations.extend(make_future_reservations(
        d, cnt, wl, adj, [18, 19, 20, 21],
        [None, "Festival outing", "Birthday celebration", "Large group", "Anniversary dinner"],
    ))

# Low-stock weekends — only seed May 17 (the rest overlap with weekend_high)
WEEKEND_HIGH_DATES = {d.date() for d in FUTURE_SCENARIO_TARGETS["weekend_high"]}
for d in FUTURE_SCENARIO_TARGETS["low_stock_weekend"]:
    if d.date() not in WEEKEND_HIGH_DATES:
        reservations.extend(make_future_reservations(
            d, 8, 7, -1, [18, 19, 20],
            [None, "Weekend dinner", "Keep seating flexible"],
        ))

session.add_all(reservations)
session.commit()
print(f"  Added {len(reservations)} reservations")

# ── 4. Orders (historical loop) ────────────────────────
menu_items_db = session.query(MenuItem).all()
pizza_items   = [m for m in menu_items_db if m.category == "pizza"]
other_items   = [m for m in menu_items_db if m.category != "pizza"]
popular_items = [m for m in menu_items_db if m.name in {
    "Margherita", "Pepperoni Feast", "Chicken Tikka Pizza", "Garlic Bread", "Loaded Fries",
}]
PEAK_RUSH_DATES = {FRIDAY_RUSH_DATE.date(), MAY_1_FRIDAY.date(), MAY_15_FRIDAY.date()}

orders = []
for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    is_friday    = current_date.weekday() == 4
    is_weekend   = current_date.weekday() in [5, 6]

    if   current_date.date() == FRIDAY_RUSH_DATE.date():          order_count = 138
    elif current_date.date() == MAY_1_FRIDAY.date():              order_count = 127
    elif current_date.date() == MAY_8_FRIDAY.date():              order_count = 108
    elif current_date.date() == MAY_15_FRIDAY.date():             order_count = 119
    elif current_date.date() == datetime(2026, 4, 25).date():     order_count = 72
    elif current_date.date() == SEED_AS_OF.date():                order_count = 32
    elif is_friday:   order_count = random.randint(85, 115)
    elif is_weekend:  order_count = random.randint(45, 65)
    else:             order_count = random.randint(18, 30)

    for _ in range(order_count):
        if current_date.date() in PEAK_RUSH_DATES and random.random() < 0.75:
            item = random.choice(popular_items)
        else:
            item = random.choice(pizza_items) if random.random() < 0.65 else random.choice(other_items)

        quantity = random.randint(1, 3)
        orders.append(Order(
            menu_item_id = item.id,
            quantity     = quantity,
            total_price  = round(item.price * quantity, 2),
            ordered_at   = current_date.replace(
                hour   = weighted_hour(is_friday, is_weekend),
                minute = random.randint(0, 59),
            ),
            is_delivery  = random.choice([True, False]),
        ))

session.add_all(orders)
session.commit()
print(f"  Added {len(orders)} orders over {HISTORY_DAYS + 1} days")

# ── 5. Feedback ─────────────────────────────────────────
orders_db     = session.query(Order).all()
sample_orders = random.sample(orders_db, min(130, len(orders_db)))

complaints = [
    "Pizza took over 45 minutes to arrive, completely unacceptable on a Friday night.",
    "The Pepperoni Feast was cold when it arrived. Very disappointing.",
    "Staff was rude and dismissive when I raised my concern.",
    "Tables were not cleaned properly between seatings.",
    "Ran out of Garlic Bread at 8pm on a Friday. Needs better planning.",
    "Waiting time for seating was 30 minutes even with a reservation.",
    "The burger bun was stale. Not fresh at all.",
    "Four Cheese pizza had very little cheese. Felt cheated.",
    "Long waiting time for seating and food.",
    "Poor food quality and presentation.",
    "May 1 should not repeat the Apr 24 dough stockout during peak service.",
    "Weekend takeaway packaging was messy and sauces leaked.",
    "May 1st Friday was chaos — waited 50 minutes for a pizza that came out cold.",
    "May 8 service was extremely slow. Pasta arrived 40 minutes after ordering.",
    "Ran out of Garlic Bread again on May 15. Third Friday in a row. Unacceptable!",
    "Delivery packaging leaked sauce all over my bag on May 10.",
    "Reserved for 4 on May 1 but waited 25 minutes past our confirmed booking time.",
    "Portion sizes seem smaller recently. Margherita feels thin for the price.",
    "Pesto Fusilli was overcooked on May 12. Replacement took 35 minutes.",
    "Long queues on May 15 with no updates from staff. Very poor communication.",
    "AC was not working on May 9 Saturday. Extremely uncomfortable dining experience.",
]
positives = [
    "Absolutely loved the Chicken Tikka Pizza! Will definitely be back.",
    "Mushroom Truffle pizza was outstanding. Best pizza in the city!",
    "Great ambience and very friendly staff. Loved the experience.",
    "Tiramisu was heavenly. Perfect end to a great meal.",
    "Nutella Pizza is a must try. Absolutely delicious!",
    "Fast service even on a busy Friday night. Impressed!",
    "The Carbonara was creamy and perfectly cooked. Loved it.",
    "Best Smash Burger I've had in a long time. Crispy and juicy!",
    "May 8 experience was exceptional! Spicy Paneer pizza is now my favourite.",
    "Loved the ambience on May 10 Saturday. Staff were very attentive and warm.",
    "The Tiramisu on May 11 was the best dessert I've had in months!",
    "Even on May 15 Friday rush, our pizza arrived in 18 minutes. Impressive!",
    "May 1 was our anniversary dinner and the team made it so special. Thank you!",
    "Best Nutella Milkshake in the city. We visit every week just for that!",
    "The Chicken Tikka Pizza is incredible value. Highly recommend.",
    "Service has really improved! May 8 was our smoothest visit yet.",
    "May 3 Saturday brunch — relaxed, fast, and the brownie was divine.",
    "Staff remembered our usual order on May 14. That personal touch matters.",
]
neutrals = [
    "Decent food but nothing extraordinary. Average experience overall.",
    "Prices are a bit high for the portion size.",
    "Good location, parking was a bit tricky.",
    "The music was too loud on May 13. Hard to have a conversation.",
    "Food was fine, nothing stood out. Might try another place next time.",
    "Ambience is nice but service felt rushed on a Saturday evening.",
]

feedback_list = []
for i, order in enumerate(sample_orders):
    if i < 42:
        text, sentiment = random.choice(complaints), SentimentType.negative
    elif i < 108:
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
print(f"  Added {len(feedback_list)} feedback entries")

# ── 6. Decision logs (May 16 planning perspective) ──────
decision_logs = [
    DecisionLog(
        agent="reservation_agent",
        input_summary="May 1 Friday: 17 confirmed reservations, 68 guests — capacity reached before walk-ins.",
        retrieved_context="SOP: Max capacity 70. Pattern matched Apr 24 pre-rush signature.",
        reasoning_summary="Waitlist correctly activated from booking 14 on May 1. Apply stricter trigger for May 22.",
        action_recommended="For May 22, activate waitlist at booking 13 given higher observed base demand.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.92,
        critic_notes="Policy correctly applied. May 22 adjustment is data-justified.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="Apr 24 (138), May 1 (127), May 8 (108), May 15 (119) — 4-week sustained Friday peaks.",
        retrieved_context="Historical Friday data through May 16. Trend: 108–138 order range.",
        reasoning_summary="May 22 is a high-confidence peak. 120+ orders likely given trend.",
        action_recommended="Stage pizza bases by 5pm. Add 2 kitchen staff for May 22 6–10pm shift.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.91,
        critic_notes="Forecast is data-backed. Staffing recommendation is operationally feasible.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Post-May 15: Mozzarella 1.8kg (threshold 8kg), Dough 3.2kg (10kg), Basil 0.15kg (1kg), Pepperoni 1.4kg (4kg).",
        retrieved_context="6 ingredients below threshold. May 22 Friday is 6 days away.",
        reasoning_summary="Multi-ingredient critical shortage. May 22 service failure risk is high without emergency restock.",
        action_recommended="Emergency reorder by May 17: 6.2kg mozzarella, 6.8kg dough, 0.85kg basil, 2.6kg pepperoni, 0.9kg garlic, 10 burger buns.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.97,
        critic_notes="Urgent and justified. Quantities are realistic and bounded.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="9 Garlic Bread stockout complaints since May 1. 4 delivery packaging complaints. Pattern repeating every Friday.",
        retrieved_context="Qdrant match: 7 prior incidents with same pattern from Apr 24 and May 1 rushes.",
        reasoning_summary="Garlic Bread depletion by 8:30pm is a recurring, predictable Friday failure mode.",
        action_recommended="Pre-stock 80 Garlic Bread portions by 5pm on May 22. Brief delivery team on heat packaging protocol.",
        critic_verdict=CriticVerdict.revision,
        critic_score=0.77,
        critic_notes="Add named owner and explicit deadline for delivery team briefing.",
    ),
    DecisionLog(
        agent="reservation_agent",
        input_summary="May 22 Friday: 16 confirmed reservations, 65 guests. 3 on waitlist.",
        retrieved_context="SOP: Close online reservations when confirmed guests exceed 85% capacity (59 guests).",
        reasoning_summary="May 22 already at 92% capacity with reservations. Walk-in demand will push past limit.",
        action_recommended="Close May 22 online bookings by May 20 EOD. Reserve 8-guest walk-in buffer.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.90,
        critic_notes="Timely closure call. Walk-in buffer is operationally sound.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="May 25 Monday: pre-summer pattern + spillover from May 22-24 weekend. Projected 55-65 orders.",
        retrieved_context="Historical holiday Mondays average 52 orders. External signals elevate May 25 estimate.",
        reasoning_summary="May 25 is likely 20-25% above average weekday. Staff and stock accordingly.",
        action_recommended="Add 1 extra floor staff for May 25 lunch (12–3pm). Pre-stock sides and beverages.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.83,
        critic_notes="Conservative forecast with appropriate staffing recommendation.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Tiramisu Cream at 9.5kg — adequate today but will deplete by May 24 at peak weekend rate.",
        retrieved_context="May 22 Friday + May 23-24 weekend = high dessert demand cluster.",
        reasoning_summary="Tiramisu Cream will breach threshold by May 24 evening without mid-week reorder.",
        action_recommended="Order 5kg Tiramisu Cream by May 20 to cover the May 22-24 peak window.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.88,
        critic_notes="Proactive perishable restock — well-timed and appropriately sized.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="Positive trend: May 8 Saturday rated 4.5+, May 11 Tiramisu praised, May 15 fast delivery noted.",
        retrieved_context="8 positive feedback entries retrieved for May 8–15 window.",
        reasoning_summary="Non-rush Saturday service quality is improving. Replicate May 8 staffing model.",
        action_recommended="Apply May 8 staffing model to May 23 Saturday. Share positive feedback with kitchen team at pre-shift.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.84,
        critic_notes="Positive reinforcement is a valid operational signal.",
    ),
    DecisionLog(
        agent="reservation_agent",
        input_summary="May 29 Friday: 13 confirmed reservations, 51 guests. Waitlist starts at booking 12.",
        retrieved_context="SOP: 85% threshold = 59 guests. May 29 currently at 73% with reservations.",
        reasoning_summary="May 29 has room for walk-ins. Online reservations can stay open until May 27.",
        action_recommended="Keep May 29 online reservations open until May 27 EOD. Monitor walk-in demand on the day.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.87,
        critic_notes="Correct threshold application for a mid-peak Friday.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="June 5 Friday: corporate events + school end-of-term week nearby. High external demand signal.",
        retrieved_context="2 corporate events within 500m on June 5. Historical: end-of-term weeks add +15% Friday demand.",
        reasoning_summary="June 5 may match or exceed May 15 (119 orders). Early preparation window is now open.",
        action_recommended="Begin June 5 prep by June 2: order extra mozzarella and dough, book 3 standby kitchen staff.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.86,
        critic_notes="Proactive planning endorsed. External signals justify elevated prep.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="June planning: Chicken at 12kg — will deplete with June 5 high-demand Friday cluster.",
        retrieved_context="June 5 projected 120+ orders. Chicken is used in BBQ Pizza, Tikka Pizza, Crispy Burger — top-3 sellers.",
        reasoning_summary="Chicken stock will fall below threshold by June 4 without proactive reorder.",
        action_recommended="Order 8kg Chicken by June 2 to buffer June 5 demand.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.89,
        critic_notes="Forward-looking inventory action well-timed for June peak.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="June 1 Monday: 16 reservations on Bank Holiday Monday — first June spike detected.",
        retrieved_context="May 25 Monday showed 62 orders — 28% above average weekday. June 1 expected similar.",
        reasoning_summary="Holiday Mondays are a recurring high-demand pattern. Brief staff proactively.",
        action_recommended="Run June 1 pre-service briefing by 11:30am. Pre-stock sides by 11am. Add 1 floor staff.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.85,
        critic_notes="Operationally sound. Briefing timing is appropriate.",
    ),
    DecisionLog(
        agent="reservation_agent",
        input_summary="June 5 Friday: 17 confirmed reservations, 70 guests — at maximum capacity.",
        retrieved_context="SOP: Capacity 70. June 5 bookings have reached the hard limit.",
        reasoning_summary="June 5 is the first Friday to hit hard capacity in the planning window. Immediate closure needed.",
        action_recommended="Close June 5 online reservations immediately. Maintain strict waitlist with 4-party maximum.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.96,
        critic_notes="Hard capacity limit reached — closure is non-negotiable per SOP.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="June 12 Friday: 15 reservations, 60 guests. Projected 110-120 orders based on 4-week June trend.",
        retrieved_context="June 5 (projected 130+), June 1 holiday Monday (62 orders) signal sustained high June demand.",
        reasoning_summary="June 12 is a regular peak Friday. No external amplifiers detected.",
        action_recommended="Standard May 22 protocol: 2 kitchen staff 6–10pm, pizza bases staged by 5pm, 80 Garlic Bread pre-stocked.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.88,
        critic_notes="Protocol reuse is correct. No special action needed beyond standard Friday prep.",
    ),
]
session.add_all(decision_logs)
session.commit()
print(f"  Added {len(decision_logs)} decision logs")

session.close()
print("\nCortexKitchen demo data seeded successfully.")
print(f"  Historical : Jan 16 – May 16, 2026")
print(f"  Future     : May 17 – June 14, 2026")
print(f"  Scenarios  : Friday rushes x4, weekend peaks x8, weekday lunches x8,")
print(f"               holiday spikes x3, low-stock Sunday (May 17)")
print(f"  Inventory  : 6 critical shortages ready for agent triage")
