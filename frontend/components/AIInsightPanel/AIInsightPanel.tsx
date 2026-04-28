"use client";
import { Brain, Target, ShieldAlert, TrendingUp, AlertTriangle } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { fmtPrice, fmtDate, actionColor, actionLabel, sessionLabel } from "@/lib/utils";

interface Props {
  recommendations: Recommendation[];
}

export default function AIInsightPanel({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
        <Brain size={20} className="text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-xs text-[var(--text-muted)]">Bu hisse için henüz AI önerisi yok.</p>
      </div>
    );
  }

  const latest = recommendations[0];
  const badge = actionColor(latest.action);

  return (
    <div className="flex flex-col gap-4">
      {/* En son öneri */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-[var(--accent-green)]" />
            <span className="text-sm font-semibold">Son AI Önerisi</span>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${badge}`}>
            {actionLabel(latest.action)}
          </span>
        </div>

        {/* Fiyat üçlüsü */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Öneri Fiyatı", value: fmtPrice(latest.price_at_recommendation), color: "text-[var(--text-primary)]" },
            { label: "Hedef", icon: <Target size={11} />, value: fmtPrice(latest.target_price), color: "text-[var(--accent-green)]" },
            { label: "Stop-Loss", icon: <ShieldAlert size={11} />, value: fmtPrice(latest.stop_loss), color: "text-[var(--accent-red)]" },
          ].map(({ label, icon, value, color }) => (
            <div key={label} className="bg-[var(--bg-hover)] rounded-lg p-2">
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mb-1">{icon}{label}</p>
              <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Güven skoru */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[var(--text-muted)]">Güven Skoru</span>
            <span className="font-mono font-bold">{latest.confidence_score}%</span>
          </div>
          <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${latest.confidence_score}%`,
                background: latest.confidence_score >= 80 ? "var(--accent-green)"
                  : latest.confidence_score >= 65 ? "#FBBF24"
                  : "var(--accent-red)",
              }}
            />
          </div>
        </div>

        {/* Gerekçe */}
        {latest.reasoning && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed border-t border-[var(--border)] pt-3">
            {latest.reasoning}
          </p>
        )}

        {/* Sinyaller */}
        {latest.key_signals && latest.key_signals.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1">
              <TrendingUp size={12} className="text-[var(--accent-green)]" /> Temel Sinyaller
            </p>
            <div className="flex flex-wrap gap-1">
              {latest.key_signals.map((s, i) => (
                <span key={i} className="text-xs bg-[var(--accent-green)]/10 text-[var(--accent-green)] px-2 py-0.5 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Riskler */}
        {latest.risks && latest.risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1">
              <AlertTriangle size={12} className="text-[var(--accent-red)]" /> Riskler
            </p>
            <div className="flex flex-wrap gap-1">
              {latest.risks.map((r, i) => (
                <span key={i} className="text-xs bg-[var(--accent-red)]/10 text-[var(--accent-red)] px-2 py-0.5 rounded-full">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)]">
          {sessionLabel(latest.session)} · {fmtDate(latest.created_at)} · {latest.time_horizon}
        </p>
      </div>

      {/* Geçmiş öneriler */}
      {recommendations.length > 1 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">Öneri Geçmişi</h4>
          <div className="flex flex-col gap-2">
            {recommendations.slice(1).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs border-b border-[var(--border)]/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${actionColor(r.action)}`}>
                    {actionLabel(r.action)}
                  </span>
                  <span className="text-[var(--text-muted)]">{fmtDate(r.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{fmtPrice(r.price_at_recommendation)}</span>
                  {r.performance && (
                    <span className={`font-mono font-bold ${(r.performance.return_pct ?? 0) >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                      {(r.performance.return_pct ?? 0) >= 0 ? "+" : ""}{r.performance.return_pct?.toFixed(2)}%
                    </span>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    r.performance?.is_successful === true ? "bg-[var(--accent-green)]" :
                    r.performance?.is_successful === false ? "bg-[var(--accent-red)]" :
                    "bg-[var(--neutral)]"
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
