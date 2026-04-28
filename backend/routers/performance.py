from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional

from database import get_db
from models import Recommendation, Stock
from models.recommendation import RecommendationStatus, ActionType
from models.performance import RecommendationPerformance

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/summary")
def performance_summary(
    days: int = Query(30, description="Son N günün özeti"),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(RecommendationPerformance, Recommendation)
        .join(Recommendation, Recommendation.id == RecommendationPerformance.recommendation_id)
        .filter(Recommendation.status == RecommendationStatus.closed)
        .filter(Recommendation.created_at >= cutoff)
        .filter(RecommendationPerformance.is_successful.isnot(None))
        .all()
    )

    if not rows:
        return {"total": 0, "successful": 0, "accuracy": 0, "avg_return_pct": 0}

    total = len(rows)
    successful = sum(1 for p, _ in rows if p.is_successful)
    avg_return = sum((p.return_pct or 0) for p, _ in rows) / total

    return {
        "total": total,
        "successful": successful,
        "failed": total - successful,
        "accuracy": round(successful / total * 100, 1),
        "avg_return_pct": round(avg_return, 2),
        "period_days": days,
    }


@router.get("/by-stock")
def performance_by_stock(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Stock.symbol,
            Stock.name,
            func.count(RecommendationPerformance.id).label("total"),
            func.sum(case((RecommendationPerformance.is_successful == True, 1), else_=0)).label("successful"),
            func.avg(RecommendationPerformance.return_pct).label("avg_return"),
        )
        .join(Recommendation, Recommendation.stock_id == Stock.id)
        .join(RecommendationPerformance, RecommendationPerformance.recommendation_id == Recommendation.id)
        .filter(RecommendationPerformance.is_successful.isnot(None))
        .group_by(Stock.id)
        .order_by(func.count(RecommendationPerformance.id).desc())
        .all()
    )

    return [
        {
            "symbol": r.symbol,
            "name": r.name,
            "total": r.total,
            "successful": r.successful or 0,
            "accuracy": round((r.successful or 0) / r.total * 100, 1),
            "avg_return_pct": round(float(r.avg_return or 0), 2),
        }
        for r in rows
    ]


@router.get("/by-session")
def performance_by_session(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Recommendation.session,
            func.count(RecommendationPerformance.id).label("total"),
            func.sum(case((RecommendationPerformance.is_successful == True, 1), else_=0)).label("successful"),
            func.avg(RecommendationPerformance.return_pct).label("avg_return"),
        )
        .join(RecommendationPerformance, RecommendationPerformance.recommendation_id == Recommendation.id)
        .filter(RecommendationPerformance.is_successful.isnot(None))
        .group_by(Recommendation.session)
        .all()
    )

    return [
        {
            "session": r.session,
            "total": r.total,
            "successful": r.successful or 0,
            "accuracy": round((r.successful or 0) / r.total * 100, 1),
            "avg_return_pct": round(float(r.avg_return or 0), 2),
        }
        for r in rows
    ]


@router.get("/cumulative")
def cumulative_returns(db: Session = Depends(get_db)):
    """
    Tüm önerilere eşit sermaye konulsaydı kümülatif getiri simülasyonu.
    """
    rows = (
        db.query(Recommendation.created_at, RecommendationPerformance.return_pct)
        .join(RecommendationPerformance, RecommendationPerformance.recommendation_id == Recommendation.id)
        .filter(RecommendationPerformance.is_successful.isnot(None))
        .order_by(Recommendation.created_at)
        .all()
    )

    cumulative = 100.0
    points = []
    for created_at, ret in rows:
        cumulative *= (1 + (ret or 0) / 100)
        points.append({
            "date": created_at.isoformat(),
            "cumulative_value": round(cumulative, 2),
        })
    return points


@router.get("/top")
def top_recommendations(
    limit: int = Query(10, le=50),
    worst: bool = False,
    db: Session = Depends(get_db),
):
    q = (
        db.query(RecommendationPerformance, Recommendation, Stock)
        .join(Recommendation, Recommendation.id == RecommendationPerformance.recommendation_id)
        .join(Stock, Stock.id == Recommendation.stock_id)
        .filter(RecommendationPerformance.is_successful.isnot(None))
    )

    if worst:
        q = q.order_by(RecommendationPerformance.return_pct.asc())
    else:
        q = q.order_by(RecommendationPerformance.return_pct.desc())

    rows = q.limit(limit).all()
    return [
        {
            "symbol": stock.symbol,
            "action": rec.action,
            "created_at": rec.created_at.isoformat(),
            "price": rec.price_at_recommendation,
            "return_pct": perf.return_pct,
            "is_successful": perf.is_successful,
            "days_held": perf.days_held,
        }
        for perf, rec, stock in rows
    ]
