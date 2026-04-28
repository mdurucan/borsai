from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models.notification import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    unread_only: bool = False,
    source: str | None = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    if source:
        q = q.filter(Notification.source == source)
    notes = q.order_by(desc(Notification.created_at)).limit(limit).all()
    return [_to_dict(n) for n in notes]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)):
    count = db.query(Notification).filter(Notification.is_read == False).count()
    return {"count": count}


@router.post("/{note_id}/read")
def mark_read(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Notification).filter(Notification.id == note_id).first()
    if not note:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")
    note.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"ok": True}


def _to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "created_at": n.created_at.isoformat(),
        "source": n.source,
        "title": n.title,
        "body": n.body,
        "symbol": n.symbol,
        "action": n.action,
        "confidence": n.confidence,
        "meta": n.meta,
        "is_read": n.is_read,
    }
