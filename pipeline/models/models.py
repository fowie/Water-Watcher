"""SQLAlchemy models matching the Prisma schema.

These models mirror the Prisma schema so the Python pipeline can read/write
to the same PostgreSQL database that Next.js uses.
"""

from datetime import datetime, timezone


def _utc_now():
    return datetime.now(timezone.utc)
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    DateTime,
    Integer,
    Text,
    JSON,
    ForeignKey,
    Index,
    ARRAY,
)
from sqlalchemy.orm import relationship
from models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True)
    name = Column(String)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    tracked_rivers = relationship("UserRiver", back_populates="user")
    deal_filters = relationship("DealFilter", back_populates="user")
    push_subscriptions = relationship("PushSubscription", back_populates="user")
    notification_preferences = relationship("NotificationPreference", back_populates="user", uselist=False)
    alert_logs = relationship("AlertLog", back_populates="user")
    trips = relationship("Trip", back_populates="user")
    reviews = relationship("RiverReview", back_populates="user")
    photos = relationship("RiverPhoto", back_populates="user")


class River(Base):
    __tablename__ = "rivers"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    state = Column(String, nullable=False)
    region = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    difficulty = Column(String)
    description = Column(Text)
    aw_id = Column(String, unique=True)
    usgs_gauge_id = Column(String)
    image_url = Column(String)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    conditions = relationship("RiverCondition", back_populates="river")
    hazards = relationship("Hazard", back_populates="river")
    tracked_by = relationship("UserRiver", back_populates="river")
    trip_stops = relationship("TripStop", back_populates="river")
    reviews = relationship("RiverReview", back_populates="river")
    photos = relationship("RiverPhoto", back_populates="river")


class RiverCondition(Base):
    __tablename__ = "river_conditions"

    id = Column(String, primary_key=True)
    river_id = Column(String, ForeignKey("rivers.id", ondelete="CASCADE"), nullable=False)
    flow_rate = Column(Float)
    gauge_height = Column(Float)
    water_temp = Column(Float)
    quality = Column(String)
    runnability = Column(String)
    source = Column(String, nullable=False)
    source_url = Column(String)
    raw_data = Column(JSON)
    scraped_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utc_now)

    river = relationship("River", back_populates="conditions")

    __table_args__ = (
        Index("ix_river_conditions_river_scraped", "river_id", "scraped_at"),
    )


class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(String, primary_key=True)
    river_id = Column(String, ForeignKey("rivers.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    source = Column(String, nullable=False)
    source_url = Column(String)
    reported_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)

    river = relationship("River", back_populates="hazards")

    __table_args__ = (
        Index("ix_hazards_river_active", "river_id", "is_active"),
    )


class GearDeal(Base):
    __tablename__ = "gear_deals"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    price = Column(Float)
    url = Column(String, unique=True, nullable=False)
    image_url = Column(String)
    description = Column(Text)
    category = Column(String)
    region = Column(String)
    posted_at = Column(DateTime)
    scraped_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)

    matched_filters = relationship("DealFilterMatch", back_populates="deal")

    __table_args__ = (
        Index("ix_gear_deals_category_active", "category", "is_active"),
        Index("ix_gear_deals_scraped", "scraped_at"),
    )


class DealFilter(Base):
    __tablename__ = "deal_filters"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    keywords = Column(ARRAY(String))
    categories = Column(ARRAY(String))
    max_price = Column(Float)
    regions = Column(ARRAY(String))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    user = relationship("User", back_populates="deal_filters")
    matches = relationship("DealFilterMatch", back_populates="filter")


class DealFilterMatch(Base):
    __tablename__ = "deal_filter_matches"

    id = Column(String, primary_key=True)
    filter_id = Column(String, ForeignKey("deal_filters.id", ondelete="CASCADE"), nullable=False)
    deal_id = Column(String, ForeignKey("gear_deals.id", ondelete="CASCADE"), nullable=False)
    notified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utc_now)

    filter = relationship("DealFilter", back_populates="matches")
    deal = relationship("GearDeal", back_populates="matched_filters")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(String, unique=True, nullable=False)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utc_now)

    user = relationship("User", back_populates="push_subscriptions")


class UserRiver(Base):
    __tablename__ = "user_rivers"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    river_id = Column(String, ForeignKey("rivers.id", ondelete="CASCADE"), nullable=False)
    notify = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)

    user = relationship("User", back_populates="tracked_rivers")
    river = relationship("River", back_populates="tracked_by")


class ScrapeLog(Base):
    __tablename__ = "scrape_logs"

    id = Column(String, primary_key=True)
    source = Column(String, nullable=False)
    status = Column(String, nullable=False)
    item_count = Column(Integer, default=0)
    error = Column(Text)
    duration = Column(Integer)
    started_at = Column(DateTime, nullable=False)
    finished_at = Column(DateTime)
    created_at = Column(DateTime, default=_utc_now)

    __table_args__ = (
        Index("ix_scrape_logs_source_started", "source", "started_at"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    channel = Column(String, nullable=False, default="push")  # "push", "email", "both"
    deal_alerts = Column(Boolean, default=True)
    condition_alerts = Column(Boolean, default=True)
    hazard_alerts = Column(Boolean, default=True)
    weekly_digest = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    user = relationship("User", back_populates="notification_preferences")


class AlertLog(Base):
    __tablename__ = "alert_logs"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)  # "deal", "condition", "hazard", "digest"
    channel = Column(String, nullable=False)  # "push", "email"
    title = Column(String, nullable=False)
    body = Column(Text)
    extra_data = Column("metadata", JSON)  # extra context (river_id, deal_ids, etc.)
    sent_at = Column(DateTime, nullable=False, default=_utc_now)
    created_at = Column(DateTime, default=_utc_now)

    user = relationship("User", back_populates="alert_logs")

    __table_args__ = (
        Index("ix_alert_logs_user_sent", "user_id", "sent_at"),
    )


class Trip(Base):
    __tablename__ = "trips"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default="planning")
    notes = Column(Text)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    user = relationship("User", back_populates="trips")
    stops = relationship("TripStop", back_populates="trip")

    __table_args__ = (
        Index("ix_trips_user_start", "user_id", "start_date"),
    )


class TripStop(Base):
    __tablename__ = "trip_stops"

    id = Column(String, primary_key=True)
    trip_id = Column(String, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    river_id = Column(String, ForeignKey("rivers.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)
    notes = Column(Text)
    put_in_time = Column(String)
    take_out_time = Column(String)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utc_now)

    trip = relationship("Trip", back_populates="stops")
    river = relationship("River", back_populates="trip_stops")

    __table_args__ = (
        Index("ix_trip_stops_trip_day", "trip_id", "day_number"),
    )


class RiverPhoto(Base):
    __tablename__ = "river_photos"

    id = Column(String, primary_key=True)
    river_id = Column(String, ForeignKey("rivers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    caption = Column(String)
    taken_at = Column(DateTime)
    created_at = Column(DateTime, default=_utc_now)

    river = relationship("River", back_populates="photos")
    user = relationship("User", back_populates="photos")

    __table_args__ = (
        Index("ix_river_photos_river_created", "river_id", "created_at"),
    )


class RiverReview(Base):
    __tablename__ = "river_reviews"

    id = Column(String, primary_key=True)
    river_id = Column(String, ForeignKey("rivers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    title = Column(String)
    body = Column(Text, nullable=False)
    visit_date = Column(DateTime)
    difficulty = Column(String)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    river = relationship("River", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

    __table_args__ = (
        Index("ix_river_reviews_river_created", "river_id", "created_at"),
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utc_now)
