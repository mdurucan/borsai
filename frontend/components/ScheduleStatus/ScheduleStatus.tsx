"use client";
import { useEffect, useState } from "react";
import { Clock, Play, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { getScannerStatus, triggerScan, getScanHistory } from "@/lib/api";
import type { SchedulerStatus } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

interface ScanLog {
  id: number;
  session: string;
  started_at: string;
  finished_at: string | null;
  scanned: number;
  recommendations: number;
  errors: number;
  success: boolean;
  note: string | null;
  duration_sec: number | null;
}

const SESSION_LABELS: Record<string, string> = {
  morning:        "Sabah 09:00",
  noon:           "Öğlen 13:00",
  close:          "Kapanış 17:30",
  manual:         "Manuel",
  banking_agent:  "Bankacılık Ajanı",
  self_evaluation:"Öz Değerlendirme",
};

const JOB_LABELS: Record<string, string> = {
  morning_scan:        "Sabah 09:00",
  noon_scan:           "Öğlen 13:00",
  closing_scan:        "Kapanış 17:30",
  self_evaluation:     "Cuma 18:00",
  banking_agent_morning: "Bankacılık 09:15",
  banking_agent_close:   "Bankacılık 17:45",
};

export default function ScheduleStatus() {
  const [status, setStatus]   = useState<SchedulerStatus | null>(null);
  const [history, setHistory] = useState<ScanLog[]>([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    getScannerStatus().then(setStatus).catch(console.error);
    getScanHistory(20).then((d) => setHistory(d as ScanLog[])).catch(console.error);
    const id = setInterval(() => {
      getScannerStatus().then(setStatus).catch(console.error);
      getScanHistory(20).then((d) => setHistory(d as ScanLog[])).catch(console.error);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleManualScan() {
    setScanning(true);
    setMessage(null);
    try {
      const result = await triggerScan("manual");
      setMessage(result.message ?? "Tarama başlatıldı.");
      // 10sn sonra history güncelle
      setTimeout(() => {
        getScanHistory(10).then((d) => setHistory(d as ScanLog[])).catch(console.error);
      }, 10_000);
    } catch {
      setMessage("Tarama başlatılamadı.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      {/* Başlık + durum */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} className="text-[var(--accent-green)]" />
          Zamanlayıcı
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
          status?.running
            ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
            : "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
        }`}>
          {status?.running ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
          {status?.running ? "Aktif" : "Pasif"}
        </span>
      </div>

      {/* Sonraki çalışma zamanları */}
      <div className="flex flex-col gap-1">
        {status?.jobs.map((job) => (
          <div key={job.id} className="flex justify-between text-xs">
            <span className="text-[var(--text-muted)]">{JOB_LABELS[job.id] ?? job.id}</span>
            <span className="font-mono text-[var(--text-primary)]">
              {job.next_run ? fmtDate(job.next_run) : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Manuel tarama butonu */}
      <button
        onClick={handleManualScan}
        disabled={scanning}
        className="flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors
          bg-[var(--accent-green)]/10 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/20
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play size={12} />
        {scanning ? "Taranıyor..." : "Şimdi Tara"}
      </button>

      {message && (
        <p className="text-xs text-[var(--text-muted)] text-center">{message}</p>
      )}

      {/* Geçmiş taramalar */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center justify-between w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span>Son Taramalar ({Math.min(history.length, 5)})</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showHistory && (
            <div className="mt-2 flex flex-col gap-1.5">
              {history.slice(0, 5).map((log) => (
                <div key={log.id} className={`rounded-lg px-3 py-2 border text-xs ${
                  log.success
                    ? "border-[var(--accent-green)]/20 bg-[var(--accent-green)]/5"
                    : "border-[var(--accent-red)]/20 bg-[var(--accent-red)]/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {SESSION_LABELS[log.session] ?? log.session}
                    </span>
                    <span className={`font-mono text-[10px] ${log.success ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                      {log.success ? "✓ Başarılı" : "✗ Hata"}
                    </span>
                  </div>
                  <div className="text-[var(--text-muted)] mt-0.5">
                    {fmtDate(log.started_at)}
                    {log.duration_sec != null && ` · ${log.duration_sec}sn`}
                  </div>
                  {log.success && (
                    <div className="text-[var(--text-muted)] font-mono mt-0.5">
                      {log.scanned} hisse · {log.recommendations} öneri · {log.errors} hata
                    </div>
                  )}
                  {!log.success && log.note && (
                    <div className="text-[var(--accent-red)] mt-0.5 truncate">{log.note}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length === 0 && (
        <p className="text-[10px] text-[var(--text-muted)] text-center">Henüz tarama yapılmadı.</p>
      )}
    </div>
  );
}
