"""
Tarama motoru: veri çekme + teknik analiz + snapshot kaydetme + Gemini analizi.
scheduler.py tarafından çağrılır.
"""
import logging
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Stock, Snapshot, Recommendation
from models.recommendation import RecommendationStatus
from services.data_fetcher import fetch_stock_info, fetch_history, fetch_performance_returns, fetch_52w_high_low
from services.gemini_service import analyze_stock, MAX_PER_SCAN
from utils.technical import compute_all_indicators
from utils.constants import BIST30_SYMBOLS, STOCK_META, MIN_CONFIDENCE, SIMULATION_DAYS, DEFAULT_WEIGHTS

logger = logging.getLogger(__name__)


def _get_or_create_stock(db: Session, symbol: str) -> Stock:
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        meta = STOCK_META.get(symbol, {})
        stock = Stock(
            symbol=symbol,
            name=meta.get("name", symbol),
            sector=meta.get("sector"),
            is_active=True,
        )
        db.add(stock)
        db.flush()
    return stock


def _update_stock_fundamentals(db: Session, stock: Stock, info: dict):
    stock.market_cap = info.get("market_cap")
    stock.pe_ratio = info.get("pe_ratio")
    stock.pb_ratio = info.get("pb_ratio")


def _get_learned_weights(db: Session) -> dict:
    """Son öz değerlendirmeden öğrenilmiş ağırlıkları getirir."""
    from models.learning_log import AILearningLog
    log = (
        db.query(AILearningLog)
        .filter(AILearningLog.adjusted_weights.isnot(None))
        .order_by(AILearningLog.created_at.desc())
        .first()
    )
    if log and log.adjusted_weights:
        w = log.adjusted_weights
        return {
            "rsi_weight":    float(w.get("rsi_weight",    DEFAULT_WEIGHTS["rsi_weight"])),
            "macd_weight":   float(w.get("macd_weight",   DEFAULT_WEIGHTS["macd_weight"])),
            "volume_weight": float(w.get("volume_weight", DEFAULT_WEIGHTS["volume_weight"])),
            "trend_weight":  float(w.get("trend_weight",  DEFAULT_WEIGHTS["trend_weight"])),
        }
    return DEFAULT_WEIGHTS.copy()


def _get_learning_context(db: Session, stock_id: int) -> tuple[str, float, str]:
    """Self-learner'dan öğrenme notlarını, doğruluk oranını ve streak bilgisini getirir."""
    from models.performance import RecommendationPerformance
    from models.learning_log import AILearningLog

    # Son öğrenme notu
    log = (
        db.query(AILearningLog)
        .order_by(AILearningLog.created_at.desc())
        .first()
    )
    learning_notes = log.learning_notes if log and log.learning_notes else "Henüz öğrenme notu yok."

    # Hisse bazında doğruluk oranı
    recs = (
        db.query(Recommendation)
        .filter(Recommendation.stock_id == stock_id)
        .order_by(Recommendation.created_at.desc())
        .all()
    )
    if not recs:
        return learning_notes, 0.0, "Henüz öneri yok."

    rec_ids = [r.id for r in recs]
    performances = (
        db.query(RecommendationPerformance)
        .filter(RecommendationPerformance.recommendation_id.in_(rec_ids))
        .filter(RecommendationPerformance.is_successful.isnot(None))
        .all()
    )
    if not performances:
        return learning_notes, 0.0, "Henüz değerlendirme yok."

    success_count = sum(1 for p in performances if p.is_successful)
    accuracy = round(success_count / len(performances) * 100, 1)

    # Son 5 önerinin streak bilgisi
    perf_by_rec = {p.recommendation_id: p for p in performances}
    last_5_results = []
    for r in recs[:5]:
        p = perf_by_rec.get(r.id)
        if p is not None:
            last_5_results.append("✓" if p.is_successful else "✗")

    if last_5_results:
        streak_info = f"Son {len(last_5_results)} değerlendirme: {' '.join(last_5_results)} ({sum(1 for x in last_5_results if x == '✓')}/{len(last_5_results)} başarı)"
    else:
        streak_info = "Henüz değerlendirme yok."

    return learning_notes, accuracy, streak_info


def _is_simulation_period(db: Session) -> bool:
    """İlk SIMULATION_DAYS gün simülasyon modu aktif mi?"""
    first_snap = db.query(Snapshot).order_by(Snapshot.fetched_at.asc()).first()
    if not first_snap:
        return True
    fetched = first_snap.fetched_at
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    delta = (datetime.now(timezone.utc) - fetched).days
    return delta < SIMULATION_DAYS


def _create_scan_notification(db: Session, session_name: str, scanned: int, errors: int, recs: list[dict], is_sim: bool):
    """Tarama tamamlandığında özet bildirim oluşturur."""
    from models.notification import Notification

    session_labels = {"morning": "Sabah", "noon": "Öğlen", "close": "Kapanış", "manual": "Manuel"}
    session_label = session_labels.get(session_name, session_name.capitalize())

    buy_recs  = [r for r in recs if r["action"] == "BUY"]
    sell_recs = [r for r in recs if r["action"] == "SELL"]
    watch_recs = [r for r in recs if r["action"] == "WATCH"]
    hold_recs  = [r for r in recs if r["action"] == "HOLD"]

    # Başlık
    if buy_recs or sell_recs:
        strong = buy_recs + sell_recs
        strong.sort(key=lambda x: x["confidence"], reverse=True)
        top = strong[0]
        action_emoji = "📈" if top["action"] == "BUY" else "📉"
        title = f"{session_label} Taraması — {top['symbol'].replace('.IS','')} {action_emoji} ve {len(recs)-1} öneri daha"
    elif watch_recs:
        title = f"{session_label} Taraması — {len(watch_recs)} WATCH, güçlü sinyal yok"
    else:
        title = f"{session_label} Taraması Tamamlandı — {scanned} hisse tarandı"

    # Gövde — her öneri için satır
    lines = []
    for r in sorted(recs, key=lambda x: ({"BUY": 0, "SELL": 1, "WATCH": 2, "HOLD": 3}.get(x["action"], 4), -x["confidence"])):
        sym = r["symbol"].replace(".IS", "")
        emoji = {"BUY": "📈", "SELL": "📉", "WATCH": "👁", "HOLD": "⏸"}.get(r["action"], "•")
        target_str = f" → Hedef: {r['target']:.2f} ₺" if r.get("target") else ""
        stop_str   = f" | Stop: {r['stop']:.2f} ₺"   if r.get("stop")   else ""
        lines.append(f"{emoji} {sym} — {r['action']} (Güven: {r['confidence']}%){target_str}{stop_str}")
        if r.get("key_signals"):
            lines.append(f"   Sinyaller: {', '.join(r['key_signals'][:3])}")
        if r.get("reasoning"):
            lines.append(f"   {r['reasoning'][:120]}...")
        lines.append("")

    if not lines:
        lines = ["Bu taramada öneri üretilmedi."]

    sim_note = "\n⚠️ Simülasyon modu — öneri gerçek değil." if is_sim else ""
    body = "\n".join(lines) + f"\n\nTaranan: {scanned} hisse | Hata: {errors}{sim_note}"

    # En yüksek güvenli BUY/SELL öneriyi ana bildirim olarak kaydet
    top_rec = (buy_recs + sell_recs + watch_recs + hold_recs)
    top_rec.sort(key=lambda x: x["confidence"], reverse=True)
    top = top_rec[0] if top_rec else None

    note = Notification(
        source="scanner",
        title=title,
        body=body,
        symbol=top["symbol"] if top else None,
        action=top["action"] if top else "INFO",
        confidence=top["confidence"] if top else None,
        meta={
            "session": session_name,
            "scanned": scanned,
            "errors": errors,
            "recommendations": len(recs),
            "buy_count": len(buy_recs),
            "sell_count": len(sell_recs),
            "watch_count": len(watch_recs),
            "all_recs": [
                {"symbol": r["symbol"], "action": r["action"], "confidence": r["confidence"],
                 "price": r["price"], "target": r["target"], "stop": r["stop"]}
                for r in recs
            ],
        },
    )
    db.add(note)
    logger.info(f"Tarama bildirimi oluşturuldu: {title}")


def run_scan(session_name: str):
    """
    Tek bir tarama seansını çalıştırır (morning / noon / close).
    1. Tüm BIST30 hisselerinin verisi çekilir.
    2. Teknik göstergeler hesaplanır.
    3. Snapshot DB'ye kaydedilir.
    4. Güven skoru yeterli hisseler için Gemini analizi yapılır.
    5. Öneri DB'ye kaydedilir.
    """
    logger.info(f"=== Tarama başladı: {session_name} | {datetime.now(timezone.utc).isoformat()} ===")
    db = SessionLocal()
    scanned = 0
    recommendations_created = 0
    errors = 0
    gemini_calls_this_scan = 0
    is_sim = _is_simulation_period(db)
    scan_recs: list[dict] = []  # Bildirim için toplanan öneriler

    # Tarama başı: önce tüm hisselerin teknik skorlarını hesapla,
    # en yüksek sinyalli MAX_PER_SCAN hisseyi Gemini'ye gönder.
    candidates: list[tuple[float, str, dict, dict]] = []  # (score, symbol, info, indicators)

    try:
        # Öğrenilmiş ağırlıkları yükle
        weights = _get_learned_weights(db)
        logger.info(f"Kullanılan ağırlıklar: {weights}")

        # ── AŞAMA 1: Tüm hisselerin verisini çek + snapshot kaydet ──────────────
        for symbol in BIST30_SYMBOLS:
            try:
                info = fetch_stock_info(symbol)
                if not info:
                    errors += 1
                    continue

                perf = fetch_performance_returns(symbol)
                info.update(perf)

                df = fetch_history(symbol, period="1y")
                if df is None:
                    errors += 1
                    continue

                indicators = compute_all_indicators(df)
                hw = fetch_52w_high_low(df)
                if indicators:
                    indicators.update(hw)

                stock = _get_or_create_stock(db, symbol)
                _update_stock_fundamentals(db, stock, info)

                snap = Snapshot(
                    stock_id=stock.id,
                    timestamp=info["fetched_at"],
                    session=session_name,
                    open=info.get("open"),
                    high=info.get("high"),
                    low=info.get("low"),
                    close=info.get("close"),
                    volume=info.get("volume"),
                    change_pct=info.get("change_pct"),
                    performance_1d=info.get("performance_1d"),
                    performance_1w=info.get("performance_1w"),
                    performance_1m=info.get("performance_1m"),
                    performance_3m=info.get("performance_3m"),
                    performance_1y=info.get("performance_1y"),
                    fetched_at=info["fetched_at"],
                    data_delay_seconds=info.get("data_delay_seconds"),
                    **(indicators or {}),
                )
                db.add(snap)
                db.flush()
                scanned += 1

                if indicators is None:
                    continue

                # Teknik sinyal gücü skoru — RSI aşırı bölge, MACD crossover, hacim artışı
                rsi = indicators.get("rsi_14") or 50
                macd_hist = indicators.get("macd_histogram") or 0
                vol_ratio = indicators.get("volume_ratio_20d") or 1
                adx = indicators.get("adx") or 0

                pre_score = (
                    abs(rsi - 50) * weights["rsi_weight"] +
                    abs(macd_hist) * weights["macd_weight"] +
                    max(vol_ratio - 1, 0) * weights["volume_weight"] +
                    max(adx - 20, 0) * weights["trend_weight"]
                )
                candidates.append((pre_score, symbol, info, indicators, stock.id))

            except Exception as e:
                logger.error(f"{symbol}: veri çekme hatası — {e}", exc_info=True)
                errors += 1
                continue

        db.commit()

        # ── AŞAMA 2: En güçlü sinyalli MAX_PER_SCAN hisseyi Gemini'ye gönder ──
        # Zaten aktif önerisi olan hisseleri dışla
        active_stock_ids = set(
            r.stock_id for r in db.query(Recommendation)
            .filter(Recommendation.status == RecommendationStatus.active)
            .all()
        )

        # Sektör konsantrasyon limiti: aynı sektörden en fazla 2 hisse
        candidates.sort(key=lambda x: x[0], reverse=True)
        top_candidates = []
        sector_counts: dict[str, int] = {}
        SECTOR_MAX = 2
        for c in candidates:
            if c[4] in active_stock_ids:  # stock_id zaten aktif önerisi var
                continue
            sym = c[1]
            sector = STOCK_META.get(sym, {}).get("sector", "")
            if sector_counts.get(sector, 0) < SECTOR_MAX:
                top_candidates.append(c)
                sector_counts[sector] = sector_counts.get(sector, 0) + 1
            if len(top_candidates) >= MAX_PER_SCAN:
                break

        logger.info(
            f"Toplam {len(candidates)} hisse tarandı. "
            f"Gemini'ye gönderilecek top {len(top_candidates)}: "
            f"{[c[1] for c in top_candidates]}"
        )

        for pre_score, symbol, info, indicators, stock_id in top_candidates:
            try:
                learning_notes, accuracy, streak_info = _get_learning_context(db, stock_id)

                gemini_result = analyze_stock(
                    symbol=symbol,
                    name=STOCK_META.get(symbol, {}).get("name", symbol),
                    sector=STOCK_META.get(symbol, {}).get("sector", ""),
                    snapshot=info,
                    indicators=indicators,
                    accuracy_rate=accuracy,
                    learning_notes=learning_notes,
                    streak_info=streak_info,
                )
                gemini_calls_this_scan += 1

                if not gemini_result:
                    continue

                if gemini_result["confidence"] < MIN_CONFIDENCE:
                    logger.info(f"{symbol}: güven skoru düşük ({gemini_result['confidence']}), öneri oluşturulmadı.")
                    continue

                # ── Risk/Reward oranı kontrolü ────────────────────────────────
                current_price = info.get("close", 0) or 0
                target = gemini_result.get("target_price") or 0
                stop = gemini_result.get("stop_loss") or 0
                action = gemini_result["action"]

                if action == "BUY" and current_price > 0 and target > current_price and stop < current_price:
                    rr_ratio = (target - current_price) / (current_price - stop)
                    if rr_ratio < 1.2:
                        gemini_result["action"] = "WATCH"
                        gemini_result["confidence"] = max(40, gemini_result["confidence"] - 20)
                        logger.info(f"{symbol}: RR oranı düşük ({rr_ratio:.2f}), WATCH'a düşürüldü.")
                elif action == "SELL" and current_price > 0 and target < current_price and stop > current_price:
                    rr_ratio = (current_price - target) / (stop - current_price)
                    if rr_ratio < 1.2:
                        gemini_result["action"] = "WATCH"
                        gemini_result["confidence"] = max(40, gemini_result["confidence"] - 20)
                        logger.info(f"{symbol}: SELL RR oranı düşük ({rr_ratio:.2f}), WATCH'a düşürüldü.")

                # Tekrar güven kontrolü (RR sonrası düşmüş olabilir)
                if gemini_result["confidence"] < MIN_CONFIDENCE:
                    logger.info(f"{symbol}: RR sonrası güven düşük, öneri atlandı.")
                    continue

                status = RecommendationStatus.simulated if is_sim else RecommendationStatus.active

                stock = db.query(Stock).filter(Stock.id == stock_id).first()
                rec = Recommendation(
                    stock_id=stock_id,
                    session=session_name,
                    action=gemini_result["action"],
                    price_at_recommendation=info["close"],
                    target_price=gemini_result.get("target_price"),
                    stop_loss=gemini_result.get("stop_loss"),
                    confidence_score=gemini_result["confidence"],
                    time_horizon=gemini_result["time_horizon"],
                    reasoning=gemini_result.get("reasoning"),
                    key_signals=gemini_result.get("key_signals"),
                    risks=gemini_result.get("risks"),
                    sector_outlook=gemini_result.get("sector_outlook"),
                    bist30_relative=gemini_result.get("bist30_relative"),
                    technical_signals={
                        "rsi": indicators.get("rsi_14"),
                        "macd": indicators.get("macd"),
                        "macd_signal": indicators.get("macd_signal"),
                        "bb_upper": indicators.get("bb_upper"),
                        "bb_lower": indicators.get("bb_lower"),
                        "adx": indicators.get("adx"),
                        "volume_ratio": indicators.get("volume_ratio_20d"),
                    },
                    status=status,
                )
                db.add(rec)
                recommendations_created += 1

                # Bildirim için kaydet
                scan_recs.append({
                    "symbol": symbol,
                    "name": STOCK_META.get(symbol, {}).get("name", symbol),
                    "action": gemini_result["action"],
                    "confidence": gemini_result["confidence"],
                    "price": info["close"],
                    "target": gemini_result.get("target_price"),
                    "stop": gemini_result.get("stop_loss"),
                    "reasoning": gemini_result.get("reasoning", ""),
                    "key_signals": gemini_result.get("key_signals", []),
                })

            except Exception as e:
                logger.error(f"{symbol}: Gemini analiz hatası — {e}", exc_info=True)
                continue

        db.commit()

        # ── AŞAMA 3: Tarama özeti bildirimi ──────────────────────────────────
        _create_scan_notification(db, session_name, scanned, errors, scan_recs, is_sim)
        db.commit()

    except Exception as e:
        logger.error(f"Tarama kritik hata: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

    logger.info(
        f"=== Tarama tamamlandı: {session_name} | "
        f"Taranan: {scanned} | Gemini: {gemini_calls_this_scan} istek | "
        f"Öneri: {recommendations_created} | Hata: {errors} | Simülasyon: {is_sim} ==="
    )
    return {"scanned": scanned, "recommendations": recommendations_created, "errors": errors}
