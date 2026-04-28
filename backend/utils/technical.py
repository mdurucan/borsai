"""
Teknik analiz hesaplamaları — saf pandas/numpy, harici kütüphane gerektirmez.
Tüm fonksiyonlar pd.Series veya pd.DataFrame alır, float/dict döner.
"""
import numpy as np
import pandas as pd
from typing import Optional


# ── Momentum ──────────────────────────────────────────────────────────────────

def calc_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def calc_macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> dict[str, pd.Series]:
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return {"macd": macd_line, "macd_signal": signal_line, "macd_histogram": histogram}


def calc_stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = 14,
    d_period: int = 3,
) -> dict[str, pd.Series]:
    lowest_low = low.rolling(k_period).min()
    highest_high = high.rolling(k_period).max()
    k = 100 * (close - lowest_low) / (highest_high - lowest_low).replace(0, np.nan)
    d = k.rolling(d_period).mean()
    return {"stoch_k": k, "stoch_d": d}


# ── Trend ─────────────────────────────────────────────────────────────────────

def calc_ema(close: pd.Series, span: int) -> pd.Series:
    return close.ewm(span=span, adjust=False).mean()


def calc_sma(close: pd.Series, window: int) -> pd.Series:
    return close.rolling(window).mean()


def calc_adx(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.ewm(com=period - 1, min_periods=period).mean()

    up_move = high.diff()
    down_move = -low.diff()

    pos_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    neg_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    pos_di = 100 * pd.Series(pos_dm, index=close.index).ewm(com=period - 1, min_periods=period).mean() / atr
    neg_di = 100 * pd.Series(neg_dm, index=close.index).ewm(com=period - 1, min_periods=period).mean() / atr

    dx = 100 * (pos_di - neg_di).abs() / (pos_di + neg_di).replace(0, np.nan)
    adx = dx.ewm(com=period - 1, min_periods=period).mean()
    return adx


# ── Volatilite ────────────────────────────────────────────────────────────────

def calc_bollinger_bands(
    close: pd.Series,
    period: int = 20,
    std_dev: float = 2.0,
) -> dict[str, pd.Series]:
    middle = close.rolling(period).mean()
    std = close.rolling(period).std()
    return {
        "bb_upper": middle + std_dev * std,
        "bb_middle": middle,
        "bb_lower": middle - std_dev * std,
    }


def calc_atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, min_periods=period).mean()


# ── Hacim ─────────────────────────────────────────────────────────────────────

def calc_obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    direction = np.sign(close.diff()).fillna(0)
    return (direction * volume).cumsum()


def calc_vwap(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
) -> pd.Series:
    typical_price = (high + low + close) / 3
    return (typical_price * volume).cumsum() / volume.cumsum()


def calc_volume_ratio(volume: pd.Series, period: int = 20) -> pd.Series:
    """Günlük hacim / N günlük ortalama hacim."""
    return volume / volume.rolling(period).mean()


# ── Destek / Direnç ───────────────────────────────────────────────────────────

def calc_fibonacci(swing_high: float, swing_low: float) -> dict[str, float]:
    """Son büyük swing'den Fibonacci retracement seviyeleri."""
    diff = swing_high - swing_low
    return {
        "fib_236": round(swing_high - 0.236 * diff, 4),
        "fib_382": round(swing_high - 0.382 * diff, 4),
        "fib_500": round(swing_high - 0.500 * diff, 4),
        "fib_618": round(swing_high - 0.618 * diff, 4),
    }


# ── Ana hesaplama fonksiyonu ───────────────────────────────────────────────────

def compute_all_indicators(df: pd.DataFrame) -> Optional[dict]:
    """
    OHLCV DataFrame'inden tüm teknik göstergeleri hesaplar.
    Son satırın (en güncel bar) değerlerini dict olarak döner.

    Beklenen kolon adları: Open, High, Low, Close, Volume
    """
    if df is None or len(df) < 30:
        return None

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    # Momentum
    rsi = calc_rsi(close)
    macd_data = calc_macd(close)
    stoch = calc_stochastic(high, low, close)

    # Trend
    ema20 = calc_ema(close, 20)
    ema50 = calc_ema(close, 50)
    sma200 = calc_sma(close, 200)
    adx = calc_adx(high, low, close)

    # Volatilite
    bb = calc_bollinger_bands(close)
    atr = calc_atr(high, low, close)

    # Hacim
    obv = calc_obv(close, volume)
    vwap = calc_vwap(high, low, close, volume)
    vol_ratio = calc_volume_ratio(volume)

    # 52 haftalık yüksek / düşük
    last_252 = df.tail(252)
    high_52w = float(last_252["High"].max())
    low_52w = float(last_252["Low"].min())

    # Fibonacci (son 1 yılın swing'inden)
    fib = calc_fibonacci(high_52w, low_52w)

    def last(series: pd.Series) -> Optional[float]:
        val = series.iloc[-1]
        return round(float(val), 6) if pd.notna(val) else None

    return {
        # Momentum
        "rsi_14": last(rsi),
        "macd": last(macd_data["macd"]),
        "macd_signal": last(macd_data["macd_signal"]),
        "macd_histogram": last(macd_data["macd_histogram"]),
        "stoch_k": last(stoch["stoch_k"]),
        "stoch_d": last(stoch["stoch_d"]),
        # Trend
        "ema_20": last(ema20),
        "ema_50": last(ema50),
        "sma_200": last(sma200),
        "adx": last(adx),
        # Volatilite
        "bb_upper": last(bb["bb_upper"]),
        "bb_middle": last(bb["bb_middle"]),
        "bb_lower": last(bb["bb_lower"]),
        "atr": last(atr),
        # Hacim
        "obv": last(obv),
        "vwap": last(vwap),
        "volume_ratio_20d": last(vol_ratio),
        # Destek / Direnç
        "high_52w": high_52w,
        "low_52w": low_52w,
        "fib_382": fib["fib_382"],
        "fib_500": fib["fib_500"],
        "fib_618": fib["fib_618"],
    }
