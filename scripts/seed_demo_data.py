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

# ── Database connection ────────────────────────────────
DATABASE_URL = "postgresql://cortex:cortexpass@localhost:5432/cortexkitchen"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

print("🍕 Seeding CortexKitchen demo data...")

# ── 1. MENU ITEMS ──────────────────────────────────────
menu_items = [
    # Pizzas (stars of the show!)
    MenuItem(name="Margherita",          category="pizza",    price=349.0, is_available=True),
    MenuItem(name="Pepperoni Feast",     category="pizza",    price=449.0, is_available=True),
    MenuItem(name="BBQ Chicken",         category="pizza",    price=499.0, is_available=True),
    MenuItem(name="Veggie Supreme",      category="pizza",    price=399.0, is_available=True),
    MenuItem(name="Four Cheese",         category="pizza",    price=479.0, is_available=True),
    MenuItem(name="Spicy Paneer",        category="pizza",    price=429.0, is_available=True),
    MenuItem(name="Mushroom Truffle",    category="pizza",    price=529.0, is_available=True),
    MenuItem(name="Chicken Tikka Pizza", category="pizza",    price=499.0, is_available=True),
    # Pastas
    MenuItem(name="Penne Arrabbiata",   category="pasta",    price=299.0, is_available=True),
    MenuItem(name="Spaghetti Carbonara",category="pasta",    price=349.0, is_available=True),
    MenuItem(name="Pesto Fusilli",      category="pasta",    price=329.0, is_available=True),
    # Burgers
    MenuItem(name="Classic Smash Burger",  category="burger", price=349.0, is_available=True),
    MenuItem(name="Crispy Chicken Burger", category="burger", price=329.0, is_available=True),
    MenuItem(name="Mushroom Swiss Burger", category="burger", price=369.0, is_available=True),
    # Sides
    MenuItem(name="Garlic Bread",       category="sides",    price=149.0, is_available=True),
    MenuItem(name="Loaded Fries",       category="sides",    price=179.0, is_available=True),
    MenuItem(name="Onion Rings",        category="sides",    price=159.0, is_available=True),
    # Desserts
    MenuItem(name="Tiramisu",           category="dessert",  price=229.0, is_available=True),
    MenuItem(name="Nutella Pizza",      category="dessert",  price=279.0, is_available=True),
    MenuItem(name="Chocolate Brownie",  category="dessert",  price=199.0, is_available=True),
    # Beverages
    MenuItem(name="Classic Lemonade",   category="beverage", price=99.0,  is_available=True),
    MenuItem(name="Nutella Milkshake",  category="beverage", price=179.0, is_available=True),
    MenuItem(name="Coca Cola",          category="beverage", price=79.0,  is_available=True),
    MenuItem(name="Mango Smoothie",     category="beverage", price=149.0, is_available=True),
]

session.add_all(menu_items)
session.commit()
print(f"  ✔ {len(menu_items)} menu items added")

# ── 2. INVENTORY ───────────────────────────────────────
inventory_items = [
    Inventory(ingredient_name="Pizza Dough",       unit="kg",    quantity_in_stock=25.0,  reorder_threshold=10.0, spoilage_risk=True),
    Inventory(ingredient_name="Mozzarella Cheese", unit="kg",    quantity_in_stock=12.0,  reorder_threshold=5.0,  spoilage_risk=True),
    Inventory(ingredient_name="Tomato Sauce",      unit="litres", quantity_in_stock=18.0, reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Pepperoni",         unit="kg",    quantity_in_stock=8.0,   reorder_threshold=4.0,  spoilage_risk=True),
    Inventory(ingredient_name="Chicken",           unit="kg",    quantity_in_stock=15.0,  reorder_threshold=6.0,  spoilage_risk=True),
    Inventory(ingredient_name="Paneer",            unit="kg",    quantity_in_stock=6.0,   reorder_threshold=3.0,  spoilage_risk=True),
    Inventory(ingredient_name="Pasta",             unit="kg",    quantity_in_stock=20.0,  reorder_threshold=8.0,  spoilage_risk=False),
    Inventory(ingredient_name="Burger Buns",       unit="units", quantity_in_stock=60.0,  reorder_threshold=20.0, spoilage_risk=True),
    Inventory(ingredient_name="Nutella",           unit="kg",    quantity_in_stock=4.0,   reorder_threshold=2.0,  spoilage_risk=False),
    Inventory(ingredient_name="Garlic",            unit="kg",    quantity_in_stock=3.0,   reorder_threshold=1.5,  spoilage_risk=True),
    Inventory(ingredient_name="Olive Oil",         unit="litres", quantity_in_stock=10.0, reorder_threshold=3.0,  spoilage_risk=False),
    Inventory(ingredient_name="Coca Cola Cans",    unit="units", quantity_in_stock=120.0, reorder_threshold=40.0, spoilage_risk=False),
]

session.add_all(inventory_items)
session.commit()
print(f"  ✔ {len(inventory_items)} inventory items added")

# ── 3. RESERVATIONS ────────────────────────────────────
# Simulate last 4 weeks with Friday spikes
random.seed(42)
reservations = []
base_date = datetime.now() - timedelta(weeks=4)

for day_offset in range(28):
    current_date = base_date + timedelta(days=day_offset)
    is_friday = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [4, 5]

    # Friday gets 10-14 reservations, weekends 6-8, weekdays 2-4
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
            reserved_at=current_date.replace(hour=hour, minute=random.choice([0, 15, 30, 45])),
            status=status,
            table_number=random.randint(1, 15),
            notes=random.choice([None, None, None, "Window seat please", "Birthday celebration", "Allergic to nuts"])
        ))

session.add_all(reservations)
session.commit()
print(f"  ✔ {len(reservations)} reservations added (with Friday spikes)")

# ── 4. ORDERS ──────────────────────────────────────────
# Refresh menu items to get IDs
menu_items_db = session.query(MenuItem).all()
pizza_items = [m for m in menu_items_db if m.category == "pizza"]
other_items = [m for m in menu_items_db if m.category != "pizza"]

orders = []
for day_offset in range(28):
    current_date = base_date + timedelta(days=day_offset)
    is_friday = current_date.weekday() == 4
    is_weekend = current_date.weekday() in [4, 5]

    # Friday gets 40-55 orders, weekends 25-35, weekdays 10-18
    if is_friday:
        order_count = random.randint(40, 55)
    elif is_weekend:
        order_count = random.randint(25, 35)
    else:
        order_count = random.randint(10, 18)

    for _ in range(order_count):
        # 65% chance of pizza order
        if random.random() < 0.65:
            item = random.choice(pizza_items)
        else:
            item = random.choice(other_items)

        quantity = random.randint(1, 3)
        hour = random.choice([13, 14, 15, 19, 20, 21] if is_friday else [13, 14, 19, 20])
        orders.append(Order(
            menu_item_id=item.id,
            quantity=quantity,
            total_price=round(item.price * quantity, 2),
            ordered_at=current_date.replace(hour=hour, minute=random.randint(0, 59)),
            is_delivery=random.choice([True, False])
        ))

session.add_all(orders)
session.commit()
print(f"  ✔ {len(orders)} orders added (Friday spikes, 65% pizza)")

# ── 5. FEEDBACK ────────────────────────────────────────
orders_db = session.query(Order).all()
sample_orders = random.sample(orders_db, min(40, len(orders_db)))

complaints = [
    "Pizza took over 45 minutes to arrive, completely unacceptable on a Friday night.",
    "The Pepperoni Feast was cold when it arrived. Very disappointing.",
    "Staff was rude and dismissive when I raised my concern.",
    "Tables were not cleaned properly between seatings.",
    "Ran out of Garlic Bread at 8pm on a Friday. Needs better planning.",
    "Waiting time for seating was 30 minutes even with a reservation.",
    "The burger bun was stale. Not fresh at all.",
    "Four Cheese pizza had very little cheese. Felt cheated.",
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
    if i < 15:
        text = random.choice(complaints)
        sentiment = SentimentType.negative
    elif i < 35:
        text = random.choice(positives)
        sentiment = SentimentType.positive
    else:
        text = random.choice(neutrals)
        sentiment = SentimentType.neutral

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
        input_summary="Last 4 Fridays averaged 48 orders between 7-10pm.",
        retrieved_context="Historical Friday peak data retrieved from order logs.",
        reasoning_summary="Forecast predicts 52-58 orders this Friday evening. Staffing currently planned for 40.",
        action_recommended="Add 2 kitchen staff for Friday 6-10pm shift. Pre-prepare pizza bases by 5pm.",
        critic_verdict=CriticVerdict.approved,
        critic_score=0.88,
        critic_notes="Staffing recommendation is cost-effective and operationally safe.",
    ),
    DecisionLog(
        agent="complaint_intelligence_agent",
        input_summary="15 complaints in last 4 weeks. Top issue: long wait times on Fridays.",
        retrieved_context="Similar complaints retrieved from vector memory: 3 matching past incidents.",
        reasoning_summary="Recurring pattern detected — pizza prep delay causes 40+ min wait times on Fridays.",
        action_recommended="Implement pre-bake strategy for top 3 pizzas from 6pm on Fridays.",
        critic_verdict=CriticVerdict.revision,
        critic_score=0.74,
        critic_notes="Pre-bake strategy needs quality check SOP before approval.",
    ),
    DecisionLog(
        agent="inventory_agent",
        input_summary="Mozzarella stock at 12kg. Friday forecast requires estimated 18kg.",
        retrieved_context="Reorder threshold: 5kg. Spoilage risk: True.",
        reasoning_summary="Current stock insufficient for projected Friday demand. Shortfall of ~6kg.",
        action_recommended="Order 10kg Mozzarella by Thursday noon for Friday delivery.",
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