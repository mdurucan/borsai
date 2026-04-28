"""
Bankacılık Uzmanı Ajanı
───────────────────────
BIST30 bankacılık hisselerini (AKBNK, GARAN, HALKB, ISCTR, VAKBN, YKBNK)
derinlemesine analiz eder. Scheduler tarafından günde 3 kez çağrılır.

Yaptıkları:
1. Bankacılık hisselerinin teknik + temel verilerini toplar.
2. Sektör ortalamasını hesaplar ve her hisseyi buna göre karşılaştırır.
3. Gemini'ye sektör uzmanı rolüyle özel bir prompt gönderir.
4. Sonuçları Notification tablosuna yazar → frontend bildirim çanında görünür.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Stock, Notification
from models.notification import Notification as Notif
from services.data_fetcher import fetch_stock_info, fetch_history, fetch_performance_returns, fetch_52w_high_low
from utils.technical import compute_all_indicators
from services.gemini_service import _call_gemini, _parse_json_response

logger = logging.getLogger(__name__)

BANKING_SYMBOLS = [
    "AKBNK.IS", "GARAN.IS", "HALKB.IS",
    "ISCTR.IS", "VAKBN.IS", "YKBNK.IS",
]

BANKING_AGENT_PROMPT = """
Sen Türkiye bankacılık sektörünün derinlemesine analizini yapan uzman bir finansal analistsin.
BIST30'daki bankacılık hisselerini analiz edip yatırımcılara özel içgörüler üretiyorsun.
Tüm yanıtlarını Türkçe ver.

Aşağıda {count} bankacılık hissesinin anlık verileri ve sektör ortalaması var:

=== SEKTÖR ORTALAMASI ===
Ortalama Günlük Değişim: {avg_change_pct:.2f}%
Ortalama RSI(14): {avg_rsi:.1f}
Ortalama Hacim Oranı: {avg_vol_ratio:.2f}x
Güçlü Hisseler (ortalamanın üstü): {leaders}
Zayıf Hisseler (ortalamanın altı): {laggards}

=== HİSSE DETAYLARI ===
{stock_details}

=== GÖREV ===
Bankacılık sektörünü bütünsel olarak değerlendir. Her hisse için ayrı ayrı öneri üret.
Türk bankacılık sektörüne özgü riskleri (kur riski, BDDK düzenlemeleri, kredi büyümesi,
mevduat maliyetleri, faiz marjı) mutlaka değerlendir.

Yalnızca aşağıdaki JSON yapısını döndür, başka hiçbir şey yazma:
{{
  "sector_summary": "Sektörün genel durumu hakkında 2-3 cümle Türkçe yorum",
  "sector_signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "top_pick": "En güçlü bankacılık hissesinin sembolü (örn: AKBNK.IS)",
  "avoid": "En zayıf / en riskli hissenin sembolü",
  "stocks": [
    {{
      "symbol": "AKBNK.IS",
      "action": "BUY" | "SELL" | "HOLD" | "WATCH",
      "confidence": 0-100,
      "target_price": float,
      "stop_loss": float,
      "key_insight": "Bu hisseye özel 1-2 cümle içgörü",
      "risk": "En kritik risk faktörü"
    }}
  ],
  "macro_risks": ["risk1", "risk2", "risk3"],
  "opportunity": "Sektörde öne çıkan fırsat (Türkçe)"
}}
"""


def _collect_banking_data() -> list[dict]:
    """Tüm bankacılık hisseleri için veri toplar."""
    results = []
    for symbol in BANKING_SYMBOLS:
        try:
            info = fetch_stock_info(symbol)
            if not info:
                continue
            perf = fetch_performance_returns(symbol)
            info.update(perf)

            df = fetch_history(symbol, period="1y")
            if df is None:
                continue
            indicators = compute_all_indicators(df) or {}
            hw = fetch_52w_high_low(df)
            indicators.update(hw)

            results.append({"symbol": symbol, "info": info, "indicators": indicators})
            logger.info(f"BankingAgent: {symbol} verisi toplandı.")
        except Exception as e:
            logger.error(f"BankingAgent: {symbol} veri hatası — {e}")
    return results


def _build_prompt(data: list[dict]) -> str:
    """Toplanan veriden Gemini prompt'u oluşturur."""
    changes = [d["info"].get("change_pct") or 0 for d in data]
    rsis    = [d["indicators"].get("rsi_14") or 50 for d in data]
    vols    = [d["indicators"].get("volume_ratio_20d") or 1 for d in data]

    avg_change = sum(changes) / len(changes)
    avg_rsi    = sum(rsis) / len(rsis)
    avg_vol    = sum(vols) / len(vols)

    leaders  = [d["symbol"].replace(".IS","") for d in data if (d["info"].get("change_pct") or 0) > avg_change]
    laggards = [d["symbol"].replace(".IS","") for d in data if (d["info"].get("change_pct") or 0) <= avg_change]

    lines = []
    for d in data:
        sym = d["symbol"]
        i   = d["info"]
        ind = d["indicators"]
        lines.append(
            f"• {sym.replace('.IS','')} | Fiyat: {i.get('close',0):.2f} TL | "
            f"Değişim: {i.get('change_pct',0):+.2f}% | "
            f"RSI: {ind.get('rsi_14',0):.1f} | "
            f"MACD Hist: {ind.get('macd_histogram',0):.3f} | "
            f"Hacim Oranı: {ind.get('volume_ratio_20d',1):.2f}x | "
            f"EMA20 {'↑' if (i.get('close') or 0) > (ind.get('ema_20') or 0) else '↓'} | "
            f"52H: {ind.get('high_52w',0):.2f}/{ind.get('low_52w',0):.2f}"
        )

    return BANKING_AGENT_PROMPT.format(
        count=len(data),
        avg_change_pct=avg_change,
        avg_rsi=avg_rsi,
        avg_vol_ratio=avg_vol,
        leaders=", ".join(leaders) or "—",
        laggards=", ".join(laggards) or "—",
        stock_details="\n".join(lines),
    )


def _save_notifications(db: Session, result: dict, data: list[dict]):
    """Gemini sonucunu Notification kayıtlarına dönüştürür."""
    prices = {d["symbol"]: d["info"].get("close") for d in data}

    # 1. Sektör özeti bildirimi
    signal = result.get("sector_signal", "NEUTRAL")
    signal_emoji = {"BULLISH": "🟢", "BEARISH": "🔴", "NEUTRAL": "🟡"}.get(signal, "⚪")
    top_pick = result.get("top_pick", "")
    avoid    = result.get("avoid", "")

    db.add(Notif(
        source="banking_agent",
        title=f"{signal_emoji} Bankacılık Sektörü — {signal}",
        body=result.get("sector_summary", ""),
        action=signal,
        meta={
            "top_pick": top_pick,
            "avoid": avoid,
            "macro_risks": result.get("macro_risks", []),
            "opportunity": result.get("opportunity"),
        },
    ))

    # 2. Her hisse için öneri bildirimi (sadece BUY / SELL)
    for stock_rec in result.get("stocks", []):
        action = stock_rec.get("action", "HOLD")
        symbol = stock_rec.get("symbol", "")
        conf   = stock_rec.get("confidence", 0)

        if action not in ("BUY", "SELL"):
            continue
        if conf < 55:
            continue

        action_label = "AL 📈" if action == "BUY" else "SAT 📉"
        db.add(Notif(
            source="banking_agent",
            title=f"[Bankacılık] {symbol.replace('.IS','')} — {action_label} (Güven: {conf}%)",
            body=stock_rec.get("key_insight", ""),
            symbol=symbol,
            action=action,
            confidence=conf,
            meta={
                "target_price": stock_rec.get("target_price"),
                "stop_loss": stock_rec.get("stop_loss"),
                "risk": stock_rec.get("risk"),
                "current_price": prices.get(symbol),
            },
        ))
        logger.info(f"BankingAgent bildirimi: {symbol} {action} %{conf}")


def run_banking_agent(session: str = "auto") -> dict:
    """
    Ana giriş noktası — scheduler tarafından çağrılır.
    """
    logger.info(f"=== Bankacılık Ajanı başladı | {datetime.now(timezone.utc).isoformat()} ===")
    db = SessionLocal()
    notifications_created = 0

    try:
        # 1. Veri topla
        data = _collect_banking_data()
        if len(data) < 2:
            logger.warning("BankingAgent: Yeterli veri yok, atlanıyor.")
            return {"status": "skipped", "reason": "insufficient_data"}

        # 2. Prompt oluştur ve Gemini'ye gönder
        prompt = _build_prompt(data)
        raw = _call_gemini(prompt)
        result = _parse_json_response(raw)

        if not result:
            logger.error("BankingAgent: Gemini yanıtı parse edilemedi.")
            return {"status": "error", "reason": "gemini_parse_failed"}

        # 3. Bildirimleri kaydet
        _save_notifications(db, result, data)
        db.commit()

        # Kaydedilen bildirimleri say
        from sqlalchemy import func as sqlfunc
        notifications_created = db.query(sqlfunc.count(Notif.id)).filter(
            Notif.source == "banking_agent",
            Notif.is_read == False,
        ).scalar() or 0

        logger.info(
            f"=== Bankacılık Ajanı tamamlandı | "
            f"Hisse: {len(data)} | Bildirim: {notifications_created} ==="
        )
        return {
            "status": "ok",
            "stocks_analyzed": len(data),
            "sector_signal": result.get("sector_signal"),
            "top_pick": result.get("top_pick"),
            "notifications_created": notifications_created,
        }

    except Exception as e:
        logger.error(f"BankingAgent kritik hata: {e}", exc_info=True)
        db.rollback()
        return {"status": "error", "reason": str(e)}
    finally:
        db.close()
