from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
import yfinance as yf
import requests

from database import get_db
from models import Stock, Snapshot
from services.data_fetcher import fetch_history, _YF_SESSION

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("")
def list_stocks(
    active_only: bool = True,
    sector: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Stock)
    if active_only:
        q = q.filter(Stock.is_active == True)
    if sector:
        q = q.filter(Stock.sector == sector)
    stocks = q.order_by(Stock.symbol).all()

    result = []
    for s in stocks:
        latest = (
            db.query(Snapshot)
            .filter(Snapshot.stock_id == s.id)
            .order_by(desc(Snapshot.timestamp))
            .first()
        )
        result.append({
            "id": s.id,
            "symbol": s.symbol,
            "name": s.name,
            "sector": s.sector,
            "market_cap": s.market_cap,
            "is_active": s.is_active,
            "latest_price": latest.close if latest else None,
            "change_pct": latest.change_pct if latest else None,
            "last_updated": latest.timestamp.isoformat() if latest else None,
        })
    return result


@router.get("/live-prices")
def live_prices():
    """Tüm BIST30 hisseleri için anlık fiyat ve değişim — toplu çekim."""
    from utils.constants import BIST30_SYMBOLS
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def fetch_one(sym: str):
        try:
            info = yf.Ticker(sym, session=_YF_SESSION).fast_info
            close = float(info.last_price)
            prev = float(info.previous_close)
            change_pct = (close - prev) / prev * 100 if prev else 0.0
            return {"symbol": sym, "close": round(close, 2), "change_pct": round(change_pct, 2)}
        except Exception:
            return {"symbol": sym, "close": None, "change_pct": None}

    results = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_one, sym): sym for sym in BIST30_SYMBOLS}
        for future in as_completed(futures):
            r = future.result()
            results[r["symbol"]] = r

    # Orijinal sırayı koru
    return [results.get(sym, {"symbol": sym, "close": None, "change_pct": None}) for sym in BIST30_SYMBOLS]


@router.get("/{symbol}/live")
def live_price(symbol: str):
    """Tek hisse için anlık fiyat."""
    sym = symbol.upper()
    try:
        ticker = yf.Ticker(sym, session=_YF_SESSION)
        info = ticker.fast_info
        close = float(info.last_price)
        prev = float(info.previous_close)
        change_pct = (close - prev) / prev * 100 if prev else 0.0
        return {
            "symbol": sym,
            "close": round(close, 2),
            "change_pct": round(change_pct, 2),
            "prev_close": round(prev, 2),
            "day_high": round(float(info.day_high), 2) if info.day_high else None,
            "day_low": round(float(info.day_low), 2) if info.day_low else None,
            "volume": int(info.three_month_average_volume) if info.three_month_average_volume else None,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Canlı veri alınamadı: {e}")


@router.get("/sectors")
def list_sectors(db: Session = Depends(get_db)):
    rows = db.query(Stock.sector).filter(Stock.sector.isnot(None)).distinct().all()
    return sorted([r[0] for r in rows])


@router.get("/{symbol}")
def get_stock(symbol: str, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.symbol == symbol.upper()).first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"{symbol} bulunamadı.")

    latest = (
        db.query(Snapshot)
        .filter(Snapshot.stock_id == stock.id)
        .order_by(desc(Snapshot.timestamp))
        .first()
    )
    return {
        "id": stock.id,
        "symbol": stock.symbol,
        "name": stock.name,
        "sector": stock.sector,
        "market_cap": stock.market_cap,
        "pe_ratio": stock.pe_ratio,
        "pb_ratio": stock.pb_ratio,
        "is_active": stock.is_active,
        "latest_snapshot": _snap_to_dict(latest) if latest else None,
    }


@router.get("/{symbol}/history")
def get_history(
    symbol: str,
    period: str = Query("3mo", description="1d 5d 1mo 3mo 6mo 1y 2y"),
    interval: str = Query("1d", description="1d 1wk 1mo"),
):
    df = fetch_history(symbol.upper(), period=period, interval=interval)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail="Geçmiş veri bulunamadı.")

    records = []
    for ts, row in df.iterrows():
        records.append({
            "time": ts.isoformat(),
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
            "volume": int(row["Volume"]),
        })
    return records


@router.get("/{symbol}/snapshots")
def get_snapshots(
    symbol: str,
    limit: int = Query(30, le=200),
    session: Optional[str] = None,
    db: Session = Depends(get_db),
):
    stock = db.query(Stock).filter(Stock.symbol == symbol.upper()).first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"{symbol} bulunamadı.")

    q = db.query(Snapshot).filter(Snapshot.stock_id == stock.id)
    if session:
        q = q.filter(Snapshot.session == session)
    snaps = q.order_by(desc(Snapshot.timestamp)).limit(limit).all()
    return [_snap_to_dict(s) for s in snaps]


@router.get("/{symbol}/recommendations")
def get_stock_recommendations(
    symbol: str,
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    from models import Recommendation
    stock = db.query(Stock).filter(Stock.symbol == symbol.upper()).first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"{symbol} bulunamadı.")

    recs = (
        db.query(Recommendation)
        .filter(Recommendation.stock_id == stock.id)
        .order_by(desc(Recommendation.created_at))
        .limit(limit)
        .all()
    )
    return [_rec_to_dict(r) for r in recs]


# ── Yardımcı ──────────────────────────────────────────────────────────────────

def _snap_to_dict(s: Snapshot) -> dict:
    return {
        "id": s.id,
        "timestamp": s.timestamp.isoformat(),
        "session": s.session,
        "open": s.open, "high": s.high, "low": s.low, "close": s.close,
        "volume": s.volume, "change_pct": s.change_pct,
        "rsi_14": s.rsi_14, "macd": s.macd, "macd_signal": s.macd_signal,
        "macd_histogram": s.macd_histogram,
        "bb_upper": s.bb_upper, "bb_middle": s.bb_middle, "bb_lower": s.bb_lower,
        "ema_20": s.ema_20, "ema_50": s.ema_50, "sma_200": s.sma_200,
        "adx": s.adx, "atr": s.atr,
        "vwap": s.vwap, "volume_ratio_20d": s.volume_ratio_20d,
        "high_52w": s.high_52w, "low_52w": s.low_52w,
        "performance_1d": s.performance_1d, "performance_1w": s.performance_1w,
        "performance_1m": s.performance_1m, "performance_3m": s.performance_3m,
        "performance_1y": s.performance_1y,
    }


def _rec_to_dict(r) -> dict:
    return {
        "id": r.id,
        "stock_id": r.stock_id,
        "created_at": r.created_at.isoformat(),
        "session": r.session,
        "action": r.action,
        "price_at_recommendation": r.price_at_recommendation,
        "target_price": r.target_price,
        "stop_loss": r.stop_loss,
        "confidence_score": r.confidence_score,
        "time_horizon": r.time_horizon,
        "reasoning": r.reasoning,
        "key_signals": r.key_signals,
        "risks": r.risks,
        "sector_outlook": r.sector_outlook,
        "bist30_relative": r.bist30_relative,
        "technical_signals": r.technical_signals,
        "status": r.status,
        "closed_at": r.closed_at.isoformat() if r.closed_at else None,
    }
