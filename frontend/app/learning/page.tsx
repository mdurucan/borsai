"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, CheckCircle, XCircle, Cpu } from "lucide-react";
import Sidebar from "@/components/Sidebar/Sidebar";
import { getLearningLogs, getLatestEvaluation } from "@/lib/api";
import type { LearningLog } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

const REGIME_LABELS: Record<string, { label: string; color: string }> = {
  trending_up:   { label: "Yükselen Trend",  color: "text-[var(--accent-green)]" },
  trending_down: { label: "Düşen Trend",     color: "text-[var(--accent-red)]" },
  ranging:       { label: "Yatay Piyasa",    color: "text-yellow-400" },
  volatile:      { label: "Volatil Piyasa",  color: "text-orange-400" },
};

export default function LearningPage() {
  const [logs, setLogs]       = useState<LearningLog[]>([]);
  const [latest, setLatest]   = useState<LearningLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getLearningLogs(20), getLatestEvaluation()])
      .then(([l, ev]) => {
        setLogs(l);
        if ("id" in ev) setLatest(ev as LearningLog);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      <Sidebar />

      {/* İçerik */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Cpu size={20} className="text-[var(--accent-green)]" /> AI Öğrenme Merkezi
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Gemini'nin haftalık öz değerlendirmeleri ve öğrenilen pattern'ler</p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">Yükleniyor...</div>
        ) : (
          <>
            {/* Son değerlendirme özeti */}
            {latest ? (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Brain size={14} className="text-[var(--accent-green)]" />
                    Son Haftalık Değerlendirme
                  </h2>
                  <div className="flex items-center gap-3">
                    {latest.market_regime && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] ${REGIME_LABELS[latest.market_regime]?.color ?? ""}`}>
                        {REGIME_LABELS[latest.market_regime]?.label ?? latest.market_regime}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">{fmtDate(latest.created_at)}</span>
                  </div>
                </div>

                {/* Doğruluk + Ağırlıklar */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-1 bg-[var(--bg-hover)] rounded-xl p-3 flex flex-col items-center justify-center">
                    <p className="text-xs text-[var(--text-muted)]">Genel Doğruluk</p>
                    <p className={`font-mono text-2xl font-bold mt-1 ${
                      (latest.overall_accuracy ?? 0) >= 0.6 ? "text-[var(--accent-green)]" :
                      (latest.overall_accuracy ?? 0) >= 0.4 ? "text-yellow-400" : "text-[var(--accent-red)]"}`}>
                      {((latest.overall_accuracy ?? 0) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{latest.sample_size} öneri</p>
                  </div>

                  {latest.adjusted_weights && (
                    <div className="col-span-4 bg-[var(--bg-hover)] rounded-xl p-3">
                      <p className="text-xs font-semibold mb-2">Güncel Ağırlıklar</p>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(latest.adjusted_weights).map(([key, val]) => (
                          <div key={key}>
                            <p className="text-xs text-[var(--text-muted)] capitalize">{key.replace("_weight", "")}</p>
                            <div className="h-1.5 bg-[var(--border)] rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-[var(--accent-green)] rounded-full"
                                style={{ width: `${Math.min((val as number) * 100, 100)}%` }} />
                            </div>
                            <p className="font-mono text-xs font-bold mt-0.5">{((val as number) * 100).toFixed(0)}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Öğrenme notları */}
                {latest.learning_notes && (
                  <div className="border-t border-[var(--border)] pt-4">
                    <p className="text-xs font-semibold mb-2">Öğrenme Notları</p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{latest.learning_notes}</p>
                  </div>
                )}

                {/* Başarılı / Başarısız patternler */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { title: "Başarılı Pattern'ler", data: latest.best_patterns,  icon: <CheckCircle size={13} className="text-[var(--accent-green)]" />, color: "bg-[var(--accent-green)]/10 text-[var(--accent-green)]" },
                    { title: "Başarısız Pattern'ler", data: latest.worst_patterns, icon: <XCircle size={13} className="text-[var(--accent-red)]" />,     color: "bg-[var(--accent-red)]/10 text-[var(--accent-red)]" },
                  ].map(({ title, data, icon, color }) => (
                    <div key={title}>
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1">{icon}{title}</p>
                      {data && data.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {data.map((p, i) => (
                            <div key={i} className={`text-xs px-2 py-1 rounded-lg ${color}`}>{p}</div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)]">Henüz veri yok.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 text-center">
                <Cpu size={24} className="text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-sm font-semibold">Henüz Değerlendirme Yapılmadı</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  İlk haftalık öz değerlendirme Cuma 18:00&apos;de çalışır.
                </p>
              </div>
            )}

            {/* Tüm log geçmişi */}
            {logs.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">Öğrenme Geçmişi</h3>
                <div className="flex flex-col gap-3">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-[var(--bg-hover)] px-2 py-0.5 rounded-full font-mono text-[var(--text-muted)]">
                            {log.pattern_type}
                          </span>
                          {log.market_regime && (
                            <span className={`text-xs font-semibold ${REGIME_LABELS[log.market_regime]?.color ?? ""}`}>
                              {REGIME_LABELS[log.market_regime]?.label ?? log.market_regime}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`font-mono font-bold ${log.success_rate >= 0.6 ? "text-[var(--accent-green)]" : log.success_rate >= 0.4 ? "text-yellow-400" : "text-[var(--accent-red)]"}`}>
                            {(log.success_rate * 100).toFixed(1)}%
                          </span>
                          <span className="text-[var(--text-muted)]">{fmtDate(log.created_at)}</span>
                        </div>
                      </div>

                      <p className="text-xs text-[var(--text-muted)]">{log.pattern_description}</p>

                      {log.learning_notes && (
                        <p className="text-xs text-[var(--text-muted)] italic leading-relaxed line-clamp-2">
                          {log.learning_notes}
                        </p>
                      )}

                      {log.adjusted_weights && (
                        <div className="flex gap-4 flex-wrap">
                          {Object.entries(log.adjusted_weights).map(([k, v]) => (
                            <div key={k} className="text-xs">
                              <span className="text-[var(--text-muted)] capitalize">{k.replace("_weight", "")} </span>
                              <span className="font-mono font-semibold">{((v as number) * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
