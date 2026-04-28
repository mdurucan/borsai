BIST30_SYMBOLS = [
    "AKBNK.IS", "ARCLK.IS", "ASELS.IS", "BIMAS.IS", "DOHOL.IS",
    "EKGYO.IS", "EREGL.IS", "FROTO.IS", "GARAN.IS", "GUBRF.IS",
    "HALKB.IS", "ISCTR.IS", "KCHOL.IS", "KONTR.IS",
    "KRDMD.IS", "MGROS.IS", "ODAS.IS", "OYAKC.IS",
    "PETKM.IS", "PGSUS.IS", "SAHOL.IS", "SASA.IS", "SISE.IS",
    "TAVHL.IS", "TCELL.IS", "THYAO.IS", "TKFEN.IS", "TOASO.IS",
    "TUPRS.IS", "TTKOM.IS", "VAKBN.IS", "YKBNK.IS",
    # KOZAA.IS, KOZAL.IS, SODA.IS — Yahoo Finance'da veri yok (geçici/kalıcı)
]

STOCK_META = {
    "AKBNK.IS": {"name": "Akbank T.A.Ş.", "sector": "Bankacılık"},
    "ARCLK.IS": {"name": "Arçelik A.Ş.", "sector": "Dayanıklı Tüketim"},
    "ASELS.IS": {"name": "Aselsan Elektronik", "sector": "Savunma & Teknoloji"},
    "BIMAS.IS": {"name": "BİM Birleşik Mağazalar", "sector": "Perakende"},
    "DOHOL.IS": {"name": "Doğan Holding", "sector": "Holding"},
    "EKGYO.IS": {"name": "Emlak Konut GYO", "sector": "Gayrimenkul"},
    "EREGL.IS": {"name": "Ereğli Demir Çelik", "sector": "Demir & Çelik"},
    "FROTO.IS": {"name": "Ford Otomotiv", "sector": "Otomotiv"},
    "GARAN.IS": {"name": "Garanti BBVA", "sector": "Bankacılık"},
    "GUBRF.IS": {"name": "Gübre Fabrikaları", "sector": "Kimya & Gübre"},
    "HALKB.IS": {"name": "Halkbank", "sector": "Bankacılık"},
    "ISCTR.IS": {"name": "İş Bankası (C)", "sector": "Bankacılık"},
    "KCHOL.IS": {"name": "Koç Holding", "sector": "Holding"},
    "KONTR.IS": {"name": "Kontrolmatik Teknoloji", "sector": "Teknoloji"},
    # "KOZAA.IS": {"name": "Koza Anadolu Metal", "sector": "Madencilik"},      # Yahoo Finance veri yok
    # "KOZAL.IS": {"name": "Koza Altın İşletmeleri", "sector": "Madencilik"},  # Yahoo Finance veri yok
    "KRDMD.IS": {"name": "Kardemir (D)", "sector": "Demir & Çelik"},
    "MGROS.IS": {"name": "Migros Ticaret", "sector": "Perakende"},
    "ODAS.IS": {"name": "Odaş Elektrik", "sector": "Enerji"},
    "OYAKC.IS": {"name": "Oyak Çimento", "sector": "Çimento"},
    "PETKM.IS": {"name": "Petkim Petrokimya", "sector": "Petrokimya"},
    "PGSUS.IS": {"name": "Pegasus Hava Taşımacılığı", "sector": "Havacılık"},
    "SAHOL.IS": {"name": "Sabancı Holding", "sector": "Holding"},
    "SASA.IS": {"name": "SASA Polyester", "sector": "Tekstil & Kimya"},
    "SISE.IS": {"name": "Şişe Cam", "sector": "Cam & Ambalaj"},
    "TAVHL.IS": {"name": "TAV Havalimanları", "sector": "Havacılık"},
    "TCELL.IS": {"name": "Turkcell", "sector": "Telekomünikasyon"},
    "THYAO.IS": {"name": "Türk Hava Yolları", "sector": "Havacılık"},
    "TKFEN.IS": {"name": "Tekfen Holding", "sector": "Holding & İnşaat"},
    "TOASO.IS": {"name": "Tofaş Türk Otomobil", "sector": "Otomotiv"},
    "TUPRS.IS": {"name": "Tüpraş", "sector": "Enerji & Petrol"},
    "TTKOM.IS": {"name": "Türk Telekom", "sector": "Telekomünikasyon"},
    "VAKBN.IS": {"name": "Vakıfbank", "sector": "Bankacılık"},
    "YKBNK.IS": {"name": "Yapı Kredi Bankası", "sector": "Bankacılık"},
    # "SODA.IS": {"name": "Soda Sanayii", "sector": "Kimya"},  # Yahoo Finance veri yok
}

SCHEDULE_TIMES = ["09:00", "13:00", "17:30"]  # Türkiye saati (UTC+3)

SESSION_MAP = {
    "09:00": "morning",
    "13:00": "noon",
    "17:30": "close",
}

# Teknik analiz parametreleri
RSI_PERIOD = 14
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
BB_PERIOD = 20
BB_STD = 2
EMA_SHORT = 20
EMA_LONG = 50
SMA_LONG = 200
ATR_PERIOD = 14
ADX_PERIOD = 14
STOCH_K = 14
STOCH_D = 3
OBV_PERIOD = 20

# Self-learning parametreleri
SUCCESS_THRESHOLD_PCT = 2.0   # BUY/SELL için başarı eşiği
EVALUATION_DAYS = 5           # İş günü cinsinden değerlendirme penceresi
SIMULATION_DAYS = 0           # Simülasyon modu kapalı — tüm öneriler active
MIN_CONFIDENCE = 60           # Gemini analizi için minimum güven skoru
GEMINI_RATE_LIMIT = 14        # Dakikada maksimum Gemini isteği

# Pre-score ağırlıkları — self-evaluation sonrası dinamik güncellenir
DEFAULT_WEIGHTS = {
    "rsi_weight":    0.5,
    "macd_weight":   3.0,
    "volume_weight": 15.0,
    "trend_weight":  0.5,
}
