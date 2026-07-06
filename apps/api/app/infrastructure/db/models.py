from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, Text, ForeignKey, Enum, UniqueConstraint
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
    google          = "google"
    in_person       = "in_person"
    zomato          = "zomato"
    swiggy          = "swiggy"
    swiggy_delivery = "swiggy_delivery"

class ConnectorType(str, enum.Enum):
    swiggy         = "swiggy"
    pos_square     = "pos_square"
    google_reviews = "google_reviews"
    zomato         = "zomato"

class SyncStatus(str, enum.Enum):
    never_synced = "never_synced"
    syncing      = "syncing"
    success      = "success"
    error        = "error"

class CriticVerdict(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    revision = "revision"

class UserRole(str, enum.Enum):
    owner  = "owner"
    member = "member"


# ── Auth models ────────────────────────────────────────

_DEFAULT_SETTINGS = {
    "capacity": 70,
    "timezone": "Asia/Kolkata",
    "cuisine_type": "pizza",
    "peak_hours": "18:00-22:00",
    "critic_threshold": 0.7,
    "low_stock_threshold_pct": 20.0,
    "overstock_threshold_pct": 150.0,
}


class Organization(Base):
    __tablename__ = "organizations"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(100), nullable=False)
    slug       = Column(String(100), nullable=False, unique=True)
    settings   = Column(JSONB, nullable=True, default=_DEFAULT_SETTINGS)
    created_at = Column(DateTime, default=datetime.utcnow)

    members             = relationship("UserOrganization", back_populates="organization")
    planning_runs       = relationship("PlanningRun", back_populates="organization")
    restaurant_profiles = relationship("RestaurantProfile", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    email           = Column(String(255), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    full_name       = Column(String(100), nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    orgs = relationship("UserOrganization", back_populates="user")


class UserOrganization(Base):
    __tablename__ = "user_organizations"
    __table_args__ = (UniqueConstraint("user_id", "org_id", name="uq_user_org"),)

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    org_id     = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    role       = Column(Enum(UserRole), default=UserRole.member, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user         = relationship("User", back_populates="orgs")
    organization = relationship("Organization", back_populates="members")


# ── 1. menu_items ──────────────────────────────────────

class MenuItem(Base):
    __tablename__ = "menu_items"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    name         = Column(String(100), nullable=False)
    category     = Column(String(50), nullable=False)   # e.g. pizza, beverage, dessert
    price        = Column(Float, nullable=False)
    cost_price   = Column(Float, nullable=True)   # estimated cost to produce one unit -- COGS/profit basis
    is_available = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="menu_item")


# ── 2. reservations ────────────────────────────────────

class Reservation(Base):
    __tablename__ = "reservations"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    guest_name          = Column(String(100), nullable=False)
    guest_count         = Column(Integer, nullable=False)
    reserved_at         = Column(DateTime, nullable=False)
    status              = Column(Enum(ReservationStatus), default=ReservationStatus.confirmed)
    table_number        = Column(Integer, nullable=True)
    notes               = Column(Text, nullable=True)
    source              = Column(String(50), nullable=False, default="internal")
    external_booking_id = Column(String(200), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)


# ── 3. orders ──────────────────────────────────────────
#The ordered_at timestamp is what the Demand Forecast Agent uses to detect patterns like Friday spikes. Also links to Feedback so a complaint can be traced back to a specific order.
class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("external_order_id", name="uq_order_external_id"),
    )

    id                = Column(Integer, primary_key=True, autoincrement=True)
    menu_item_id      = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    quantity          = Column(Integer, nullable=False)
    total_price       = Column(Float, nullable=False)
    ordered_at        = Column(DateTime, default=datetime.utcnow)
    is_delivery       = Column(Boolean, default=False)
    source            = Column(String(50), nullable=False, default="internal")
    channel           = Column(String(50), nullable=False, default="dine_in")
    external_order_id = Column(String(200), nullable=True)

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

    id                          = Column(Integer, primary_key=True, autoincrement=True)
    order_id                    = Column(Integer, ForeignKey("orders.id"), nullable=True)
    raw_text                    = Column(Text, nullable=False)
    sentiment                   = Column(Enum(SentimentType), nullable=True)
    source                      = Column(Enum(FeedbackSource), default=FeedbackSource.in_person)
    delivery_time_actual_mins   = Column(Integer, nullable=True)
    delivery_time_promised_mins = Column(Integer, nullable=True)
    was_late                    = Column(Boolean, nullable=True)
    external_order_id           = Column(String(200), nullable=True)
    created_at                  = Column(DateTime, default=datetime.utcnow)

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


class PlanningRun(Base):
    __tablename__ = "planning_runs"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    org_id             = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    scenario           = Column(String(80), nullable=False)
    target_date        = Column(String(20), nullable=True)
    status             = Column(String(40), nullable=False)
    critic_verdict     = Column(String(40), nullable=True)
    critic_score       = Column(Float, nullable=True)
    decision_log_id    = Column(Integer, nullable=True)
    final_response     = Column(JSONB, nullable=False)
    recommendations    = Column(JSONB, nullable=True)
    rag_context        = Column(JSONB, nullable=True)
    critic             = Column(JSONB, nullable=True)
    metadata_          = Column("metadata", JSONB, nullable=True)
    generated_at       = Column(DateTime, default=datetime.utcnow)
    created_at         = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="planning_runs")


# ── 7. restaurant_profiles ─────────────────────────────

class RestaurantProfile(Base):
    __tablename__ = "restaurant_profiles"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    org_id     = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name       = Column(String(100), nullable=False)
    cuisine    = Column(String(100), nullable=False, default="pizza")
    capacity   = Column(Integer, nullable=False, default=70)
    peak_hours = Column(String(50), nullable=False, default="18:00-22:00")
    timezone   = Column(String(50), nullable=False, default="Asia/Kolkata")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="restaurant_profiles")


class Connector(Base):
    """Per-org external platform connector registry.

    Stores OAuth token (encrypted) and sync health per org per platform.
    SWIGGY_ACCESS_TOKEN in settings is dev-only — production uses this table.
    """
    __tablename__ = "connectors"
    __table_args__ = (
        UniqueConstraint("org_id", "connector_type", name="uq_connector_org_type"),
    )

    id                      = Column(Integer, primary_key=True, autoincrement=True)
    org_id                  = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    connector_type          = Column(String(50), nullable=False)
    access_token_encrypted  = Column(Text, nullable=True)
    token_expires_at        = Column(DateTime, nullable=True)
    last_sync_at            = Column(DateTime, nullable=True)
    sync_status             = Column(String(20), nullable=False, default="never_synced")
    error_count             = Column(Integer, nullable=False, default=0)
    last_error              = Column(Text, nullable=True)
    connector_metadata      = Column(JSONB, nullable=True)
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatSession(Base):
    """A single chat conversation thread.

    title is a cheap truncated preview of the first user message -- no extra
    LLM call needed just to label a thread in a history list.
    """
    __tablename__ = "chat_sessions"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    org_id     = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    title      = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship(
        "ChatMessage", back_populates="session",
        order_by="ChatMessage.created_at", cascade="all, delete-orphan",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role       = Column(String(20), nullable=False)  # "user" | "assistant"
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


"""
MenuItem  ──< Order >── Feedback

Reservation (standalone)
Inventory   (standalone)
DecisionLog (standalone)
Connector   (per org, per platform)
ChatSession ──< ChatMessage
"""
