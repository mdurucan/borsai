from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime

from database import get_db
from models import Recommendation, Stock
from models.recommendation import RecommendationStatus

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("")
def list_recommendations(
    symbol: Optional[str] = None,
    action: Optional[str] = None,
    status: Optional[str] = None,
    session: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Recommendation, Stock).join(Stock, Stock.id == Recommendation.stock_id)

    if symbol:
        q = q.filter(Stock.symbol == symbol.upper())
    if action:
        q = q.filter(Recommendation.action == action.upper())
    if status:
        q = q.filter(Recommendation.status == status)
    if session:
        q = q.filter(Recommendation.session == session)
    if date_from:
        q = q.filter(Recommendation.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Recommendation.created_at <= datetime.fromisoformat(date_to))

    rows = q.order_by(desc(Recommendation.created_at)).limit(limit).all()
    return [_enrich(rec, stock) for rec, stock in rows]


@router.get("/active")
def list_active(db: Session = Depends(get_db)):
    rows = (
        db.query(Recommendation, Stock)
        .join(Stock, Stock.id == Recommendation.stock_id)
        .filter(Recommendation.status.in_([
            RecommendationStatus.active,
            RecommendationStatus.simulated,
        ]))
        .order_by(desc(Recommendation.confidence_score))
        .all()
    )
    return [_enrich(rec, stock, include_performance=True, db=db) for rec, stock in rows]


@router.get("/{rec_id}")
def get_recommendation(rec_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(Recommendation, Stock)
        .join(Stock, Stock.id == Recommendation.stock_id)
        .filter(Recommendation.id == rec_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Öneri bulunamadı.")
    rec, stock = row
    return _enrich(rec, stock, include_performance=True, db=db)


@router.post("/{rec_id}/close")
def close_recommendation(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Öneri bulunamadı.")
    if rec.status == RecommendationStatus.closed:
        raise HTTPException(status_code=400, detail="Öneri zaten kapalı.")

    rec.status = RecommendationStatus.closed
    rec.closed_at = datetime.utcnow()
    db.commit()
    return {"message": f"Öneri #{rec_id} kapatıldı."}


# ── Yardımcı ──────────────────────────────────────────────────────────────────

def _enrich(rec: Recommendation, stock: Stock, include_performance: bool = False, db: Session = None) -> dict:
    data = {
        "id": rec.id,
        "symbol": stock.symbol,
        "name": stock.name,
        "sector": stock.sector,
        "created_at": rec.created_at.isoformat(),
        "session": rec.session,
        "action": rec.action,
        "price_at_recommendation": rec.price_at_recommendation,
        "target_price": rec.target_price,
        "stop_loss": rec.stop_loss,
        "confidence_score": rec.confidence_score,
        "time_horizon": rec.time_horizon,
        "reasoning": rec.reasoning,
        "key_signals": rec.key_signals,
        "risks": rec.risks,
        "sector_outlook": rec.sector_outlook,
        "bist30_relative": rec.bist30_relative,
        "technical_signals": rec.technical_signals,
        "status": rec.status,
        "closed_at": rec.closed_at.isoformat() if rec.closed_at else None,
    }

    if include_performance and db:
        from models.performance import RecommendationPerformance
        perf = (
            db.query(RecommendationPerformance)
            .filter(RecommendationPerformance.recommendation_id == rec.id)
            .order_by(desc(RecommendationPerformance.evaluated_at))
            .first()
        )
        if perf:
            data["performance"] = {
                "return_pct": perf.return_pct,
                "is_successful": perf.is_successful,
                "days_held": perf.days_held,
                "max_gain_pct": perf.max_gain_pct,
                "max_loss_pct": perf.max_loss_pct,
                "target_hit": perf.target_hit,
                "stop_loss_hit": perf.stop_loss_hit,
                "evaluated_at": perf.evaluated_at.isoformat(),
            }
    return data
