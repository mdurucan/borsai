from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class ActionType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    WATCH = "WATCH"


class TimeHorizon(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class RecommendationStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    expired = "expired"
    simulated = "simulated"  # İlk 14 gün öğrenme modu


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    session = Column(String(10), nullable=False)  # morning / noon / close

    action = Column(Enum(ActionType), nullable=False)
    price_at_recommendation = Column(Float, nullable=False)
    target_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    confidence_score = Column(Integer, nullable=False)  # 0-100
    time_horizon = Column(Enum(TimeHorizon), nullable=False)

    reasoning = Column(Text, nullable=True)          # Gemini'nin Türkçe gerekçesi
    technical_signals = Column(JSON, nullable=True)  # {"rsi": 72, "macd": "bullish", ...}
    fundamental_signals = Column(JSON, nullable=True)
    sentiment_signals = Column(JSON, nullable=True)
    key_signals = Column(JSON, nullable=True)        # ["sinyal1", "sinyal2"]
    risks = Column(JSON, nullable=True)              # ["risk1", "risk2"]
    sector_outlook = Column(Text, nullable=True)
    bist30_relative = Column(Text, nullable=True)

    status = Column(Enum(RecommendationStatus), default=RecommendationStatus.active, nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    stock = relationship("Stock", back_populates="recommendations")
    performance = relationship(
        "RecommendationPerformance",
        back_populates="recommendation",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Recommendation stock_id={self.stock_id} action={self.action} confidence={self.confidence_score}>"
