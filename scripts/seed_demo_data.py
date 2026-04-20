import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'apps', 'api')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import random

from app.infrastructure.db.base import Base
from app.infrastructure.db.models import (
    MenuItem, Reservation, Order, Inventory, Feedback, DecisionLog,
    ReservationStatus, SentimentType, FeedbackSource, CriticVerdict
)

DATABASE_URL = "postgresql://cortex:cortexpass@localhost:5432/cortexkitchen"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

print("🍕 Seeding CortexKitchen demo data...")

# ── Clear existing data ────────────────────────────────
session.query(DecisionLog).delete()
session.query(Feedback).delete()
session.query(Order).delete()
session.query(Reservation).delete()
session.query(Inventory).delete()
session.query(MenuItem).delete()
session.commit()
print("  ✔ Cleared existing data")

# ── 1. MENU ITEMS ──────────────────────────────────────
menu_items = [
    MenuItem(name="Margherita",           category="pizza",    price=349.0, is_available=True),
    MenuItem(name="Pepperoni Feast",      category="pizza",    price=449.0, is_available=True),
    MenuItem(name="BBQ Chicken",          category="pizza",    price=499.0, is_available=True),
    MenuItem(name="Veggie Supreme",       category="pizza",    price=399.0, is_available=True),
    MenuItem(name="Four Cheese",          category="pizza",    price=479.0, is_available=True),
    MenuItem(name="Spicy Paneer",         category="pizza",    price=429.0, is_available=True),
    MenuItem(name="Mushroom Truffle",     category="pizza",    price=529.0, is_available=True),
    MenuItem(name="Chicken Tikka Pizza",  category="pizza",    price=499.0, is_available=True),
    MenuItem(name="Penne Arrabbiata",     category="pasta",    price=299.0, is_available=True),
    MenuItem(name="Spaghetti Carbonara",  category="pasta",    price=349.0, is_available=True),
    MenuItem(name="Pesto Fusilli",        category="pasta",    price=329.0, is_available=True),
    MenuItem(name="Classic Smash Burger", category="burger",   price=349.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger",category="burger",   price=329.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger",category="burger",   price=369.0, is_available=True),
    MenuItem(name="Garlic Bread",         category="sides",    price=149.0, is_available=True),
    MenuItem(name="Loaded Fries",         category="sides",    price=179.0, is_available=True),
    MenuItem(name="Onion Rings",          category="sides",    price=159.0, is_available=True),
    MenuItem(name="Tiramisu",             category="dessert",  price=229.0, is_available=True),
    MenuItem(name="Nutella Pizza",        category="dessert",  price=279.0, is_available=True),
    MenuItem(name="Chocolate Brownie",    category="dessert",  price=199.0, is_available=True),
    MenuItem(name="Classic Lemonade",     category="beverage", price=99.0,  is_available=True),
    MenuItem(name="Nutella Milkshake",    category="beverage", price=179.0, is_available=True),
    MenuItem(name="Coca Cola",            category="beverage", price=79.0,  is_available=True),
    MenuItem(name="Mango Smoothie",       category="beverage", price=149.0, is_available=True),
]
session.add_all(menu_items)
session.commit()
print(f"  ✔ {len(menu_items)} menu items added")

# ── 2. INVENTORY ───────────────────────────────────────
# Mix of healthy stock, shortages, and overstock to make alerts fire
inventory_items = [
    # Shortages — will trigger alerts
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg",     quantity_in_stock=3.5,   reorder_threshold=8.0,  spoilage_risk=True),   # critical shortage
    Inventory(ingredient_name="Pizza Dough",       unit="kg",     quantity_in_stock=6.0,   reorder_threshold=10.0, spoilage_risk=True),   # critical shortage
    Inventory(ingredient_name="Pepperoni",         unit="kg",     quantity_in_stock=2.5,   reorder_threshold=4.0,  spoilage_risk=True),   # warning shortage
    Inventory(ingredient_name="Burger Buns",       unit="units",  quantity_in_stock=15.0,  reorder_threshold=20.0, spoilage_risk=True),   # warning shortage
    Inventory(ingredient_name="Garlic",            unit="kg",     quantity_in_stock=0.8,   reorder_threshold=1.5,  spoilage_risk=True),   # critical shortage

    # Healthy stock — no alerts
    Inventory(ingredient_name="Tomato Sauce",      unit="litres", quantity_in_stock=18.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Chicken",           unit="kg",     quantity_in_stock=15.0,  reorder_threshold=6.0,  spoilage_risk=True),
    Inventory(ingredient_name="Paneer",            unit="kg",     quantity_in_stock=6.0,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil",         unit="litres", quantity_in_stock=10.0,  reorder_threshold=3.0,  spoilage_risk=False),
    Inventory(ingredient_name="Nutella",           unit="kg",     quantity_in_stock=4.0,   reorder_threshold=2.0,  spoilage_risk=False),

    # Overstock — will trigger overstock alerts
    Inventory(ingredient_name="Pasta",             unit="kg",     quantity_in_stock=80.0,  reorder_threshold=8.0,  spoilage_risk=False),  # info overstock
    Inventory(ingredient_name="Coca Cola Cans",    unit="units",  quantity_in_stock=500.0, reorder_threshold=40.0, spoilage_risk=False),  # info overstock
]
session.add_all(inventory_items)
session.commit()
print(f"  ✔ {len(inventory_items)} inventory items added (with real shortages + overstock)")

# ── 3. RESERVATIONS ────────────────────────────────────
random.seed(42)
reservations = []

# 90 days of historical reservations for a richer pattern
base_date = datetime.now() - timedelta(days=90)

for day_offset in range(90):
    current_date = base_date + timedelta(days=day_offset)
    is_friday  = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]

    if is_friday:
        count = random.randint(10, 14)
    elif is_weekend:
        count = random.randint(6, 8)
    else:
        count = random.randint(2, 4)

    for _ in range(count):
        hour = random.choice([13, 14, 19, 20, 21] if is_friday else [13, 19, 20])
        status = random.choices(
            [ReservationStatus.confirmed, ReservationStatus.completed,
             ReservationStatus.cancelled, ReservationStatus.waitlist],
            weights=[20, 60, 10, 10]
        )[0]
        reservations.append(Reservation(
            guest_name=random.choice([
                "Priya Sharma", "Rohan Mehta", "Ananya Singh", "Arjun Patel",
                "Sneha Iyer", "Vikram Nair", "Pooja Desai", "Karan Malhotra",
                "Isha Joshi", "Dev Kapoor", "Riya Verma", "Aditya Rao"
            ]),
            guest_count=random.randint(2, 8),
            reserved_at=current_date.replace(
                hour=hour, minute=random.choice([0, 15, 30, 45])
            ),
            status=status,
            table_number=random.randint(1, 15),
            notes=random.choice([
                None, None, None,
                "Window seat please",
                "Birthday celebration",
                "Allergic to nuts"
            ])
        ))

# Upcoming Friday 24th April reservations — confirmed, future
next_friday = datetime(2026, 4, 24)
upcoming_names = [
    ("Priya Sharma", 4), ("Rohan Mehta", 2), ("Ananya Singh", 6),
    ("Arjun Patel", 3),  ("Sneha Iyer", 5),  ("Vikram Nair", 2),
    ("Pooja Desai", 4),  ("Karan Malhotra", 8), ("Isha Joshi", 2),
    ("Dev Kapoor", 3),   ("Riya Verma", 4),  ("Aditya Rao", 6),
]
for name, guests in upcoming_names:
    hour = random.choice([19, 20, 21])
    reservations.append(Reservation(
        guest_name=name,
        guest_count=guests,
        reserved_at=next_friday.replace(
            hour=hour, minute=random.choice([0, 15, 30, 45])
        ),
        status=ReservationStatus.confirmed,
        table_number=random.randint(1, 15),
        notes=random.choice([None, None, "Birthday celebration", "Window seat please"])
    ))

session.add_all(reservations)
session.commit()
print(f"  ✔ {len(reservations)} reservations added (90 days history + 12 upcoming for Apr 24)")

# ── 4. ORDERS ──────────────────────────────────────────
menu_items_db = session.query(MenuItem).all()
pizza_items = [m for m in menu_items_db if m.category == "pizza"]
other_items  = [m for m in menu_items_db if m.category != "pizza"]

orders = []

# 90 days of orders with strong Friday spikes for Prophet
for day_offset in range(90):
    current_date = base_date + timedelta(days=day_offset)
    is_friday  = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [5, 6]

    if is_friday:
        order_count = random.randint(80, 110)   # strong Friday spike
    elif is_weekend:
        order_count = random.randint(40, 60)
    else:
        order_count = random.randint(15, 25)

    for _ in range(order_count):
        item = random.choice(pizza_items) if random.random() < 0.65 else random.choice(other_items)
        quantity = random.randint(1, 3)

        # Friday peak hours 6pm-11pm get more weight
        if is_friday:
            hour = random.choices(
                [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
                weights=[3, 5, 4, 3, 3, 5, 12, 18, 16, 12, 8]
            )[0]
        else:
            hour = random.choice([12, 13, 14, 19, 20, 21])

        orders.append(Order(
            menu_item_id=item.id,
            quantity=quantity,
            total_price=round(item.price * quantity, 2),
            ordered_at=current_date.replace(hour=hour, minute=random.randint(0, 59)),
            is_delivery=random.choice([True, False])
        ))

session.add_all(orders)
session.commit()
print(f"  ✔ {len(orders)} orders added (90 days, strong Friday spikes for Prophet)")

# ── 5. FEEDBACK ────────────────────────────────────────
orders_db    = session.query(Order).all()
sample_orders = random.sample(orders_db, min(60, len(orders_db)))

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
    if i < 20:
        text, sentiment = random.choice(complaints), SentimentType.negative
    elif i < 50:
        text, sentiment = random.choice(positives), SentimentType.positive
    else:
        text, sentiment = random.choice(neutrals),  SentimentType.neutral

    feedback_list.append(Feedback(
        order_id=order.id,
        raw_text=text,
        sentiment=sentiment,
        source=random.choice(list(FeedbackSource)),
    ))

session.add_all(feedback_list)
session.commit()
print(f"  ✔ {len(feedback_list)} feedback entries added")

# ── 6. DECISION LOGS ───────────────────────────────────
decision_logs = [
    DecisionLog(
        agent="reservation_agent",
        input_summary="Friday 7pm slot has 12 confirmed reservations for 68 guests. Capacity is 70.",
        retrieved_context="SOP: Max capacity 70 guests. Overbooking threshold 85%.",
        reasoning_summary="Current bookings at 97% capacity. High risk of overbooking if walk-ins arrive.",
        action_recommended="Close online reservations for Friday 7-9pm. Enable waitlist only.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.91,
        critic_notes="Action is within safe operational bounds. Waitlist strategy is appropriate.",
    ),
    DecisionLog(
        agent="demand_forecast_agent",
        input_summary="Last 4 Fridays averaged 95 orders between 6-10pm.",
        retrieved_context="Historical Friday peak data retrieved from order logs.",
        reasoning_summary="Forecast predicts 100-115 orders this Friday evening. Staffing planned for 70.",
        action_recommended="Add 2 kitchen staff for Friday 6-10pm shift. Pre-prepare pizza bases by 5pm.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.88,
        critic_notes="Staffing recommendation is cost-effective and operationally safe.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="20 complaints in last 4 weeks. Top issue: long wait times on Fridays.",
        retrieved_context="Similar complaints retrieved from vector memory: 3 matching past incidents.",
        reasoning_summary="Recurring pattern — pizza prep delay causes 40+ min wait times on Fridays.",
        action_recommended="Implement pre-bake strategy for top 3 pizzas from 6pm on Fridays.",
        critic_verdict=CriticVerdict.revision,
        critic_score=0.74,
        critic_notes="Pre-bake strategy needs quality check SOP before approval.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mozzarella at 3.5kg, threshold 8kg. Pizza Dough at 6kg, threshold 10kg.",
        retrieved_context="Reorder threshold breach detected. Both items have spoilage risk.",
        reasoning_summary="Critical shortages on high-demand Friday. Immediate reorder required.",
        action_recommended="Order 10kg Mozzarella and 15kg Pizza Dough by Thursday noon.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.95,
        critic_notes="Inventory action is safe, timely, and within budget guidelines.",
    ),
]
session.add_all(decision_logs)
session.commit()
print(f"  ✔ {len(decision_logs)} decision logs added")

session.close()
print("\n✅ CortexKitchen demo data seeded successfully!")
print("   Ready for Friday Night Rush Optimization 🍕🚀")