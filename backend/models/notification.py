from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Kaynak
    source = Column(String(50), nullable=False)          # "banking_agent", "scanner", vb.
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)

    # İlgili hisse (opsiyonel)
    symbol = Column(String(20), nullable=True)
    action = Column(String(10), nullable=True)            # BUY / SELL / ALERT / INFO
    confidence = Column(Integer, nullable=True)

    # Ekstra veri
    meta = Column(JSON, nullable=True)                   # hedef fiyat, riskler vb.

    # Durum
    is_read = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<Notification {self.source}: {self.title[:40]}>"
