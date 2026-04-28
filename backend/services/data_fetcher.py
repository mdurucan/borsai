import logging
import time
from datetime import datetime, timezone
from typing import Optional

import yfinance as yf
import pandas as pd

from utils.constants import BIST30_SYMBOLS, STOCK_META

logger = logging.getLogger(__name__)


def fetch_stock_info(symbol: str) -> Optional[dict]:
    """
    Tek bir hisse için temel bilgileri ve güncel fiyat verisini çeker.
    Hata durumunda None döner, sistemi durdurmaz.
    """
    try:
        fetch_start = time.time()
        ticker = yf.Ticker(symbol)
        info = ticker.info

        price = (
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or info.get("previousClose")
        )
        if price is None:
            logger.warning(f"{symbol}: fiyat verisi alınamadı, atlanıyor.")
            return None

        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
        change_pct = ((price - prev_close) / prev_close * 100) if prev_close else None

        delay = int(time.time() - fetch_start)

        return {
            "symbol": symbol,
            "name": STOCK_META.get(symbol, {}).get("name", info.get("longName", symbol)),
            "sector": STOCK_META.get(symbol, {}).get("sector", info.get("sector")),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "pb_ratio": info.get("priceToBook"),
            # Fiyat
            "open": info.get("open") or info.get("regularMarketOpen"),
            "high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "low": info.get("dayLow") or info.get("regularMarketDayLow"),
            "close": price,
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "change_pct": change_pct,
            # Meta
            "fetched_at": datetime.now(timezone.utc),
            "data_delay_seconds": delay,
        }
    except Exception as e:
        logger.error(f"{symbol}: fetch_stock_info hatası — {e}")
        return None


def fetch_history(symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Hisse için OHLCV geçmişini çeker.
    period: '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'
    interval: '1m', '5m', '15m', '1h', '1d', '1wk', '1mo'
    """
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            logger.warning(f"{symbol}: {period} geçmiş veri boş döndü.")
            return None
        df.index = pd.to_datetime(df.index, utc=True)
        return df
    except Exception as e:
        logger.error(f"{symbol}: fetch_history hatası — {e}")
        return None


def fetch_performance_returns(symbol: str) -> dict:
    """
    1g, 1h, 1a, 3a, 1y getirilerini hesaplar.
    """
    returns = {
        "performance_1d": None,
        "performance_1w": None,
        "performance_1m": None,
        "performance_3m": None,
        "performance_1y": None,
    }
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="1y", interval="1d")
        if df.empty or len(df) < 2:
            return returns

        current = df["Close"].iloc[-1]

        def pct(days: int) -> Optional[float]:
            if len(df) > days:
                past = df["Close"].iloc[-(days + 1)]
                return round((current - past) / past * 100, 2) if past else None
            return None

        returns["performance_1d"] = pct(1)
        returns["performance_1w"] = pct(5)
        returns["performance_1m"] = pct(21)
        returns["performance_3m"] = pct(63)
        returns["performance_1y"] = pct(252)

    except Exception as e:
        logger.error(f"{symbol}: fetch_performance_returns hatası — {e}")

    return returns


def fetch_all_stocks(symbols: list[str] = BIST30_SYMBOLS) -> list[dict]:
    """
    Tüm BIST30 hisseleri için veri çeker.
    Başarısız olanlar loglanır, liste dışında bırakılır.
    """
    results = []
    for symbol in symbols:
        logger.info(f"Çekiliyor: {symbol}")
        info = fetch_stock_info(symbol)
        if info is None:
            continue

        perf = fetch_performance_returns(symbol)
        info.update(perf)
        results.append(info)

        # Yahoo Finance rate-limit koruması
        time.sleep(0.3)

    logger.info(f"Toplam {len(results)}/{len(symbols)} hisse başarıyla çekildi.")
    return results


def fetch_52w_high_low(df: pd.DataFrame) -> dict:
    """
    DataFrame'den 52 haftalık yüksek/düşük hesaplar.
    """
    if df is None or df.empty:
        return {"high_52w": None, "low_52w": None}
    last_year = df.tail(252)
    return {
        "high_52w": float(last_year["High"].max()),
        "low_52w": float(last_year["Low"].min()),
    }
