"""
Self-learning motoru:
- Her kapanışta aktif önerilerin performansını günceller.
- Haftada bir Gemini'ye öz değerlendirme yaptırır.
- Başarılı/başarısız pattern'leri ai_learning_log'a kaydeder.
"""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Recommendation, Stock
from models.recommendation import RecommendationStatus, ActionType
from models.performance import RecommendationPerformance
from models.learning_log import AILearningLog
from services.gemini_service import self_evaluate
from utils.constants import SUCCESS_THRESHOLD_PCT, EVALUATION_DAYS, MIN_CONFIDENCE

logger = logging.getLogger(__name__)


def _get_dynamic_eval_days(db: Session) -> int:
    """
    Son öz değerlendirmeden piyasa rejimine göre değerlendirme penceresi döndürür.
    trending_up/down → 3 gün, volatile → 3 gün, ranging → 7 gün, default → EVALUATION_DAYS
    """
    try:
        log = (
            db.query(AILearningLog)
            .filter(AILearningLog.market_regime.isnot(None))
            .order_by(AILearningLog.created_at.desc())
            .first()
        )
        if log and log.market_regime:
            regime = log.market_regime
            if regime in ("trending_up", "trending_down", "volatile"):
                return 3
            elif regime == "ranging":
                return 7
    except Exception:
        pass
    return EVALUATION_DAYS


def _get_confidence_calibration(db: Session) -> float:
    """
    Son 20 kapalı önerinin gerçek başarı oranına göre güven kalibrasyonu.
    Ortalama güven > gerçek başarı oranı ise negatif, aksi pozitif düzeltme faktörü döner.
    """
    try:
        recent = (
            db.query(RecommendationPerformance)
            .join(Recommendation, Recommendation.id == RecommendationPerformance.recommendation_id)
            .filter(RecommendationPerformance.is_successful.isnot(None))
            .order_by(RecommendationPerformance.evaluated_at.desc())
            .limit(20)
            .all()
        )
        if len(recent) < 5:
            return 0.0
        # Placeholder: confidence calibration info stored in AILearningLog
        # Return 0 as no adjustment needed unless enough data
        actual_rate = sum(1 for p in recent if p.is_successful) / len(recent) * 100
        avg_confidence = sum(
            db.query(Recommendation).filter(Recommendation.id == p.recommendation_id).first().confidence_score
            for p in recent
            if db.query(Recommendation).filter(Recommendation.id == p.recommendation_id).first()
        ) / len(recent)
        return round(actual_rate - avg_confidence, 1)
    except Exception:
        return 0.0


def _get_current_price(symbol: str) -> float | None:
    """Anlık fiyatı yfinance'tan çeker."""
    try:
        from services.data_fetcher import fetch_stock_info
        info = fetch_stock_info(symbol)
        return info["close"] if info else None
    except Exception as e:
        logger.error(f"{symbol}: fiyat çekme hatası — {e}")
        return None


def update_active_performances():
    """
    Aktif tüm önerilerin anlık performansını günceller.
    5 iş günü dolan öneriler değerlendirilip kapatılır.
    """
    db = SessionLocal()
    updated = 0
    closed = 0

    try:
        active_recs = (
            db.query(Recommendation)
            .filter(Recommendation.status.in_([
                RecommendationStatus.active,
                RecommendationStatus.simulated,
            ]))
            .all()
        )

        now = datetime.now(timezone.utc)

        for rec in active_recs:
            stock = db.query(Stock).filter(Stock.id == rec.stock_id).first()
            if not stock:
                continue

            current_price = _get_current_price(stock.symbol)
            if current_price is None:
                continue

            # Öneri fiyatından getiri
            return_pct = (current_price - rec.price_at_recommendation) / rec.price_at_recommendation * 100

            # Başarı kriteri
            is_successful = None
            if rec.action == ActionType.BUY:
                is_successful = return_pct >= SUCCESS_THRESHOLD_PCT
            elif rec.action == ActionType.SELL:
                is_successful = return_pct <= -SUCCESS_THRESHOLD_PCT
            elif rec.action in (ActionType.HOLD, ActionType.WATCH):
                # Yön doğru mu?
                is_successful = return_pct > 0

            # Stop-loss / hedef kontrolü
            target_hit = (
                rec.target_price is not None and
                current_price >= rec.target_price and
                rec.action == ActionType.BUY
            )
            stop_hit = (
                rec.stop_loss is not None and
                current_price <= rec.stop_loss and
                rec.action == ActionType.BUY
            )

            # Mevcut performans kaydını güncelle ya da yeni oluştur
            perf = (
                db.query(RecommendationPerformance)
                .filter(RecommendationPerformance.recommendation_id == rec.id)
                .order_by(RecommendationPerformance.evaluated_at.desc())
                .first()
            )

            created = rec.created_at if rec.created_at.tzinfo else rec.created_at.replace(tzinfo=timezone.utc)
            days_held = (now - created).days

            if perf is None:
                perf = RecommendationPerformance(recommendation_id=rec.id)
                db.add(perf)

            perf.evaluated_at = now
            perf.price_at_evaluation = current_price
            perf.return_pct = round(return_pct, 4)
            perf.days_held = days_held
            perf.target_hit = target_hit
            perf.stop_loss_hit = stop_hit

            # Maks kazanç/kayıp güncelle
            if perf.max_gain_pct is None or return_pct > perf.max_gain_pct:
                perf.max_gain_pct = round(return_pct, 4)
            if perf.max_loss_pct is None or return_pct < perf.max_loss_pct:
                perf.max_loss_pct = round(return_pct, 4)

            updated += 1

            # Dinamik değerlendirme penceresi: volatil piyasada 3 gün, sakin piyasada 7 gün
            dynamic_eval_days = _get_dynamic_eval_days(db)

            # Değerlendirme penceresi doldu veya stop/hedef tetiklendi → kapat
            if days_held >= dynamic_eval_days or target_hit or stop_hit:
                perf.is_successful = is_successful
                rec.status = RecommendationStatus.closed
                rec.closed_at = now
                closed += 1
                logger.info(
                    f"{stock.symbol} öneri kapandı: {rec.action} | "
                    f"getiri={return_pct:.2f}% | başarılı={is_successful}"
                )

        db.commit()
        logger.info(f"Performans güncelleme: {updated} aktif, {closed} kapatıldı.")

    except Exception as e:
        logger.error(f"update_active_performances hatası: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

    return {"updated": updated, "closed": closed}


def run_self_evaluation():
    """
    Haftalık öz değerlendirme:
    1. Son 30 günün kapalı önerilerini toplar.
    2. Gemini'ye gönderir.
    3. Sonucu ai_learning_log'a kaydeder.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        closed_recs = (
            db.query(Recommendation, Stock, RecommendationPerformance)
            .join(Stock, Stock.id == Recommendation.stock_id)
            .join(RecommendationPerformance,
                  RecommendationPerformance.recommendation_id == Recommendation.id)
            .filter(Recommendation.status == RecommendationStatus.closed)
            .filter(Recommendation.created_at >= cutoff)
            .filter(RecommendationPerformance.is_successful.isnot(None))
            .all()
        )

        if not closed_recs:
            logger.warning("Öz değerlendirme için yeterli kapalı öneri yok.")
            return None

        performance_data = [
            {
                "symbol": stock.symbol,
                "action": rec.action.value,
                "price": rec.price_at_recommendation,
                "return_pct": perf.return_pct or 0,
                "is_successful": perf.is_successful,
                "reasoning": rec.reasoning or "",
            }
            for rec, stock, perf in closed_recs
        ]

        result = self_evaluate(performance_data)
        if not result:
            return None

        log = AILearningLog(
            pattern_type="weekly_self_eval",
            pattern_description=f"{len(performance_data)} öneri değerlendirildi.",
            success_rate=result.get("overall_accuracy", 0),
            sample_size=len(performance_data),
            confidence=result.get("overall_accuracy", 0),
            overall_accuracy=result.get("overall_accuracy"),
            best_patterns=result.get("best_patterns"),
            worst_patterns=result.get("worst_patterns"),
            learning_notes=result.get("learning_notes"),
            adjusted_weights=result.get("adjusted_weights"),
            market_regime=result.get("market_regime"),
        )
        db.add(log)
        db.commit()

        logger.info(
            f"Öz değerlendirme kaydedildi. "
            f"Doğruluk: {result.get('overall_accuracy'):.1%} | "
            f"Rejim: {result.get('market_regime')}"
        )
        return result

    except Exception as e:
        logger.error(f"run_self_evaluation hatası: {e}", exc_info=True)
        db.rollback()
        return None
    finally:
        db.close()
