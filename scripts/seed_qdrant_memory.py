import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'apps', 'api')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'apps', 'api', '.env'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infrastructure.vector.qdrant_client import get_qdrant_client
from app.infrastructure.vector.embedding_service import EmbeddingService
from app.infrastructure.vector.memory_service import MemoryService
from app.infrastructure.db.models import Feedback

# ── Setup ──────────────────────────────────────────────
DATABASE_URL = "postgresql://cortex:cortexpass@localhost:5432/cortexkitchen"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

qdrant   = get_qdrant_client()
embedder = EmbeddingService()
memory   = MemoryService(qdrant, embedder)

print("Seeding Qdrant vector memory...")

# ── 1. SOP rules ───────────────────────────────────────
sop_rules = [
    # ── Capacity management ──
    "Maximum restaurant seating capacity is 70 guests at any time.",
    "When occupancy exceeds 90%, close online reservations and switch to waitlist only.",
    "When Friday confirmed bookings exceed 13 parties, activate waitlist immediately.",
    "Online reservations for a Friday must be closed no later than 48 hours before service if near capacity.",
    "Walk-in capacity buffer must not exceed 8 guests on peak Friday or Saturday evenings.",
    "Friday and Saturday evenings are peak periods. Minimum 3 kitchen staff required from 6pm to 11pm.",

    # ── Pizza operations ──
    "Pizza preparation time must not exceed 20 minutes during peak hours.",
    "Pre-prepare pizza bases for top 5 items by 5pm on Friday evenings.",
    "On Fridays with 14 or more reservations, stage extra mozzarella and dough by 4:30pm.",
    "Dough must be prepared fresh daily. Do not use dough older than 24 hours.",
    "Mozzarella cheese must be checked for freshness before every shift.",

    # ── Inventory management ──
    "Reorder ingredients when stock falls below the defined reorder threshold.",
    "Perishable items with spoilage risk must be checked daily.",
    "Garlic bread and sides must be stocked sufficiently for Friday peak — minimum 80 portions.",
    "Burger buns must be freshness-checked before every service. Stale buns must be discarded.",
    "Post-Friday rush inventory check must be completed by 10am Saturday.",
    "Emergency reorders for critical ingredients must be placed within 24 hours of threshold breach.",
    "Monthly inventory audit must be conducted on the first Monday of each month.",

    # ── Customer service ──
    "All customer complaints must be acknowledged within 5 minutes of being raised.",
    "Waiting time for confirmed reservations must not exceed 10 minutes.",
    "Tables must be cleaned and reset within 5 minutes of guests leaving.",
    "Staff must remain professional and courteous at all times when handling complaints.",
    "Positive feedback must be shared with the kitchen team at the next pre-shift briefing.",

    # ── Delivery ──
    "Delivery orders must be dispatched within 30 minutes of being placed.",
    "Cold food complaints on delivery orders must trigger a quality review of packaging.",
    "If more than 3 delivery packaging complaints are received in a single day, escalate to kitchen manager.",

    # ── Friday rush protocol ──
    "Friday evening rush is defined as 7pm to 10pm. All hands on deck policy applies.",
    "During Friday rush, a dedicated expeditor must be stationed at the pass.",
    "Pre-rush briefing must be conducted at 5:30pm every Friday.",
    "Standard Friday prep: 80 Garlic Bread portions by 5pm, pizza bases staged, 2 extra kitchen staff from 6pm.",

    # ── Weekend operations ──
    "Weekend brunch service (12pm–3pm): ensure dessert and beverage stocks are doubled.",
    "Saturday service debrief must be conducted at 10pm to flag Sunday prep needs.",
    "Weekend walk-in demand typically adds 15–20% to reservation-based headcount estimates.",
    "Post-peak-Friday Sundays should be treated as moderate-high demand days for stock purposes.",

    # ── Weekday lunch ──
    "Weekday lunch specials must be prepped and ready by 11:30am daily.",
    "Weekday lunch service (12pm–3pm) requires minimum 2 kitchen staff and 1 floor staff.",
    "Office and corporate lunch bookings must be confirmed with a named point of contact.",
    "When weekday lunch reservations exceed 7 parties, add 1 additional floor staff.",

    # ── Holiday and special events ──
    "Holiday Mondays must be treated as Saturday-equivalent for staffing and stock purposes.",
    "When external events (corporate, festivals) are nearby, elevate demand forecast by 15–20%.",
    "For all high-demand planning windows, begin prep at least 72 hours in advance.",
    "Start-of-month Mondays (e.g. June 1) should be monitored as potential mini-holiday spikes.",
]

print(f"\n  Seeding {len(sop_rules)} SOP rules...")
for i, rule in enumerate(sop_rules):
    memory.store_sop(
        text=rule,
        metadata={"rule_index": i, "category": "operational_sop"}
    )
    print(f"    SOP {i+1:02d}: {rule[:70]}...")

# ── 2. Seed complaints from Postgres into Qdrant ───────
print(f"\n  Seeding complaints from Postgres...")
feedbacks = session.query(Feedback).all()
complaint_count = 0

for feedback in feedbacks:
    memory.store_complaint(
        text=feedback.raw_text,
        metadata={
            "feedback_id": feedback.id,
            "sentiment":   feedback.sentiment.value if feedback.sentiment else None,
            "source":      feedback.source.value if feedback.source else None,
        }
    )
    complaint_count += 1
    print(f"    Feedback {feedback.id}: {feedback.raw_text[:65]}...")

session.close()

print(f"\nQdrant memory seeded successfully.")
print(f"  {len(sop_rules)} SOP rules  → sop_memory collection")
print(f"  {complaint_count} feedback entries → complaint_memory collection")
print(f"\nRAG memory ready for May 17 – June 14 planning window.")
