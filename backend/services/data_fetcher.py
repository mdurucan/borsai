import logging
import time
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import requests

from utils.constants import BIST30_SYMBOLS, STOCK_META

logger = logging.getLogger(__name__)

# Yahoo Finance doğrudan REST — yfinance yerine
_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
    "Origin": "https://finance.yahoo.com",
})

# yfinance sadece fetch_history için (geçmiş OHLCV pandas işlemleri gerektiğinden)
try:
    import yfinance as yf
    _YF_AVAILABLE = True
except ImportError:
    _YF_AVAILABLE = False

# Dışa açık session referansı (router'lar için)
_YF_SESSION = _SESSION


def _yahoo_quote(symbol: str) -> Optional[dict]:
    """Yahoo Finance v8 quoteSummary endpoint — doğrudan REST çağrısı."""
    url = (
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?interval=1d&range=2d&includePrePost=false"
    )
    try:
        resp = _SESSION.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"]
        if not result:
            return None
        r = result[0]
        meta = r.get("meta", {})
        return meta
    except Exception as e:
        logger.debug(f"{symbol}: _yahoo_quote hatası — {e}")
        return None


def _yahoo_quote_summary(symbol: str) -> Optional[dict]:
    """Yahoo Finance quoteSummary — market cap, PE gibi temel veriler."""
    url = (
        f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
        f"?modules=price,summaryDetail,defaultKeyStatistics"
    )
    try:
        resp = _SESSION.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        qs = data.get("quoteSummary", {})
        if qs.get("error"):
            return None
        result = qs.get("result", [])
        if not result:
            return None
        return result[0]
    except Exception as e:
        logger.debug(f"{symbol}: _yahoo_quote_summary hatası — {e}")
        return None


def fetch_stock_info(symbol: str) -> Optional[dict]:
    """
    Tek bir hisse için temel bilgileri ve güncel fiyat verisini çeker.
    Hata durumunda None döner, sistemi durdurmaz.
    """
    fetch_start = time.time()
    try:
        meta = _yahoo_quote(symbol)
        if not meta:
            logger.warning(f"{symbol}: chart meta alınamadı.")
            return None

        price = (
            meta.get("regularMarketPrice")
            or meta.get("chartPreviousClose")
        )
        if price is None:
            logger.warning(f"{symbol}: fiyat verisi alınamadı, atlanıyor.")
            return None

        prev_close = meta.get("chartPreviousClose") or meta.get("previousClose") or meta.get("regularMarketPreviousClose")
        change_pct = ((price - prev_close) / prev_close * 100) if prev_close and prev_close != 0 else None

        # Ek veriler (opsiyonel — başarısız olsa da devam)
        market_cap = None
        pe_ratio = None
        pb_ratio = None
        day_open = meta.get("regularMarketOpen")
        day_high = meta.get("regularMarketDayHigh")
        day_low = meta.get("regularMarketDayLow")
        volume = meta.get("regularMarketVolume")

        try:
            qs = _yahoo_quote_summary(symbol)
            if qs:
                price_mod = qs.get("price", {})
                detail = qs.get("summaryDetail", {})
                stats = qs.get("defaultKeyStatistics", {})

                def raw(d, key):
                    v = d.get(key)
                    if isinstance(v, dict):
                        return v.get("raw")
                    return v

                market_cap = raw(price_mod, "marketCap")
                pe_ratio = raw(detail, "trailingPE")
                pb_ratio = raw(stats, "priceToBook")
                if not day_open:
                    day_open = raw(price_mod, "regularMarketOpen")
                if not day_high:
                    day_high = raw(price_mod, "regularMarketDayHigh")
                if not day_low:
                    day_low = raw(price_mod, "regularMarketDayLow")
                if not volume:
                    volume = raw(price_mod, "regularMarketVolume")
        except Exception:
            pass

        delay = int(time.time() - fetch_start)
        stock_meta = STOCK_META.get(symbol, {})

        return {
            "symbol": symbol,
            "name": stock_meta.get("name", meta.get("longName") or meta.get("shortName") or symbol),
            "sector": stock_meta.get("sector", meta.get("sector")),
            "market_cap": market_cap,
            "pe_ratio": pe_ratio,
            "pb_ratio": pb_ratio,
            "open": day_open,
            "high": day_high,
            "low": day_low,
            "close": price,
            "volume": volume,
            "change_pct": round(change_pct, 2) if change_pct is not None else None,
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
    # Önce yfinance dene, başarısız olursa Yahoo REST'e düş
    if _YF_AVAILABLE:
        try:
            ticker = yf.Ticker(symbol, session=_SESSION)
            df = ticker.history(period=period, interval=interval)
            if not df.empty:
                df.index = pd.to_datetime(df.index, utc=True)
                return df
        except Exception as e:
            logger.debug(f"{symbol}: yfinance history hatası, REST'e düşülüyor — {e}")

    # Yahoo Finance chart REST endpoint
    period_map = {
        "1d": ("1d", "5m"), "5d": ("5d", "15m"), "1mo": ("1mo", "1d"),
        "3mo": ("3mo", "1d"), "6mo": ("6mo", "1d"), "1y": ("1y", "1d"),
        "2y": ("2y", "1wk"), "5y": ("5y", "1wk"),
    }
    range_str, _ = period_map.get(period, ("1y", "1d"))
    url = (
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?interval={interval}&range={range_str}&includePrePost=false"
    )
    try:
        resp = _SESSION.get(url, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"]
        if not result:
            return None
        r = result[0]
        timestamps = r.get("timestamp", [])
        ohlcv = r.get("indicators", {}).get("quote", [{}])[0]
        if not timestamps or not ohlcv:
            return None

        df = pd.DataFrame({
            "Open": ohlcv.get("open", []),
            "High": ohlcv.get("high", []),
            "Low": ohlcv.get("low", []),
            "Close": ohlcv.get("close", []),
            "Volume": ohlcv.get("volume", []),
        }, index=pd.to_datetime(timestamps, unit="s", utc=True))

        df = df.dropna(subset=["Close"])
        if df.empty:
            logger.warning(f"{symbol}: {period} geçmiş veri boş döndü.")
            return None
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
        df = fetch_history(symbol, period="1y", interval="1d")
        if df is None or df.empty or len(df) < 2:
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
