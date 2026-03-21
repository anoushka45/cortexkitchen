from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, Text, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.infrastructure.db.base import Base


# ── Enums ──────────────────────────────────────────────

class ReservationStatus(str, enum.Enum):
    confirmed = "confirmed"
    cancelled = "cancelled"
    waitlist  = "waitlist"
    completed = "completed"

class SentimentType(str, enum.Enum):
    positive = "positive"
    neutral  = "neutral"
    negative = "negative"

class FeedbackSource(str, enum.Enum):
    google    = "google"
    in_person = "in_person"
    zomato    = "zomato"
    swiggy    = "swiggy"

class CriticVerdict(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    revision = "revision"


# ── 1. menu_items ──────────────────────────────────────

class MenuItem(Base):
    __tablename__ = "menu_items"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    name         = Column(String(100), nullable=False)
    category     = Column(String(50), nullable=False)   # e.g. pizza, beverage, dessert
    price        = Column(Float, nullable=False)
    is_available = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="menu_item")


# ── 2. reservations ────────────────────────────────────

class Reservation(Base):
    __tablename__ = "reservations"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    guest_name   = Column(String(100), nullable=False)
    guest_count  = Column(Integer, nullable=False)
    reserved_at  = Column(DateTime, nullable=False)     # actual booking time slot #The reserved_at field is what the Reservation Agent analyses for peak load.
    status       = Column(Enum(ReservationStatus), default=ReservationStatus.confirmed)
    table_number = Column(Integer, nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)


# ── 3. orders ──────────────────────────────────────────
#The ordered_at timestamp is what the Demand Forecast Agent uses to detect patterns like Friday spikes. Also links to Feedback so a complaint can be traced back to a specific order.
class Order(Base):
    __tablename__ = "orders"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    quantity     = Column(Integer, nullable=False)
    total_price  = Column(Float, nullable=False)
    ordered_at   = Column(DateTime, default=datetime.utcnow)  # drives demand forecasting
    is_delivery  = Column(Boolean, default=False)

    menu_item = relationship("MenuItem", back_populates="orders")
    feedback  = relationship("Feedback", back_populates="order")


# ── 4. inventory ───────────────────────────────────────

class Inventory(Base):
    __tablename__ = "inventory"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    ingredient_name   = Column(String(100), nullable=False)
    unit              = Column(String(20), nullable=False)    # kg, litres, units
    quantity_in_stock = Column(Float, nullable=False)
    reorder_threshold = Column(Float, nullable=False)        # alert if stock drops below this
    spoilage_risk     = Column(Boolean, default=False)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── 5. feedback ────────────────────────────────────────

class Feedback(Base):
    __tablename__ = "feedback"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=True)  # optional link
    raw_text   = Column(Text, nullable=False)                             # complaint or review text
    sentiment  = Column(Enum(SentimentType), nullable=True)
    source     = Column(Enum(FeedbackSource), default=FeedbackSource.in_person)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="feedback")


# ── 6. decision_logs ───────────────────────────────────

class DecisionLog(Base):
    __tablename__ = "decision_logs"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    agent              = Column(String(50), nullable=False)    # which agent made this
    input_summary      = Column(Text, nullable=True)           # what data it received
    retrieved_context  = Column(Text, nullable=True)           # RAG context used
    reasoning_summary  = Column(Text, nullable=True)           # LLM reasoning
    action_recommended = Column(Text, nullable=False)          # the actual recommendation
    critic_verdict     = Column(Enum(CriticVerdict), nullable=True)
    critic_score       = Column(Float, nullable=True)          # 0.0 - 1.0
    critic_notes       = Column(Text, nullable=True)
    metadata_          = Column("metadata", JSONB, nullable=True)  # flexible extra data
    created_at         = Column(DateTime, default=datetime.utcnow)


"""
MenuItem  ──< Order >── Feedback
                           
Reservation (standalone)
Inventory   (standalone)
DecisionLog (standalone)

 """