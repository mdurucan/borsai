from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class RecommendationPerformance(Base):
    __tablename__ = "recommendation_performance"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=False, index=True)
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now())

    price_at_evaluation = Column(Float, nullable=False)
    return_pct = Column(Float, nullable=True)          # Öneri fiyatından % getiri
    is_successful = Column(Boolean, nullable=True)     # None = henüz değerlendirilmedi
    days_held = Column(Integer, nullable=True)
    max_gain_pct = Column(Float, nullable=True)        # Tutulduğu süredeki maks kazanç
    max_loss_pct = Column(Float, nullable=True)        # Tutulduğu süredeki maks kayıp
    target_hit = Column(Boolean, nullable=True)        # Hedef fiyata ulaşıldı mı
    stop_loss_hit = Column(Boolean, nullable=True)     # Stop-loss tetiklendi mi

    gemini_retrospective = Column(Text, nullable=True) # AI'ın öz değerlendirmesi

    recommendation = relationship("Recommendation", back_populates="performance")

    def __repr__(self):
        return f"<Performance rec_id={self.recommendation_id} return={self.return_pct}% success={self.is_successful}>"
