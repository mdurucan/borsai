"use client";
import Link from "next/link";
import { Target, ShieldAlert, Clock } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { fmtPrice, fmtDate, actionColor, actionLabel, sessionLabel } from "@/lib/utils";

interface Props {
  rec: Recommendation;
  compact?: boolean;
}

export default function RecommendationCard({ rec, compact }: Props) {
  const badge = actionColor(rec.action);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/stocks/${rec.symbol}`} className="hover:underline">
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {rec.symbol.replace(".IS", "")}
            </span>
          </Link>
          <span className="text-xs text-[var(--text-muted)] ml-2">{rec.name}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${badge}`}>
          {actionLabel(rec.action)}
        </span>
      </div>

      {/* Fiyat bilgileri */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[var(--text-muted)]">Öneri Fiyatı</p>
          <p className="font-mono font-semibold">{fmtPrice(rec.price_at_recommendation)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] flex items-center gap-1"><Target size={10} /> Hedef</p>
          <p className="font-mono text-[var(--accent-green)]">{fmtPrice(rec.target_price)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] flex items-center gap-1"><ShieldAlert size={10} /> Stop</p>
          <p className="font-mono text-[var(--accent-red)]">{fmtPrice(rec.stop_loss)}</p>
        </div>
      </div>

      {/* Güven skoru */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[var(--text-muted)]">Güven Skoru</span>
          <span className="font-mono font-semibold">{rec.confidence_score}%</span>
        </div>
        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${rec.confidence_score}%`,
              background: rec.confidence_score >= 80 ? "var(--accent-green)"
                : rec.confidence_score >= 65 ? "#FBBF24"
                : "var(--accent-red)",
            }}
          />
        </div>
      </div>

      {/* Gerekçe (compact değilse) */}
      {!compact && rec.reasoning && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
          {rec.reasoning}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Clock size={10} /> {sessionLabel(rec.session)} · {fmtDate(rec.created_at)}
        </span>
        {rec.performance && (
          <span className={`font-mono font-semibold ${(rec.performance.return_pct ?? 0) >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
            {(rec.performance.return_pct ?? 0) >= 0 ? "+" : ""}
            {rec.performance.return_pct?.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}
