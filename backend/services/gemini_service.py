"""
Gemini API entegrasyonu.
- Günlük tarama analizi (BUY/SELL/HOLD/WATCH önerisi)
- Haftalık öz değerlendirme (self-evaluation)
- Rate limiting: dakikada 14 istek (ücretsiz tier)
"""
import json
import logging
import os
import time
from datetime import datetime
from typing import Optional

from google import genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.5-flash-lite"
RATE_LIMIT_PER_MIN = int(os.getenv("GEMINI_RATE_LIMIT_PER_MIN", 14))
# Ücretsiz tier: günde 20 istek. Bankacılık ajanına 2 bırak, 18'i taramalara ver.
DAILY_BUDGET = int(os.getenv("GEMINI_DAILY_BUDGET", 18))
# Tarama başına maksimum istek (günde 3 tarama × 5 = 15, bankacılık için 3 kalır)
MAX_PER_SCAN = int(os.getenv("GEMINI_MAX_PER_SCAN", 5))

_last_request_times: list[float] = []
_daily_count_date: str = ""
_daily_count: int = 0


def _rate_limit_wait():
    """Dakikada RATE_LIMIT_PER_MIN isteği aşmamak için bekler."""
    global _last_request_times
    now = time.time()
    _last_request_times = [t for t in _last_request_times if now - t < 60]
    if len(_last_request_times) >= RATE_LIMIT_PER_MIN:
        wait = 60 - (now - _last_request_times[0]) + 0.5
        if wait > 0:
            logger.info(f"Gemini rate limit: {wait:.1f}s bekleniyor...")
            time.sleep(wait)
    _last_request_times.append(time.time())


def get_daily_remaining() -> int:
    """Bugün kalan Gemini istek sayısını döner."""
    global _daily_count_date, _daily_count
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if _daily_count_date != today:
        _daily_count_date = today
        _daily_count = 0
    return max(0, DAILY_BUDGET - _daily_count)


def _check_and_increment_daily() -> bool:
    """Günlük bütçe müsaitse True döner ve sayacı artırır."""
    global _daily_count_date, _daily_count
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if _daily_count_date != today:
        _daily_count_date = today
        _daily_count = 0
    if _daily_count >= DAILY_BUDGET:
        logger.warning(f"Gemini günlük bütçe doldu ({DAILY_BUDGET} istek). İstek atlanıyor.")
        return False
    _daily_count += 1
    return True


def _call_gemini(prompt: str, bypass_budget: bool = False) -> Optional[str]:
    """Ham Gemini API çağrısı. Hata durumunda None döner."""
    if not bypass_budget and not _check_and_increment_daily():
        return None
    _rate_limit_wait()
    try:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
        return response.text
    except Exception as e:
        logger.error(f"Gemini API hatası: {e}")
        # 429 durumunda sayacı geri al
        global _daily_count
        if "429" in str(e) and _daily_count > 0:
            _daily_count -= 1
        return None


def _parse_json_response(raw: str) -> Optional[dict]:
    """Gemini yanıtından JSON bloğunu çıkarır ve parse eder."""
    if not raw:
        return None
    # ```json ... ``` bloğunu temizle
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # JSON bloğunu bulmaya çalış
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass
    logger.error(f"JSON parse başarısız. Ham yanıt:\n{raw[:300]}")
    return None


# ── Sektöre Özgü Risk Bağlamı ────────────────────────────────────────────────

SECTOR_CONTEXT = {
    "Bankacılık": """Bankacılık Sektörü Özgün Riskler:
- BDDK düzenlemeleri ve sermaye yeterliliği baskısı
- Net faiz marjı (NFM): faiz artışında mevduat maliyeti yükselir
- Takipteki kredi oranı (NPL) artışı kredi kalitesini etkiler
- Kur riski: dövizli krediler ve yükümlülükler
- TCMB politika değişiklikleri doğrudan bilançoyu etkiler""",

    "Enerji & Petrol": """Enerji Sektörü Özgün Riskler:
- Ham petrol ve doğalgaz fiyatlarındaki değişimler
- OPEC kararları ve küresel enerji arz/talebi
- Rafinerik marjları ve petrokim spread'leri
- TL/USD paritesi: enerji ithalatı TL bazında maliyeti artırır
- Enerji fiyat düzenlemeleri (akaryakıt vergileri, KDV)""",

    "Otomotiv": """Otomotiv Sektörü Özgün Riskler:
- Küresel çip/yarı iletken tedarik zinciri sorunları
- Avrupa otomobil satış hacmi (ihracat bağımlılığı)
- Hammadde maliyeti: çelik, alüminyum, bakır
- TL değer kaybı ihracatçı firmalara avantaj sağlar
- EV (elektrikli araç) geçiş riski""",

    "Perakende": """Perakende Sektörü Özgün Riskler:
- Tüketici güveni ve harcanabilir gelir
- Yüksek enflasyonun reel satın alma gücüne etkisi
- Gıda fiyat enflasyonu ve maliyet baskısı
- Kira maliyetleri ve işgücü giderleri
- E-ticaret rekabeti""",

    "Holding": """Holding Sektörü Özgün Riskler:
- Portföy şirketlerinin performans çeşitliliği
- NAV (Net Varlık Değeri) iskontosu/primi
- Holding iskontosu: piyasa genellikle holding'e daha düşük değer biçer
- Bağlı şirketlerdeki sektörel riskler kümülatif etki yapar""",

    "Havacılık": """Havacılık Sektörü Özgün Riskler:
- Jet yakıt maliyeti (petrol fiyatına bağlı)
- Dolar bazlı kira/leasing giderleri (kur riski yüksek)
- Turizm sezonu ve yolcu talebi dalgalanması
- Operasyonel düzenleme ve slot hakları
- Küresel seyahat kısıtlamaları riski""",

    "Demir & Çelik": """Demir Çelik Sektörü Özgün Riskler:
- Küresel çelik fiyatları ve Çin ihracat politikası
- Demir cevheri ve kömür hammadde maliyeti
- AB karbon sınır vergisi (CBAM) ihracat riski
- İnşaat sektörü talebi (yurt içi)
- Enerji maliyeti (yüksek enerji yoğunluklu sektör)""",

    "Telekomünikasyon": """Telekomünikasyon Sektörü Özgün Riskler:
- BTK düzenlemeleri ve tarife kısıtlamaları
- 5G altyapı yatırım maliyeti
- Abone büyümesi sınırlı (doygunlaşmış pazar)
- Sabit kıymet amortismanı ve FAVÖK marjı
- Dövizli borç yükü""",

    "Gayrimenkul": """Gayrimenkul Sektörü Özgün Riskler:
- Konut satış hacmi ve inşaat izinleri
- Faiz oranı: konut kredisi maliyetine doğrudan etki
- Kira enflasyonu ve kira denetim riskleri
- Arsa ve inşaat maliyeti
- Kentsel dönüşüm projeleri""",
}

DEFAULT_SECTOR_CONTEXT = """Genel Piyasa Riskleri:
- TL değer kaybı ihracatçılara avantaj, ithalatçılara dezavantaj
- TCMB faiz politikası ve likidite koşulları
- Küresel risk iştahı ve gelişmekte olan piyasa (EM) akışları
- Jeopolitik riskler ve Türkiye CDS spread'i"""

# ── Günlük Tarama Analizi ─────────────────────────────────────────────────────

SCAN_PROMPT_TEMPLATE = """
Sen deneyimli bir Borsa İstanbul uzmanısın. BIST30 hisselerini analiz edip yatırım önerileri üretiyorsun.
Tüm yanıtlarını Türkçe ver.

=== KARAR KURALLARI (MUTLAKA UY) ===
1. Confidence 70+ SADECE teknik göstergelerin en az 4/6'sı aynı yönü gösteriyorsa ver
2. BUY ver: RSI<65 VE MACD histogram pozitif VE fiyat EMA20 üstünde VE hacim ortalamanın üstünde (en az 3'ü)
3. SELL ver: RSI>65 VE MACD histogram negatif VE fiyat EMA20 altında (en az 3'ü)
4. Çelişen sinyaller varsa → WATCH, confidence 55-65
5. Net sinyal yoksa → HOLD, confidence 40-55
6. RSI>75 iken BUY verme, confidence'ı 15 puan düşür
7. ADX<20 (trendsiz) iken BUY/SELL confidence'ı 10 puan düşür
8. Son 5 öneri 4'ü başarısızsa confidence'ı 20 puan düşür (accuracy_rate düşükse bu geçerli)
9. target_price BUY için en az %2 yukarıda, stop_loss en fazla %5 aşağıda olmalı
10. stop_loss BUY için mutlaka current_price'ın altında, SELL için üstünde olmalı

=== MAKRO BAĞLAM ===
{macro_context}

=== SEKTÖR RİSK BAĞLAMI ===
{sector_context}

=== HİSSE BİLGİLERİ ===
HİSSE: {symbol} - {name}
SEKTÖR: {sector}

=== FİYAT VERİLERİ ===
Güncel Fiyat: {current_price} TL
Günlük Değişim: {change_1d}%
Haftalık: {change_1w}%
Aylık: {change_1m}%
Çeyreklik: {change_3m}%
Yıllık: {change_1y}%

=== TEKNİK ANALİZ ===
RSI(14): {rsi} → {rsi_label}
MACD: {macd} | Signal: {macd_signal} | Histogram: {macd_histogram} → {macd_label}
Stochastic: %K={stoch_k} | %D={stoch_d}
BB: Üst {bb_upper} | Orta {bb_middle} | Alt {bb_lower} | Pozisyon: {bb_position}
EMA20: {ema20} | EMA50: {ema50} | SMA200: {sma200} | Trend: {ema_trend}
ADX: {adx} → {adx_label}
ATR: {atr}
Hacim vs 20g Ort: {volume_ratio}x → {volume_label}
VWAP: {vwap}
52H Yüksek: {high_52w} | 52H Düşük: {low_52w}
Fibonacci %38.2: {fib_382} | %50: {fib_500} | %61.8: {fib_618}

=== PERFORMANS GEÇMİŞİ ===
Son önerimizin başarısı: {last_rec_performance}
Bu hissede doğru tahmin oranı: {accuracy_rate}%
Son 5 öneri streak: {streak_info}

=== ÖĞRENME NOTLARI ===
{learning_notes}

Yalnızca aşağıdaki JSON yapısını döndür, başka hiçbir şey yazma:
{{
  "action": "BUY" veya "SELL" veya "HOLD" veya "WATCH",
  "confidence": 0-100 arası tam sayı,
  "target_price": float,
  "stop_loss": float,
  "time_horizon": "daily" veya "weekly" veya "monthly",
  "reasoning": "Türkçe detaylı gerekçe (min 200 karakter)",
  "key_signals": ["sinyal1", "sinyal2", "sinyal3"],
  "risks": ["risk1", "risk2"],
  "sector_outlook": "Sektör genel değerlendirmesi",
  "bist30_relative": "BIST30'a göre relatif güç değerlendirmesi"
}}
"""


def _get_macro_context() -> str:
    """USD/TL ve BIST100 endeksini çekip makro bağlam üretir."""
    try:
        import yfinance as yf
        usdtry = yf.Ticker("USDTRY=X")
        usdtry_price = round(float(usdtry.fast_info.last_price), 2)
        bist100 = yf.Ticker("XU100.IS")
        bist100_price = round(float(bist100.fast_info.last_price), 0)
        bist100_prev = round(float(bist100.fast_info.previous_close), 0)
        bist100_chg = round((bist100_price - bist100_prev) / bist100_prev * 100, 2) if bist100_prev else 0
        return (
            f"USD/TL: {usdtry_price} TL\n"
            f"BIST100: {bist100_price:,.0f} puan ({'+' if bist100_chg >= 0 else ''}{bist100_chg}% bugün)\n"
            f"Not: USD/TL yükseldikçe ihracatçı sektörler (otomotiv, demir-çelik) avantajlı, "
            f"ithalatçı ve borçlu sektörler (perakende, havacılık) dezavantajlı olur."
        )
    except Exception:
        return "Makro veri alınamadı — genel piyasa koşullarını değerlendirin."


def analyze_stock(
    symbol: str,
    name: str,
    sector: str,
    snapshot: dict,
    indicators: dict,
    last_rec_performance: str = "Henüz veri yok",
    accuracy_rate: float = 0.0,
    learning_notes: str = "Henüz öğrenme notu yok.",
    streak_info: str = "Veri yok",
) -> Optional[dict]:
    """
    Tek bir hisse için Gemini analizi yapar.
    Başarı durumunda öneri dict'i döner, hata durumunda None.
    """
    def fmt(val, decimals=2):
        return round(val, decimals) if val is not None else "N/A"

    # Teknik gösterge etiketleri — Gemini'nin yorumunu kolaylaştırır
    rsi = indicators.get("rsi_14") or 50
    rsi_label = "Aşırı Alım (dikkat)" if rsi > 70 else "Aşırı Satım (fırsat olabilir)" if rsi < 30 else "Nötr Bölge"

    macd_hist = indicators.get("macd_histogram") or 0
    macd_label = "Yükseliş Momentumu" if macd_hist > 0 else "Düşüş Momentumu"

    adx = indicators.get("adx") or 0
    adx_label = "Güçlü Trend" if adx > 25 else "Zayıf/Trendsiz Piyasa"

    vol_ratio = indicators.get("volume_ratio_20d") or 1
    volume_label = "Yüksek Hacim (güvenilir sinyal)" if vol_ratio > 1.5 else "Düşük Hacim (zayıf sinyal)" if vol_ratio < 0.7 else "Normal Hacim"

    price = snapshot.get("close") or 0
    ema20 = indicators.get("ema_20") or 0
    ema50 = indicators.get("ema_50") or 0
    if price and ema20 and ema50:
        if price > ema20 > ema50:
            ema_trend = "Güçlü Yükseliş (fiyat > EMA20 > EMA50)"
        elif price > ema20:
            ema_trend = "Kısa Vadeli Yükseliş (fiyat > EMA20)"
        elif price < ema20 < ema50:
            ema_trend = "Güçlü Düşüş (fiyat < EMA20 < EMA50)"
        else:
            ema_trend = "Karışık Sinyal"
    else:
        ema_trend = "N/A"

    bb_upper = indicators.get("bb_upper") or 0
    bb_lower = indicators.get("bb_lower") or 0
    bb_middle = indicators.get("bb_middle") or 0
    if price and bb_upper and bb_lower:
        bb_range = bb_upper - bb_lower
        if bb_range > 0:
            bb_pos = (price - bb_lower) / bb_range
            if bb_pos > 0.85:
                bb_position = "Üst Banda Yakın (aşırı alım riski)"
            elif bb_pos < 0.15:
                bb_position = "Alt Banda Yakın (aşırı satım, fırsat)"
            else:
                bb_position = f"Orta Bant Bölgesi (%{bb_pos*100:.0f})"
        else:
            bb_position = "N/A"
    else:
        bb_position = "N/A"

    # Sektöre özgü bağlam
    sector_context = SECTOR_CONTEXT.get(sector, DEFAULT_SECTOR_CONTEXT)

    # Makro bağlam
    macro_context = _get_macro_context()

    prompt = SCAN_PROMPT_TEMPLATE.format(
        symbol=symbol,
        name=name,
        sector=sector,
        macro_context=macro_context,
        sector_context=sector_context,
        current_price=fmt(snapshot.get("close")),
        change_1d=fmt(snapshot.get("change_pct")),
        change_1w=fmt(snapshot.get("performance_1w")),
        change_1m=fmt(snapshot.get("performance_1m")),
        change_3m=fmt(snapshot.get("performance_3m")),
        change_1y=fmt(snapshot.get("performance_1y")),
        rsi=fmt(indicators.get("rsi_14")),
        rsi_label=rsi_label,
        macd=fmt(indicators.get("macd")),
        macd_signal=fmt(indicators.get("macd_signal")),
        macd_histogram=fmt(indicators.get("macd_histogram")),
        macd_label=macd_label,
        stoch_k=fmt(indicators.get("stoch_k")),
        stoch_d=fmt(indicators.get("stoch_d")),
        bb_upper=fmt(indicators.get("bb_upper")),
        bb_middle=fmt(indicators.get("bb_middle")),
        bb_lower=fmt(indicators.get("bb_lower")),
        bb_position=bb_position,
        ema20=fmt(indicators.get("ema_20")),
        ema50=fmt(indicators.get("ema_50")),
        sma200=fmt(indicators.get("sma_200")),
        ema_trend=ema_trend,
        adx=fmt(indicators.get("adx")),
        adx_label=adx_label,
        atr=fmt(indicators.get("atr")),
        volume_ratio=fmt(indicators.get("volume_ratio_20d")),
        volume_label=volume_label,
        vwap=fmt(indicators.get("vwap")),
        high_52w=fmt(indicators.get("high_52w")),
        low_52w=fmt(indicators.get("low_52w")),
        fib_382=fmt(indicators.get("fib_382")),
        fib_500=fmt(indicators.get("fib_500")),
        fib_618=fmt(indicators.get("fib_618")),
        last_rec_performance=last_rec_performance,
        accuracy_rate=fmt(accuracy_rate, 1),
        streak_info=streak_info,
        learning_notes=learning_notes,
    )

    raw = _call_gemini(prompt)
    result = _parse_json_response(raw)

    if result is None:
        logger.error(f"{symbol}: Gemini analiz yanıtı parse edilemedi.")
        return None

    # Zorunlu alan kontrolü
    required = {"action", "confidence", "target_price", "stop_loss", "time_horizon", "reasoning"}
    missing = required - result.keys()
    if missing:
        logger.error(f"{symbol}: Gemini yanıtında eksik alanlar: {missing}")
        return None

    # action değerini normalize et
    result["action"] = result["action"].upper().strip()
    if result["action"] not in {"BUY", "SELL", "HOLD", "WATCH"}:
        logger.error(f"{symbol}: Geçersiz action değeri: {result['action']}")
        return None

    logger.info(f"{symbol}: {result['action']} (güven: {result['confidence']})")
    return result


# ── Haftalık Öz Değerlendirme ─────────────────────────────────────────────────

SELF_EVAL_PROMPT_TEMPLATE = """
Sen bir BIST30 yapay zeka yatırım danışmanısın. Son 30 günün öneri performansını değerlendir ve öğrenme notları üret.
Tüm yanıtlarını Türkçe ver.

Son 30 günün önerileri:
{performance_data}

Yalnızca aşağıdaki JSON yapısını döndür, başka hiçbir şey yazma:
{{
  "overall_accuracy": 0.0-1.0 arası float,
  "best_patterns": ["başarılı pattern1", "başarılı pattern2"],
  "worst_patterns": ["başarısız pattern1", "başarısız pattern2"],
  "learning_notes": "Öğrenilen dersler ve strateji güncellemesi (Türkçe, min 300 karakter)",
  "adjusted_weights": {{
    "rsi_weight": float,
    "macd_weight": float,
    "volume_weight": float,
    "trend_weight": float
  }},
  "market_regime": "trending_up" veya "trending_down" veya "ranging" veya "volatile"
}}
"""


def self_evaluate(performance_data: list[dict]) -> Optional[dict]:
    """
    Geçmiş öneri performansını Gemini'ye göndererek öz değerlendirme yaptırır.
    """
    if not performance_data:
        logger.warning("Öz değerlendirme için yeterli veri yok.")
        return None

    # Performans verisini okunabilir formata çevir
    lines = []
    for rec in performance_data:
        lines.append(
            f"- {rec.get('symbol','?')} | {rec.get('action','?')} | "
            f"Fiyat: {rec.get('price',0):.2f} TL | "
            f"Getiri: {rec.get('return_pct', 0):.2f}% | "
            f"Başarılı: {rec.get('is_successful', False)} | "
            f"Gerekçe özeti: {str(rec.get('reasoning',''))[:80]}"
        )
    performance_text = "\n".join(lines)

    prompt = SELF_EVAL_PROMPT_TEMPLATE.format(performance_data=performance_text)
    raw = _call_gemini(prompt)
    result = _parse_json_response(raw)

    if result is None:
        logger.error("Öz değerlendirme yanıtı parse edilemedi.")
        return None

    logger.info(f"Öz değerlendirme tamamlandı. Genel doğruluk: {result.get('overall_accuracy')}")
    return result


# ── Haber Özeti ───────────────────────────────────────────────────────────────

NEWS_SUMMARY_PROMPT = """
Aşağıdaki haber başlıklarını ve metinlerini Türkçe olarak 3-4 cümleyle özetle.
Yatırımcı perspektifinden pozitif/negatif etkiyi de belirt.

Hisse: {symbol} - {name}

Haberler:
{news_text}

Yalnızca özet metnini döndür, JSON değil.
"""


def summarize_news(symbol: str, name: str, news_items: list[str]) -> Optional[str]:
    """
    Haber başlıklarını Gemini ile Türkçe özetler.
    """
    if not news_items:
        return None
    news_text = "\n".join(f"- {item}" for item in news_items[:10])
    prompt = NEWS_SUMMARY_PROMPT.format(symbol=symbol, name=name, news_text=news_text)
    return _call_gemini(prompt)
