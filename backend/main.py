import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import create_tables
from scheduler import start_scheduler, stop_scheduler
from routers import stocks, recommendations, performance, scanner, learning, market, notifications

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Başlangıç
    logger.info("Uygulama başlatılıyor...")
    create_tables()
    start_scheduler()
    logger.info("Uygulama hazır.")
    yield
    # Kapanış
    stop_scheduler()
    logger.info("Uygulama kapatıldı.")


app = FastAPI(
    title="BIST30 AI Borsa Analiz Sistemi",
    description="Gemini destekli otomatik BIST30 tarama ve öneri API'si",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — Next.js frontend'e izin ver
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router'ları kaydet
app.include_router(stocks.router)
app.include_router(recommendations.router)
app.include_router(performance.router)
app.include_router(scanner.router)
app.include_router(notifications.router)
app.include_router(learning.router)
app.include_router(market.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "BIST30 AI API", "version": "1.0.0"}


@app.get("/health")
def health():
    from scheduler import get_scheduler_status
    return {
        "status": "ok",
        "scheduler": get_scheduler_status(),
    }


@app.get("/debug/yfinance")
def debug_yfinance():
    """Veri çekme bağlantı testi — geliştirme amaçlı."""
    import traceback
    from services.data_fetcher import fetch_stock_info, fetch_history
    results = {}
    for sym in ["AKBNK.IS", "THYAO.IS"]:
        try:
            info = fetch_stock_info(sym)
            if info:
                results[sym] = {"ok": True, "price": info.get("close"), "change_pct": info.get("change_pct")}
            else:
                results[sym] = {"ok": False, "error": "fetch_stock_info None döndü"}
        except Exception as e:
            results[sym] = {"ok": False, "error": str(e), "trace": traceback.format_exc()[-500:]}
    return results
