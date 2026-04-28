from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from database import get_db
from models.scan_log import ScanLog

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.post("/run")
def run_scan(session: Optional[str] = Query("manual")):
    """Manuel tarama tetikler."""
    from scheduler import trigger_manual_scan
    import threading

    allowed = {"morning", "noon", "close", "manual"}
    if session not in allowed:
        raise HTTPException(status_code=400, detail=f"Geçersiz session. Geçerli: {allowed}")

    def _run():
        from database import SessionLocal
        db = SessionLocal()
        log = ScanLog(session=session, started_at=datetime.now(timezone.utc))
        db.add(log)
        db.commit()
        db.refresh(log)
        try:
            result = trigger_manual_scan(session)
            log.finished_at = datetime.now(timezone.utc)
            log.success = True
            if isinstance(result, dict):
                log.scanned = result.get("scanned", 0)
                log.recommendations = result.get("recommendations", 0)
                log.errors = result.get("errors", 0)
        except Exception as e:
            log.finished_at = datetime.now(timezone.utc)
            log.success = False
            log.note = str(e)[:300]
        finally:
            db.add(log)
            db.commit()
            db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"message": f"'{session}' taraması arka planda başlatıldı."}


@router.get("/status")
def scanner_status():
    from scheduler import get_scheduler_status
    return get_scheduler_status()


@router.get("/history")
def scan_history(limit: int = Query(20, le=100), db: Session = Depends(get_db)):
    logs = (
        db.query(ScanLog)
        .order_by(ScanLog.started_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "session": l.session,
            "started_at": (l.started_at.replace(tzinfo=timezone.utc).isoformat() if l.started_at and l.started_at.tzinfo is None else l.started_at.isoformat()) if l.started_at else None,
            "finished_at": (l.finished_at.replace(tzinfo=timezone.utc).isoformat() if l.finished_at and l.finished_at.tzinfo is None else l.finished_at.isoformat()) if l.finished_at else None,
            "scanned": l.scanned,
            "recommendations": l.recommendations,
            "errors": l.errors,
            "success": l.success,
            "note": l.note,
            "duration_sec": (
                round((l.finished_at - l.started_at).total_seconds())
                if l.finished_at and l.started_at else None
            ),
        }
        for l in logs
    ]
