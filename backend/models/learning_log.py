from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base


class AILearningLog(Base):
    __tablename__ = "ai_learning_log"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    pattern_type = Column(String(50), nullable=False)        # "bullish_divergence", "volume_breakout" vb.
    pattern_description = Column(Text, nullable=False)
    success_rate = Column(Float, nullable=False)             # 0.0 - 1.0
    sample_size = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)               # 0.0 - 1.0
    applied_to_stocks = Column(JSON, nullable=True)          # ["AKBNK.IS", "GARAN.IS"]

    # Haftalık öz değerlendirmeden gelen veriler
    overall_accuracy = Column(Float, nullable=True)
    best_patterns = Column(JSON, nullable=True)
    worst_patterns = Column(JSON, nullable=True)
    learning_notes = Column(Text, nullable=True)
    adjusted_weights = Column(JSON, nullable=True)           # {"rsi_weight": 0.3, ...}
    market_regime = Column(String(20), nullable=True)        # trending_up/down, ranging, volatile

    def __repr__(self):
        return f"<AILearningLog type={self.pattern_type} success_rate={self.success_rate}>"
