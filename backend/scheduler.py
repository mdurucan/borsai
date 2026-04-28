"""
APScheduler — hafta içi günde 3 kez tarama + haftalık öz değerlendirme.
"""
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, EVENT_JOB_MISSED
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


# ── Job fonksiyonları ──────────────────────────────────────────────────────────

def _run_and_log(session_name: str, fn):
    """Job'ı çalıştırıp başlangıç/bitiş/sonucu DB'ye kaydeder."""
    from datetime import datetime, timezone
    from database import SessionLocal
    from models.scan_log import ScanLog

    db = SessionLocal()
    log = ScanLog(session=session_name, started_at=datetime.now(timezone.utc))
    db.add(log)
    db.commit()
    db.refresh(log)
    try:
        result = fn()
        log.finished_at = datetime.now(timezone.utc)
        log.success = True
        if isinstance(result, dict):
            log.scanned = result.get("scanned", 0)
            log.recommendations = result.get("recommendations", 0)
            log.errors = result.get("errors", 0)
    except Exception as e:
        log.finished_at = datetime.now(timezone.utc)
        log.success = False
        log.note = str(e)[:300]
        logger.error(f"Job '{session_name}' hatayla tamamlandı: {e}")
    finally:
        db.add(log)
        db.commit()
        db.close()


def morning_scan():
    from services.analyzer import run_scan
    logger.info("Sabah seansı taraması başlatıldı.")
    _run_and_log("morning", lambda: run_scan("morning"))


def noon_scan():
    from services.analyzer import run_scan
    logger.info("Öğlen seansı taraması başlatıldı.")
    _run_and_log("noon", lambda: run_scan("noon"))


def closing_scan():
    from services.analyzer import run_scan
    logger.info("Kapanış seansı taraması başlatıldı.")
    _run_and_log("close", lambda: run_scan("close"))


def self_evaluation():
    from services.self_learner import run_self_evaluation
    logger.info("Haftalık öz değerlendirme başlatıldı.")
    _run_and_log("self_evaluation", run_self_evaluation)


def banking_agent_job():
    from services.banking_agent import run_banking_agent
    logger.info("Bankacılık Ajanı başlatıldı.")
    _run_and_log("banking_agent", run_banking_agent)


# ── Event listener ─────────────────────────────────────────────────────────────

def _job_listener(event):
    if event.exception:
        logger.error(f"Job '{event.job_id}' hatayla tamamlandı: {event.exception}")
    elif hasattr(event, 'job_id') and not hasattr(event, 'exception'):
        logger.info(f"Job '{event.job_id}' başarıyla tamamlandı.")


def _misfire_listener(event):
    """Kaçırılan job'ları yakalar ve yeniden tetikler."""
    import threading
    job_id = event.job_id
    logger.warning(f"Job '{job_id}' kaçırıldı — yeniden tetikleniyor.")

    job_map = {
        "morning_scan":        morning_scan,
        "noon_scan":           noon_scan,
        "closing_scan":        closing_scan,
        "self_evaluation":     self_evaluation,
        "banking_agent_morning": banking_agent_job,
        "banking_agent_close":   banking_agent_job,
    }
    fn = job_map.get(job_id)
    if fn:
        threading.Thread(target=fn, daemon=True).start()


# ── Scheduler başlatma / durdurma ─────────────────────────────────────────────

def start_scheduler():
    global _scheduler

    tz = os.getenv("TIMEZONE", "Europe/Istanbul")

    _scheduler = BackgroundScheduler(timezone=tz)
    _scheduler.add_listener(_job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
    _scheduler.add_listener(_misfire_listener, EVENT_JOB_MISSED)

    # Hafta içi taramalar
    _scheduler.add_job(
        morning_scan, "cron",
        id="morning_scan",
        hour=9, minute=0,
        day_of_week="mon-fri",
        misfire_grace_time=300,
    )
    _scheduler.add_job(
        noon_scan, "cron",
        id="noon_scan",
        hour=13, minute=0,
        day_of_week="mon-fri",
        misfire_grace_time=300,
    )
    _scheduler.add_job(
        closing_scan, "cron",
        id="closing_scan",
        hour=17, minute=30,
        day_of_week="mon-fri",
        misfire_grace_time=300,
    )

    # Haftalık öz değerlendirme — Cuma kapanış sonrası
    _scheduler.add_job(
        self_evaluation, "cron",
        id="self_evaluation",
        day_of_week="fri",
        hour=18, minute=0,
        misfire_grace_time=600,
    )

    # Bankacılık Ajanı — sabah açılışı + kapanış sonrası
    _scheduler.add_job(
        banking_agent_job, "cron",
        id="banking_agent_morning",
        hour=9, minute=15,
        day_of_week="mon-fri",
        misfire_grace_time=300,
    )
    _scheduler.add_job(
        banking_agent_job, "cron",
        id="banking_agent_close",
        hour=17, minute=45,
        day_of_week="mon-fri",
        misfire_grace_time=300,
    )

    _scheduler.start()
    logger.info(f"Scheduler başlatıldı. Timezone: {tz}")

    _log_next_runs()
    _catchup_missed_scans()


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler durduruldu.")


def get_scheduler_status() -> dict:
    """API endpoint'i için zamanlayıcı durumunu döner."""
    if not _scheduler or not _scheduler.running:
        return {"running": False, "jobs": []}

    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })
    return {"running": True, "jobs": jobs}


def trigger_manual_scan(session_name: str = "manual") -> dict:
    """Manuel tarama tetikler — API'den çağrılır."""
    from services.analyzer import run_scan
    logger.info(f"Manuel tarama tetiklendi: {session_name}")
    return run_scan(session_name)


def _log_next_runs():
    if not _scheduler:
        return
    for job in _scheduler.get_jobs():
        logger.info(f"  [{job.id}] Sonraki çalışma: {job.next_run_time}")


def _catchup_missed_scans():
    """
    Backend başladığında bugün çalışması gereken ama kaçırılan taramaları tetikler.
    Hafta içi, piyasa saatleri içindeyse ilgili seansı çalıştırır.
    """
    import threading
    from datetime import datetime
    import pytz

    tz = pytz.timezone("Europe/Istanbul")
    now = datetime.now(tz)

    # Sadece hafta içi
    if now.weekday() >= 5:
        return

    hour = now.hour
    minute = now.minute
    current_minutes = hour * 60 + minute

    # Seans zamanları ve grace period (dakika)
    sessions = [
        ("morning", 9 * 60,      morning_scan),
        ("noon",    13 * 60,     noon_scan),
        ("close",   17 * 60 + 30, closing_scan),
    ]

    from database import SessionLocal
    from models.scan_log import ScanLog
    from sqlalchemy import func

    db = SessionLocal()
    try:
        for session_name, scheduled_minutes, fn in sessions:
            # Seans zamanı geçmiş mi ve 90 dakika içinde mi?
            if not (scheduled_minutes <= current_minutes <= scheduled_minutes + 90):
                continue

            # Bugün bu seans zaten çalışmış mı?
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            ran_today = (
                db.query(ScanLog)
                .filter(ScanLog.session == session_name)
                .filter(ScanLog.started_at >= today_start.astimezone(pytz.utc).replace(tzinfo=None))
                .first()
            )
            if not ran_today:
                logger.warning(f"Catchup: '{session_name}' bugün çalışmamış, şimdi tetikleniyor.")
                threading.Thread(target=fn, daemon=True).start()
    finally:
        db.close()
