from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
import yfinance as yf

from database import get_db
from models import Stock, Snapshot

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/indices")
def market_indices():
    """BIST30, BIST50, BIST100 anlık endeks verileri."""
    symbols = {
        "XU030.IS": "BIST 30",
        "XU050.IS": "BIST 50",
        "XU100.IS": "BIST 100",
    }
    result = []
    for ticker, name in symbols.items():
        try:
            t = yf.Ticker(ticker)
            info = t.fast_info
            close = float(info.last_price)
            prev = float(info.previous_close)
            change_pct = (close - prev) / prev * 100 if prev else 0.0
            result.append({
                "symbol": ticker,
                "name": name,
                "close": round(close, 2),
                "change_pct": round(change_pct, 2),
            })
        except Exception:
            result.append({
                "symbol": ticker,
                "name": name,
                "close": None,
                "change_pct": None,
            })
    return result


@router.get("/overview")
def market_overview(db: Session = Depends(get_db)):
    """Tüm BIST30 hisselerinin son snapshot özeti."""
    stocks = db.query(Stock).filter(Stock.is_active == True).all()
    result = []
    gainers = []
    losers = []

    for s in stocks:
        snap = (
            db.query(Snapshot)
            .filter(Snapshot.stock_id == s.id)
            .order_by(desc(Snapshot.timestamp))
            .first()
        )
        item = {
            "symbol": s.symbol,
            "name": s.name,
            "sector": s.sector,
            "close": snap.close if snap else None,
            "change_pct": snap.change_pct if snap else None,
            "volume": snap.volume if snap else None,
            "rsi_14": snap.rsi_14 if snap else None,
        }
        result.append(item)
        if snap and snap.change_pct is not None:
            if snap.change_pct > 0:
                gainers.append(item)
            else:
                losers.append(item)

    gainers.sort(key=lambda x: x["change_pct"], reverse=True)
    losers.sort(key=lambda x: x["change_pct"])

    return {
        "stocks": result,
        "top_gainers": gainers[:5],
        "top_losers": losers[:5],
        "total_active": len(result),
    }


@router.get("/heatmap")
def sector_heatmap(db: Session = Depends(get_db)):
    """Sektör bazında ortalama değişim — frontend heatmap için."""
    stocks = db.query(Stock).filter(Stock.is_active == True).all()
    sectors: dict[str, list[float]] = {}

    for s in stocks:
        if not s.sector:
            continue
        snap = (
            db.query(Snapshot)
            .filter(Snapshot.stock_id == s.id)
            .order_by(desc(Snapshot.timestamp))
            .first()
        )
        if snap and snap.change_pct is not None:
            sectors.setdefault(s.sector, []).append(snap.change_pct)

    return [
        {
            "sector": sector,
            "avg_change_pct": round(sum(vals) / len(vals), 2),
            "stock_count": len(vals),
        }
        for sector, vals in sorted(sectors.items())
    ]
