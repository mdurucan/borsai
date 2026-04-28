from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class SessionType(str, enum.Enum):
    morning = "morning"
    noon = "noon"
    close = "close"
    manual = "manual"


class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    session = Column(Enum(SessionType), nullable=False)

    # Fiyat verileri
    open = Column(Float, nullable=True)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)
    change_pct = Column(Float, nullable=True)   # Günlük % değişim

    # Teknik göstergeler — Momentum
    rsi_14 = Column(Float, nullable=True)
    macd = Column(Float, nullable=True)
    macd_signal = Column(Float, nullable=True)
    macd_histogram = Column(Float, nullable=True)
    stoch_k = Column(Float, nullable=True)
    stoch_d = Column(Float, nullable=True)

    # Teknik göstergeler — Trend
    ema_20 = Column(Float, nullable=True)
    ema_50 = Column(Float, nullable=True)
    sma_200 = Column(Float, nullable=True)
    adx = Column(Float, nullable=True)

    # Teknik göstergeler — Volatilite
    bb_upper = Column(Float, nullable=True)
    bb_middle = Column(Float, nullable=True)
    bb_lower = Column(Float, nullable=True)
    atr = Column(Float, nullable=True)

    # Teknik göstergeler — Hacim
    obv = Column(Float, nullable=True)
    vwap = Column(Float, nullable=True)
    volume_ratio_20d = Column(Float, nullable=True)  # Günlük hacim / 20 günlük ort

    # Destek / Direnç
    high_52w = Column(Float, nullable=True)
    low_52w = Column(Float, nullable=True)
    fib_382 = Column(Float, nullable=True)
    fib_500 = Column(Float, nullable=True)
    fib_618 = Column(Float, nullable=True)

    # Performans getirileri
    performance_1d = Column(Float, nullable=True)
    performance_1w = Column(Float, nullable=True)
    performance_1m = Column(Float, nullable=True)
    performance_3m = Column(Float, nullable=True)
    performance_1y = Column(Float, nullable=True)

    # Kurumsal akış (varsa)
    foreign_net_flow = Column(Float, nullable=True)
    institutional_net_flow = Column(Float, nullable=True)

    # Meta
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    data_delay_seconds = Column(Integer, nullable=True)

    stock = relationship("Stock", back_populates="snapshots")

    def __repr__(self):
        return f"<Snapshot stock_id={self.stock_id} session={self.session} ts={self.timestamp}>"
