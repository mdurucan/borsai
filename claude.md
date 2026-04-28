# BIST30 AI Borsa Analiz ve Öneri Sistemi — CLAUDE.md

## Proje Özeti

Tam kapsamlı, ücretsiz, yapay zeka destekli bir BIST30 borsa takip ve öneri uygulaması geliştiriyoruz. Sistem; hisse senedi verilerini otomatik olarak çekecek, Gemini API ile analiz yapacak, kendi kendini eğiterek öğrenecek ve günde 3 kez belirlenen saatlerde (09:00, 13:00, 17:30) çalışacak.

---

## Tech Stack (Tamamı Ücretsiz)

- **Backend:** Python 3.11+ / FastAPI
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Veritabanı:** SQLite (geliştirme) → PostgreSQL uyumlu (üretim için)
- **ORM:** SQLAlchemy + Alembic
- **Zamanlayıcı:** APScheduler (Python)
- **Veri Kaynakları:** Yahoo Finance (`yfinance`) + BeautifulSoup (Google Finance scraping)
- **Yapay Zeka:** Google Gemini API (gemini-2.0-flash — ücretsiz tier)
- **Grafik:** Chart.js veya Recharts
- **Auth:** JWT tabanlı basit auth (opsiyonel, tek kullanıcı için)
- **Paket Yöneticisi:** pnpm (frontend), pip/uv (backend)

---

## Proje Klasör Yapısı

```
bist30-ai/
├── backend/
│   ├── main.py                  # FastAPI uygulama girişi
│   ├── scheduler.py             # APScheduler — günde 3 kez çalışır
│   ├── database.py              # SQLAlchemy setup
│   ├── models/
│   │   ├── stock.py             # Hisse modeli
│   │   ├── snapshot.py          # Günlük veri anlık görüntüsü
│   │   ├── recommendation.py    # AI öneri modeli
│   │   └── performance.py       # Öneri performans takibi
│   ├── services/
│   │   ├── data_fetcher.py      # Yahoo Finance + Google Finance
│   │   ├── gemini_service.py    # Gemini API entegrasyonu
│   │   ├── analyzer.py          # Teknik analiz hesaplamaları
│   │   ├── self_learner.py      # Kendi kendine öğrenme motoru
│   │   └── notifier.py          # (opsiyonel) bildirim servisi
│   ├── routers/
│   │   ├── stocks.py            # Hisse verileri endpoint'leri
│   │   ├── recommendations.py   # Öneri endpoint'leri
│   │   ├── performance.py       # Performans takip endpoint'leri
│   │   └── analysis.py          # AI analiz endpoint'leri
│   ├── utils/
│   │   ├── technical.py         # RSI, MACD, BB, vb. hesaplamaları
│   │   └── constants.py         # BIST30 hisse listesi ve sabitler
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Ana dashboard
│   │   │   ├── stocks/[symbol]/       # Hisse detay sayfası
│   │   │   ├── recommendations/       # Öneri geçmişi sayfası
│   │   │   ├── performance/           # Öneri performans sayfası
│   │   │   └── analysis/              # Canlı analiz sayfası
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── StockCard/
│   │   │   ├── PriceChart/
│   │   │   ├── RecommendationCard/
│   │   │   ├── PerformanceTracker/
│   │   │   ├── AIInsightPanel/
│   │   │   └── ScheduleStatus/
│   │   └── lib/
│   │       ├── api.ts
│   │       └── types.ts
│   ├── package.json
│   └── tailwind.config.ts
├── .env.example
└── README.md
```

---

## Veritabanı Şeması

### `stocks` tablosu
```sql
id, symbol (örn: "AKBNK.IS"), name, sector, market_cap, is_active, created_at
```

### `snapshots` tablosu (günde 3 kez doldurulur)
```sql
id, stock_id, timestamp, session (morning/noon/close),
open, high, low, close, volume, change_pct,
rsi_14, macd, macd_signal, bb_upper, bb_lower, bb_middle,
ema_20, ema_50, sma_200,
performance_1d, performance_1w, performance_1m, performance_3m, performance_1y,
foreign_net_flow, institutional_net_flow
```

### `recommendations` tablosu
```sql
id, stock_id, created_at, session,
action (BUY/SELL/HOLD/WATCH),
price_at_recommendation, target_price, stop_loss,
confidence_score (0-100), time_horizon (daily/weekly/monthly),
reasoning (TEXT — Gemini'nin gerekçesi),
technical_signals (JSON),
fundamental_signals (JSON),
sentiment_signals (JSON),
status (active/closed/expired)
```

### `recommendation_performance` tablosu
```sql
id, recommendation_id, evaluated_at,
price_at_evaluation, return_pct, is_successful,
days_held, max_gain_pct, max_loss_pct,
gemini_retrospective (TEXT — AI'ın öz değerlendirmesi)
```

### `ai_learning_log` tablosu
```sql
id, created_at, pattern_type, pattern_description,
success_rate, sample_size, confidence,
applied_to_stocks (JSON array)
```

---

## Backend Geliştirme Talimatları

### 1. BIST30 Hisse Listesi (constants.py)

```python
BIST30_SYMBOLS = [
    "AKBNK.IS", "ARCLK.IS", "ASELS.IS", "BIMAS.IS", "DOHOL.IS",
    "EKGYO.IS", "EREGL.IS", "FROTO.IS", "GARAN.IS", "GUBRF.IS",
    "HALKB.IS", "ISCTR.IS", "KCHOL.IS", "KONTR.IS", "KOZAA.IS",
    "KOZAL.IS", "KRDMD.IS", "MGROS.IS", "ODAS.IS", "OYAKC.IS",
    "PETKM.IS", "PGSUS.IS", "SAHOL.IS", "SASA.IS", "SISE.IS",
    "TAVHL.IS", "TCELL.IS", "THYAO.IS", "TKFEN.IS", "TOASO.IS",
    "TUPRS.IS", "TTKOM.IS", "VAKBN.IS", "YKBNK.IS", "SODA.IS"
]

SCHEDULE_TIMES = ["09:00", "13:00", "17:30"]  # Türkiye saati (UTC+3)
```

### 2. Veri Çekme Servisi (data_fetcher.py)

`yfinance` kullanarak her bir BIST30 hissesi için aşağıdaki verileri çek:

- Güncel fiyat, hacim, gün içi high/low/open
- 1 günlük, 1 haftalık, 1 aylık, 3 aylık, 1 yıllık getiri (%)
- 1 yıllık OHLCV geçmişi (teknik analiz için)
- Piyasa değeri, F/K oranı, PD/DD (mevcut ise)

Hata toleransı: Herhangi bir hisse için veri çekilemezse logla ve devam et, sistemi durdurma.

### 3. Teknik Analiz (technical.py + analyzer.py)

Her snapshot için hesapla:

**Momentum:**
- RSI (14 periyot)
- MACD (12, 26, 9)
- Stochastic Oscillator (%K, %D)

**Trend:**
- EMA 20, EMA 50, SMA 200
- ADX (Average Directional Index)

**Volatilite:**
- Bollinger Bands (20, 2)
- ATR (Average True Range)

**Hacim:**
- OBV (On Balance Volume)
- VWAP (günlük)
- Hacim ortalaması (20 günlük)

**Destek/Direnç:**
- Son 52 hafta yüksek/düşük
- Fibonacci retracement seviyeleri (son büyük swing'den)
- Kritik fiyat seviyeleri tespiti

### 4. Gemini AI Servisi (gemini_service.py)

**Model:** `gemini-2.0-flash` (ücretsiz tier yeterli)

**Analiz Promptu — Günlük Tarama:**
```
Sen deneyimli bir Borsa İstanbul uzmanısın. BIST30 hisselerini analiz edip yatırım önerileri üretiyorsun.

Aşağıdaki hisse verileri için kapsamlı bir analiz yap:

HISSE: {symbol} - {name}
SEKTÖR: {sector}

=== FIYAT VERİLERİ ===
Güncel Fiyat: {current_price} TL
Günlük Değişim: {change_1d}%
Haftalık: {change_1w}%
Aylık: {change_1m}%
Çeyreklik: {change_3m}%
Yıllık: {change_1y}%

=== TEKNİK ANALİZ ===
RSI(14): {rsi}
MACD: {macd} | Signal: {macd_signal}
BB: Üst {bb_upper} | Orta {bb_middle} | Alt {bb_lower}
EMA20: {ema20} | EMA50: {ema50} | SMA200: {sma200}
ADX: {adx}
Hacim vs 20g Ort: {volume_ratio}x

=== PERFORMANS GEÇMİŞİ ===
Son önerimizin başarısı: {last_rec_performance}
Bu hissede doğru tahmin oranı: {accuracy_rate}%

=== ÖĞRENME NOTLARI ===
{self_learning_notes}

Şu yapıyı kullanarak JSON döndür:
{
  "action": "BUY" | "SELL" | "HOLD" | "WATCH",
  "confidence": 0-100,
  "target_price": float,
  "stop_loss": float,
  "time_horizon": "daily" | "weekly" | "monthly",
  "reasoning": "Türkçe detaylı gerekçe (min 200 karakter)",
  "key_signals": ["sinyal1", "sinyal2", "sinyal3"],
  "risks": ["risk1", "risk2"],
  "sector_outlook": "Sektör genel değerlendirmesi",
  "bist30_relative": "BIST30'a göre relatif güç değerlendirmesi"
}
```

**Öz Değerlendirme Promptu (Haftada 1 kez):**
```
BIST30 Uzmanı olarak geçmiş öneri performansını değerlendir ve öğrenme notları üret.

Son 30 günün önerileri:
{performance_data}

JSON formatında yanıt ver:
{
  "overall_accuracy": float,
  "best_patterns": ["başarılı pattern1", "başarılı pattern2"],
  "worst_patterns": ["başarısız pattern1", "başarısız pattern2"],
  "learning_notes": "Öğrenilen dersler ve strateji güncellemesi (Türkçe)",
  "adjusted_weights": {
    "rsi_weight": float,
    "macd_weight": float,
    "volume_weight": float,
    "trend_weight": float
  },
  "market_regime": "trending_up | trending_down | ranging | volatile"
}
```

### 5. Self-Learning Motoru (self_learner.py)

**Öğrenme Döngüsü:**

1. Her kapanışta aktif önerilerin performansını güncelle
2. 7 günde bir öz değerlendirme yaptır
3. Başarılı/başarısız pattern'leri `ai_learning_log`'a kaydet
4. Sonraki analizlerde bu notları context olarak Gemini'ye ver
5. Hisse bazında doğruluk oranı tut ve düşük başarılı hisseler için eşik yükselt

**Değerlendirme Kriterleri:**
- BUY önerisi: Öneri sonrası 5 iş günü içinde %2+ artış → Başarılı
- SELL önerisi: Öneri sonrası 5 iş günü içinde %2+ düşüş → Başarılı
- WATCH önerisi: Yön doğru tahmin edilmiş mi → Başarılı
- Hedef fiyata ulaşıldı mı, stop-loss tetiklendi mi takip et

### 6. Zamanlayıcı (scheduler.py)

```python
# APScheduler ile cron tabanlı
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler(timezone="Europe/Istanbul")

# Sabah seansı — piyasa açılışı
scheduler.add_job(morning_scan, 'cron', hour=9, minute=0, 
                  day_of_week='mon-fri')

# Öğlen değerlendirme
scheduler.add_job(noon_scan, 'cron', hour=13, minute=0,
                  day_of_week='mon-fri')

# Kapanış analizi
scheduler.add_job(closing_scan, 'cron', hour=17, minute=30,
                  day_of_week='mon-fri')

# Haftalık öz değerlendirme
scheduler.add_job(self_evaluation, 'cron', 
                  day_of_week='fri', hour=18, minute=0)
```

Her tarama şunları yapar:
1. Tüm BIST30 hisselerinin verisini çek
2. Teknik göstergeleri hesapla
3. Snapshot'u kaydet
4. Güven skoru 70+ olanlar için Gemini analizi yaptır
5. Aktif önerilerin performansını güncelle
6. API endpoint'lerini tetikle

---

## Frontend Geliştirme Talimatları

### Tasarım Kimliği

**Stil:** Premium finans / Bloomberg Terminal inspired — koyu tema, keskin kontrast, professional
**Renk Paleti:**
- Ana arkaplan: `#0A0E1A` (derin lacivert)
- Kart arkaplanı: `#111827`
- Vurgu (yeşil — alış): `#00D4A8`
- Vurgu (kırmızı — satış): `#FF4560`
- Nötr: `#6B7280`
- Metin: `#F9FAFB`
- Sınırlar: `#1F2937`

**Font:** JetBrains Mono (sayılar için) + Inter (metin için)

### Sayfa 1: Ana Dashboard (`/`)

**Layout:** Sol sidebar + ana içerik alanı

**Sol Sidebar:**
- BIST30 hisse listesi
- Her hisse için: Sembol, fiyat, günlük % değişim (kırmızı/yeşil badge)
- Aktif öneri varsa AI ikonu
- Arama / filtre
- Sektör filtresi

**Ana İçerik:**
- **Header:** BIST30 Endeks özeti + BİST genel görünüm + son tarama saati
- **AI Insights Banner:** Günün en güçlü 3 önerisi (BUY/SELL) büyük kartlar
- **Son Tarama Özeti:** Sabah/öğlen/kapanış tarama durumu (yeşil tik veya saat)
- **Performans Özeti:** Bu haftaki öneri başarı oranı gauge chart
- **Sektor Heatmap:** BIST30 hisselerini sektöre göre renk kodlu ızgara
- **Aktif Öneriler Tablosu:** Açık pozisyonlar, hedef, stop-loss, anlık P&L

### Sayfa 2: Hisse Detay (`/stocks/[symbol]`)

- **Header:** Hisse adı, fiyat, tüm zaman dilimleri performans (1g, 1h, 1a, 3a, 1y)
- **Fiyat Grafiği:** Candlestick + hacim + teknik göstergeler overlay (RSI, MACD, BB)
  - Zaman dilimi seçici: 1G / 1H / 1A / 3A / 1Y
  - Öneri noktaları grafik üzerinde işaretli (yeşil yukarı ok = BUY, kırmızı = SELL)
- **Teknik Gösterge Paneli:** RSI gauge, MACD histogram, BB pozisyonu
- **AI Analiz Geçmişi:** Bu hisse için yapılan tüm öneriler + gerçekleşen sonuç
- **Hisse Skoru:** Teknik (40%) + Momentum (30%) + Yapay Zeka Güven (30%) toplam skor
- **Son Haberler Özeti:** Yahoo Finance haberlerini çekip Gemini ile Türkçe özetle

### Sayfa 3: Öneri Geçmişi (`/recommendations`)

Tablo görünümü:
```
Tarih | Saat | Hisse | İşlem | Fiyat | Hedef | Stop | Güven% | Süre | Durum | Sonuç%
```

- Filtreler: Tarih aralığı / Hisse / İşlem tipi / Başarılı/Başarısız / Aktif
- Her satıra tıklandığında drawer açılır: Tam Gemini gerekçesi + teknik sinyaller
- "Şu tarihte bunu şu sebeple önerdim ve bu önerim %X oranında tuttu" çıktısı

### Sayfa 4: Performans Analizi (`/performance`)

- **Genel Başarı Oranı:** Tüm zamanlar + son 30 gün (büyük daire grafik)
- **Hisse Bazında Başarı:** Bar chart — hangi hissede ne kadar isabetliyiz
- **İşlem Tipi Analizi:** BUY / SELL / HOLD — hangisi daha başarılı
- **Zaman Dönemi Analizi:** Sabah / Öğlen / Kapanış öneri başarı karşılaştırması
- **Kümülatif Getiri Simülasyonu:** Tüm önerilere eşit sermaye koyulmuş olsaydı grafiği
- **En İyi / En Kötü Öneriler:** Top 10 kazandıran / kaybettiren

### Sayfa 5: AI Öğrenme Merkezi (`/learning`)

- **AI'ın Öz Değerlendirme Geçmişi:** Her haftalık değerlendirme özeti
- **Öğrenilen Patternler:** Başarılı ve başarısız pattern'lerin listesi
- **Strateji Evrimi:** Ağırlık değişimlerini zaman içinde gösteren grafik
- **Piyasa Rejimine Göre Performans:** Yükselen / düşen / yatay piyasalarda başarı

### Sayfa 6: Tarama Durumu (Live) — Dashboard widget

- Son 3 taramanın detayları (kaç hisse tarandı, kaç öneri üretildi, kaç dakika sürdü)
- Sonraki taramaya kalan süre — countdown timer
- Manuel "Şimdi Tara" butonu (Gemini API rate limit kontrolüyle)

---

## API Endpoint'leri

```
GET  /api/stocks                          # Tüm BIST30 hisseleri listesi
GET  /api/stocks/{symbol}                 # Hisse detayı
GET  /api/stocks/{symbol}/history         # OHLCV geçmişi (query: period)
GET  /api/stocks/{symbol}/snapshots       # Günlük snapshot'lar
GET  /api/stocks/{symbol}/recommendations # Hisse önerileri

GET  /api/recommendations                 # Tüm öneriler (filtreli)
GET  /api/recommendations/active          # Aktif açık öneriler
GET  /api/recommendations/{id}            # Tek öneri detayı
POST /api/recommendations/{id}/close      # Manuel kapat

GET  /api/performance/summary             # Genel başarı istatistikleri
GET  /api/performance/by-stock            # Hisse bazında performans
GET  /api/performance/by-session          # Seans bazında performans
GET  /api/performance/cumulative          # Kümülatif getiri simülasyonu

GET  /api/learning/logs                   # AI öğrenme kayıtları
GET  /api/learning/patterns               # Tespit edilen patternler

POST /api/scanner/run                     # Manuel tarama tetikle
GET  /api/scanner/status                  # Tarama durumu ve zamanlama
GET  /api/scanner/history                 # Tarama geçmişi

GET  /api/market/overview                 # BIST30 genel görünüm
GET  /api/market/heatmap                  # Sektör heatmap verisi
```

---

## Ortam Değişkenleri (.env)

```env
# Gemini API (ücretsiz)
GEMINI_API_KEY=your_gemini_api_key_here

# Uygulama
DATABASE_URL=sqlite:///./bist30.db
BACKEND_PORT=8000
FRONTEND_PORT=3000
SECRET_KEY=your_secret_key_here

# Tarama ayarları
SCAN_TIMES=09:00,13:00,17:30
TIMEZONE=Europe/Istanbul
MIN_CONFIDENCE_THRESHOLD=65
GEMINI_RATE_LIMIT_PER_MIN=14  # Ücretsiz tier limiti

# Öğrenme parametreleri
SUCCESS_THRESHOLD_PCT=2.0
EVALUATION_DAYS=5
SELF_EVAL_FREQUENCY_DAYS=7
```

---

## Kurulum ve Başlatma Komutları

```bash
# Backend
cd backend
pip install fastapi uvicorn sqlalchemy alembic yfinance \
  google-generativeai apscheduler pandas numpy \
  pandas-ta requests beautifulsoup4 python-dotenv

alembic init alembic
alembic revision --autogenerate -m "initial"
alembic upgrade head

uvicorn main:app --reload --port 8000

# Frontend
cd frontend
pnpm create next-app . --typescript --tailwind --app
pnpm add recharts axios date-fns lucide-react @radix-ui/react-dialog

pnpm dev
```

---

## Önemli Geliştirme Notları

1. **Rate Limiting:** Gemini ücretsiz tier dakikada 15 istek. Her taramada tüm 30 hisseyi analiz etme — güven skoru 70+ olanları önce al, kalan kotayla diğerlerini analiz et.

2. **Borsa Tatilleri:** `pandas_market_calendars` veya manuel BIST tatil listesi kullanarak hafta sonu ve resmi tatillerde zamanlayıcıyı durdur.

3. **Veri Güvenilirliği:** Yahoo Finance zaman zaman geciktirir. Her snapshot için `fetched_at` ve `data_delay_seconds` kaydet.

4. **İlk Kurulum:** İlk çalıştırmada 1 yıllık geçmiş veri çekilerek teknik analizler ısındırılır (warm-up period).

5. **Self-learning Başlangıcı:** İlk 14 gün öğrenme modu — öneri üretilir ama "simüle" olarak işaretlenir, performans takip edilir ama gösterimde ayrı tutulur.

6. **Türkçe AI Çıktıları:** Tüm Gemini promptlarında "Türkçe yanıt ver" talimatı ver.

7. **Google Finance Scraping:** Yahoo Finance'a ek olarak BeautifulSoup ile Google Finance'tan haber başlıklarını ve analist görüşlerini çek, bunları sentiment input olarak Gemini'ye ver.

8. **Chart Library:** Candlestick grafik için `lightweight-charts` (TradingView'in açık kaynak kütüphanesi — ücretsiz) kullan.

9. **Error Boundary:** Tüm AI analiz adımlarını try/except içinde çalıştır. Gemini hatası durumunda sadece teknik analiz skoru ile öneri üret, Gemini olmadan da sistem çalışmaya devam etsin.

10. **Logging:** Her tarama için detaylı log dosyası tut: `logs/scan_YYYYMMDD_HHMM.log`
```

---

## Başlangıç Geliştirme Sırası

1. `database.py` + tüm modeller
2. `constants.py` — BIST30 listesi
3. `data_fetcher.py` — yfinance entegrasyonu + test
4. `technical.py` — gösterge hesaplamaları + test
5. `gemini_service.py` — API bağlantısı + prompt test
6. `scheduler.py` — zamanlayıcı kurulumu
7. `self_learner.py` — performans değerlendirme
8. FastAPI routers + CORS
9. Frontend — Next.js kurulumu
10. Dashboard sayfası — hisse listesi + AI insights
11. Hisse detay sayfası + grafikler
12. Öneri geçmişi ve performans sayfaları
13. AI Öğrenme Merkezi
14. Son testler + README
```