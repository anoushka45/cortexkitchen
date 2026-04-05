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

print("🧠 Seeding Qdrant vector memory...")

# ── 1. Seed SOP rules ──────────────────────────────────
sop_rules = [
    # Capacity
    "Maximum restaurant seating capacity is 70 guests at any time.",
    "When occupancy exceeds 90%, close online reservations and switch to waitlist only.",
    "Friday and Saturday evenings are peak periods. Minimum 3 kitchen staff required from 6pm to 11pm.",

    # Pizza operations
    "Pizza preparation time must not exceed 20 minutes during peak hours.",
    "Pre-prepare pizza bases for top 5 items by 5pm on Friday evenings.",
    "Dough must be prepared fresh daily. Do not use dough older than 24 hours.",
    "Mozzarella cheese must be checked for freshness before every shift.",

    # Inventory
    "Reorder ingredients when stock falls below the defined reorder threshold.",
    "Perishable items with spoilage risk must be checked daily.",
    "Garlic bread and sides must be stocked sufficiently for Friday peak — minimum 50 portions.",
    "Burger buns must be freshness-checked before every service. Stale buns must be discarded.",

    # Customer service
    "All customer complaints must be acknowledged within 5 minutes of being raised.",
    "Waiting time for confirmed reservations must not exceed 10 minutes.",
    "Tables must be cleaned and reset within 5 minutes of guests leaving.",
    "Staff must remain professional and courteous at all times when handling complaints.",

    # Delivery
    "Delivery orders must be dispatched within 30 minutes of being placed.",
    "Cold food complaints on delivery orders must trigger a quality review of packaging.",

    # Friday rush
    "Friday evening rush is defined as 7pm to 10pm. All hands on deck policy applies.",
    "During Friday rush, a dedicated expeditor must be stationed at the pass.",
    "Pre-rush briefing must be conducted at 5:30pm every Friday.",
]

print(f"\n  Seeding {len(sop_rules)} SOP rules...")
for i, rule in enumerate(sop_rules):
    memory.store_sop(
        text=rule,
        metadata={"rule_index": i, "category": "operational_sop"}
    )
    print(f"    ✔ SOP {i+1}: {rule[:60]}...")

# ── 2. Seed complaints from Postgres into Qdrant ───────
print(f"\n  Seeding complaints from Postgres...")
feedbacks = session.query(Feedback).all()
complaint_count = 0

for feedback in feedbacks:
    memory.store_complaint(
        text=feedback.raw_text,
        metadata={
            "feedback_id": feedback.id,
            "sentiment": feedback.sentiment.value if feedback.sentiment else None,
            "source": feedback.source.value if feedback.source else None,
        }
    )
    complaint_count += 1
    print(f"    ✔ Feedback {feedback.id}: {feedback.raw_text[:60]}...")

session.close()

print(f"\n✅ Qdrant memory seeded successfully!")
print(f"   {len(sop_rules)} SOP rules → sop_memory collection")
print(f"   {complaint_count} complaints → complaint_memory collection")
print(f"\n🍕 RAG memory is ready!")