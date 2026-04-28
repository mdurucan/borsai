from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime, timezone
from database import Base


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id           = Column(Integer, primary_key=True, index=True)
    started_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at  = Column(DateTime, nullable=True)
    session      = Column(String, nullable=False)   # morning / noon / close / manual / banking_agent
    scanned      = Column(Integer, default=0)
    recommendations = Column(Integer, default=0)
    errors       = Column(Integer, default=0)
    success      = Column(Boolean, default=True)
    note         = Column(String, nullable=True)    # hata mesajı veya kısa not
