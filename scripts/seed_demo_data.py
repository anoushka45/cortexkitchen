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
SEED_AS_OF = datetime(2026, 4, 26, 12, 0, 0)
HISTORY_DAYS = 120
FRIDAY_RUSH_DATE = datetime(2026, 4, 24)
NEXT_FRIDAY_TARGET = datetime(2026, 5, 1)
FUTURE_FRIDAY_TARGETS = [
    datetime(2026, 5, 1),
    datetime(2026, 5, 8),
    datetime(2026, 5, 15),
    datetime(2026, 5, 22),
]

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

random.seed(42)


def weighted_hour(is_friday: bool, is_weekend: bool) -> int:
    if is_friday:
        return random.choices(
            [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
            weights=[3, 5, 4, 3, 3, 5, 14, 20, 18, 14, 9],
        )[0]
    if is_weekend:
        return random.choices(
            [12, 13, 14, 17, 18, 19, 20, 21, 22],
            weights=[5, 8, 6, 4, 9, 13, 14, 11, 5],
        )[0]
    return random.choice([12, 13, 14, 19, 20, 21])


print("Seeding CortexKitchen demo data...")
print(f"  Seed as-of date: {SEED_AS_OF.date()}")
print(f"  Friday rush now historical: {FRIDAY_RUSH_DATE.date()}")
print(f"  Future planning Fridays: {', '.join(str(d.date()) for d in FUTURE_FRIDAY_TARGETS)}")

# Clear existing data.
session.query(DecisionLog).delete()
session.query(PlanningRun).delete()
session.query(Feedback).delete()
session.query(Order).delete()
session.query(Reservation).delete()
session.query(Inventory).delete()
session.query(MenuItem).delete()
session.commit()
print("  Cleared existing data")

# 1. Menu items.
menu_items = [
    MenuItem(name="Margherita", category="pizza", price=349.0, is_available=True),
    MenuItem(name="Pepperoni Feast", category="pizza", price=449.0, is_available=True),
    MenuItem(name="BBQ Chicken", category="pizza", price=499.0, is_available=True),
    MenuItem(name="Veggie Supreme", category="pizza", price=399.0, is_available=True),
    MenuItem(name="Four Cheese", category="pizza", price=479.0, is_available=True),
    MenuItem(name="Spicy Paneer", category="pizza", price=429.0, is_available=True),
    MenuItem(name="Mushroom Truffle", category="pizza", price=529.0, is_available=True),
    MenuItem(name="Chicken Tikka Pizza", category="pizza", price=499.0, is_available=True),
    MenuItem(name="Penne Arrabbiata", category="pasta", price=299.0, is_available=True),
    MenuItem(name="Spaghetti Carbonara", category="pasta", price=349.0, is_available=True),
    MenuItem(name="Pesto Fusilli", category="pasta", price=329.0, is_available=True),
    MenuItem(name="Classic Smash Burger", category="burger", price=349.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger", category="burger", price=329.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger", category="burger", price=369.0, is_available=True),
    MenuItem(name="Garlic Bread", category="sides", price=149.0, is_available=True),
    MenuItem(name="Loaded Fries", category="sides", price=179.0, is_available=True),
    MenuItem(name="Onion Rings", category="sides", price=159.0, is_available=True),
    MenuItem(name="Tiramisu", category="dessert", price=229.0, is_available=True),
    MenuItem(name="Nutella Pizza", category="dessert", price=279.0, is_available=True),
    MenuItem(name="Chocolate Brownie", category="dessert", price=199.0, is_available=True),
    MenuItem(name="Classic Lemonade", category="beverage", price=99.0, is_available=True),
    MenuItem(name="Nutella Milkshake", category="beverage", price=179.0, is_available=True),
    MenuItem(name="Coca Cola", category="beverage", price=79.0, is_available=True),
    MenuItem(name="Mango Smoothie", category="beverage", price=149.0, is_available=True),
]
session.add_all(menu_items)
session.commit()
print(f"  Added {len(menu_items)} menu items")

# 2. Inventory with enough breadth for Phase 2 sanity checks.
inventory_items = [
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg", quantity_in_stock=3.5, reorder_threshold=8.0, spoilage_risk=True),
    Inventory(ingredient_name="Pizza Dough", unit="kg", quantity_in_stock=6.0, reorder_threshold=10.0, spoilage_risk=True),
    Inventory(ingredient_name="Pepperoni", unit="kg", quantity_in_stock=2.5, reorder_threshold=4.0, spoilage_risk=True),
    Inventory(ingredient_name="Burger Buns", unit="units", quantity_in_stock=15.0, reorder_threshold=20.0, spoilage_risk=True),
    Inventory(ingredient_name="Garlic", unit="kg", quantity_in_stock=0.8, reorder_threshold=1.5, spoilage_risk=True),
    Inventory(ingredient_name="Fresh Basil", unit="kg", quantity_in_stock=0.4, reorder_threshold=1.0, spoilage_risk=True),
    Inventory(ingredient_name="Tomato Sauce", unit="litres", quantity_in_stock=18.0, reorder_threshold=8.0, spoilage_risk=False),
    Inventory(ingredient_name="Chicken", unit="kg", quantity_in_stock=15.0, reorder_threshold=6.0, spoilage_risk=True),
    Inventory(ingredient_name="Paneer", unit="kg", quantity_in_stock=6.0, reorder_threshold=3.0, spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil", unit="litres", quantity_in_stock=10.0, reorder_threshold=3.0, spoilage_risk=False),
    Inventory(ingredient_name="Nutella", unit="kg", quantity_in_stock=4.0, reorder_threshold=2.0, spoilage_risk=False),
    Inventory(ingredient_name="Pasta", unit="kg", quantity_in_stock=80.0, reorder_threshold=8.0, spoilage_risk=False),
    Inventory(ingredient_name="Coca Cola Cans", unit="units", quantity_in_stock=500.0, reorder_threshold=40.0, spoilage_risk=False),
    Inventory(ingredient_name="Tiramisu Cream", unit="kg", quantity_in_stock=14.0, reorder_threshold=3.0, spoilage_risk=True),
]
session.add_all(inventory_items)
session.commit()
print(f"  Added {len(inventory_items)} inventory items")

# 3. Reservations through Apr 26 plus future bookings for May 1.
reservations = []
base_date = SEED_AS_OF - timedelta(days=HISTORY_DAYS)

for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    is_friday = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]

    if current_date.date() == FRIDAY_RUSH_DATE.date():
        count = 18
    elif current_date.date() == datetime(2026, 4, 25).date():
        count = 11
    elif current_date.date() == SEED_AS_OF.date():
        count = 8
    elif is_friday:
        count = random.randint(10, 15)
    elif is_weekend:
        count = random.randint(6, 9)
    else:
        count = random.randint(2, 5)

    for _ in range(count):
        hour = random.choice([13, 14, 18, 19, 20, 21] if is_friday or is_weekend else [13, 19, 20])
        if current_date.date() >= SEED_AS_OF.date():
            status = random.choice([ReservationStatus.confirmed, ReservationStatus.waitlist])
        else:
            status = random.choices(
                [
                    ReservationStatus.confirmed,
                    ReservationStatus.completed,
                    ReservationStatus.cancelled,
                    ReservationStatus.waitlist,
                ],
                weights=[18, 62, 10, 10],
            )[0]

        reservations.append(
            Reservation(
                guest_name=random.choice(
                    [
                        "Priya Sharma",
                        "Rohan Mehta",
                        "Ananya Singh",
                        "Arjun Patel",
                        "Sneha Iyer",
                        "Vikram Nair",
                        "Pooja Desai",
                        "Karan Malhotra",
                        "Isha Joshi",
                        "Dev Kapoor",
                        "Riya Verma",
                        "Aditya Rao",
                    ]
                ),
                guest_count=random.randint(2, 8),
                reserved_at=current_date.replace(hour=hour, minute=random.choice([0, 15, 30, 45])),
                status=status,
                table_number=random.randint(1, 15),
                notes=random.choice([None, None, None, "Window seat please", "Birthday celebration", "Allergic to nuts"]),
            )
        )

future_booking_names = [
    ("Priya Sharma", 4),
    ("Rohan Mehta", 2),
    ("Ananya Singh", 6),
    ("Arjun Patel", 3),
    ("Sneha Iyer", 5),
    ("Vikram Nair", 2),
    ("Pooja Desai", 4),
    ("Karan Malhotra", 8),
    ("Isha Joshi", 2),
    ("Dev Kapoor", 3),
    ("Riya Verma", 4),
    ("Aditya Rao", 6),
    ("Meera Shah", 5),
    ("Kabir Sethi", 4),
    ("Naina Kapoor", 3),
]

future_friday_profiles = {
    datetime(2026, 5, 1).date(): {"count": 15, "waitlist_from": 12, "guest_adjustment": 0},
    datetime(2026, 5, 8).date(): {"count": 13, "waitlist_from": 11, "guest_adjustment": -1},
    datetime(2026, 5, 15).date(): {"count": 14, "waitlist_from": 12, "guest_adjustment": 1},
    datetime(2026, 5, 22).date(): {"count": 10, "waitlist_from": 9, "guest_adjustment": 0},
}

for target_friday in FUTURE_FRIDAY_TARGETS:
    profile = future_friday_profiles[target_friday.date()]
    for index, (name, guests) in enumerate(future_booking_names[: profile["count"]]):
        adjusted_guests = max(2, guests + profile["guest_adjustment"])
        reservations.append(
            Reservation(
                guest_name=name,
                guest_count=adjusted_guests,
                reserved_at=target_friday.replace(
                    hour=random.choice([19, 20, 21]),
                    minute=random.choice([0, 15, 30, 45]),
                ),
                status=ReservationStatus.waitlist
                if index >= profile["waitlist_from"]
                else ReservationStatus.confirmed,
                table_number=random.randint(1, 15),
                notes=random.choice([None, None, "Birthday celebration", "Window seat please"]),
            )
        )

session.add_all(reservations)
session.commit()
print(f"  Added {len(reservations)} reservations, including 4 future planning Fridays")

# 4. Orders through Apr 26 with explicit Apr 24 rush data.
menu_items_db = session.query(MenuItem).all()
pizza_items = [m for m in menu_items_db if m.category == "pizza"]
other_items = [m for m in menu_items_db if m.category != "pizza"]
popular_items = [
    m
    for m in menu_items_db
    if m.name
    in {
        "Margherita",
        "Pepperoni Feast",
        "Chicken Tikka Pizza",
        "Garlic Bread",
        "Loaded Fries",
    }
]

orders = []
for day_offset in range(HISTORY_DAYS + 1):
    current_date = base_date + timedelta(days=day_offset)
    is_friday = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]

    if current_date.date() == FRIDAY_RUSH_DATE.date():
        order_count = 138
    elif current_date.date() == datetime(2026, 4, 25).date():
        order_count = 72
    elif current_date.date() == SEED_AS_OF.date():
        order_count = 44
    elif is_friday:
        order_count = random.randint(85, 115)
    elif is_weekend:
        order_count = random.randint(45, 65)
    else:
        order_count = random.randint(18, 30)

    for _ in range(order_count):
        if current_date.date() == FRIDAY_RUSH_DATE.date() and random.random() < 0.75:
            item = random.choice(popular_items)
        else:
            item = random.choice(pizza_items) if random.random() < 0.65 else random.choice(other_items)

        quantity = random.randint(1, 3)
        orders.append(
            Order(
                menu_item_id=item.id,
                quantity=quantity,
                total_price=round(item.price * quantity, 2),
                ordered_at=current_date.replace(
                    hour=weighted_hour(is_friday, is_weekend),
                    minute=random.randint(0, 59),
                ),
                is_delivery=random.choice([True, False]),
            )
        )

session.add_all(orders)
session.commit()
print(f"  Added {len(orders)} orders over {HISTORY_DAYS + 1} days")

# 5. Feedback, with extra recent complaints from Apr 24-26.
orders_db = session.query(Order).all()
sample_orders = random.sample(orders_db, min(90, len(orders_db)))

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
]
neutrals = [
    "Decent food but nothing extraordinary. Average experience overall.",
    "Prices are a bit high for the portion size.",
    "Good location, parking was a bit tricky.",
]

feedback_list = []
for i, order in enumerate(sample_orders):
    if i < 32:
        text, sentiment = random.choice(complaints), SentimentType.negative
    elif i < 76:
        text, sentiment = random.choice(positives), SentimentType.positive
    else:
        text, sentiment = random.choice(neutrals), SentimentType.neutral

    feedback_list.append(
        Feedback(
            order_id=order.id,
            raw_text=text,
            sentiment=sentiment,
            source=random.choice(list(FeedbackSource)),
            created_at=order.ordered_at + timedelta(hours=random.randint(1, 48)),
        )
    )

session.add_all(feedback_list)
session.commit()
print(f"  Added {len(feedback_list)} feedback entries")

# 6. Decision logs with notes that reflect the new planning date.
decision_logs = [
    DecisionLog(
        agent="reservation_agent",
        input_summary="May 1 Friday has 15 reservations for 61 guests, including 3 waitlist parties.",
        retrieved_context="SOP: Max capacity 70 guests. Overbooking threshold 85%.",
        reasoning_summary="Bookings are already near the operational risk threshold before walk-ins.",
        action_recommended="Hold 7-9pm online reservations for May 1 and keep waitlist triage active.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.91,
        critic_notes="Action is within capacity policy and protects Friday service.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="Apr 24 closed at 138 orders; last Fridays show sustained 85-138 order range.",
        retrieved_context="Historical Friday peak data retrieved from order logs through Apr 26.",
        reasoning_summary="May 1 is likely to be another high-demand Friday.",
        action_recommended="Add 2 kitchen staff for May 1 6-10pm and stage pizza bases by 5pm.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.88,
        critic_notes="Staffing recommendation is cost-aware and operationally feasible.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="Recent complaints mention long waits, cold pizza, and Apr 24 dough stockout.",
        retrieved_context="Similar complaints retrieved from vector memory: 3 matching past incidents.",
        reasoning_summary="Wait-time and stockout patterns are recurring Friday risks.",
        action_recommended="Run pass-temperature checks and pre-shift stock verification for May 1.",
        critic_verdict=CriticVerdict.revision,
        critic_score=0.74,
        critic_notes="Needs a clearer owner and timing for each action.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mozzarella at 3.5kg, dough at 6kg, basil at 0.4kg before May 1 planning.",
        retrieved_context="Reorder threshold breach detected. Perishable items require 24h realism.",
        reasoning_summary="Critical shortages on high-demand Friday need bounded reorder quantities.",
        action_recommended="Order 4.5kg mozzarella, 4kg dough, and 0.6kg basil within 24 hours.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.95,
        critic_notes="Inventory action is realistic, timely, and below max actionable restock.",
    ),
]
session.add_all(decision_logs)
session.commit()
print(f"  Added {len(decision_logs)} decision logs")

session.close()
print("\nCortexKitchen demo data seeded successfully.")
print("Ready for May 1 Friday Rush evaluation refinement.")
