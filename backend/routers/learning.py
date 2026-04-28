from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models.learning_log import AILearningLog

router = APIRouter(prefix="/api/learning", tags=["learning"])


@router.get("/logs")
def list_logs(limit: int = Query(20, le=100), db: Session = Depends(get_db)):
    logs = (
        db.query(AILearningLog)
        .order_by(desc(AILearningLog.created_at))
        .limit(limit)
        .all()
    )
    return [_log_to_dict(l) for l in logs]


@router.get("/patterns")
def list_patterns(db: Session = Depends(get_db)):
    """Başarı oranına göre sıralı pattern listesi."""
    logs = (
        db.query(AILearningLog)
        .filter(AILearningLog.pattern_type != "weekly_self_eval")
        .order_by(desc(AILearningLog.success_rate))
        .all()
    )
    return [_log_to_dict(l) for l in logs]


@router.get("/latest")
def latest_evaluation(db: Session = Depends(get_db)):
    """En son haftalık öz değerlendirme."""
    log = (
        db.query(AILearningLog)
        .filter(AILearningLog.pattern_type == "weekly_self_eval")
        .order_by(desc(AILearningLog.created_at))
        .first()
    )
    if not log:
        return {"message": "Henüz öz değerlendirme yapılmadı."}
    return _log_to_dict(log)


def _log_to_dict(log: AILearningLog) -> dict:
    return {
        "id": log.id,
        "created_at": log.created_at.isoformat(),
        "pattern_type": log.pattern_type,
        "pattern_description": log.pattern_description,
        "success_rate": log.success_rate,
        "sample_size": log.sample_size,
        "confidence": log.confidence,
        "overall_accuracy": log.overall_accuracy,
        "best_patterns": log.best_patterns,
        "worst_patterns": log.worst_patterns,
        "learning_notes": log.learning_notes,
        "adjusted_weights": log.adjusted_weights,
        "market_regime": log.market_regime,
        "applied_to_stocks": log.applied_to_stocks,
    }
