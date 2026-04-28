"use client";
import { useState } from "react";
import { Info, X } from "lucide-react";

export interface IndicatorDefinition {
  name: string;
  short: string;        // 1 satır özet
  detail: string;       // detaylı açıklama
  ranges?: { label: string; color: string; desc: string }[];
}

interface Props {
  indicator: IndicatorDefinition;
}

export default function IndicatorInfo({ indicator }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[var(--text-muted)] hover:text-[var(--accent-green)] hover:bg-[var(--accent-green)]/10 transition-colors flex-shrink-0"
        title={`${indicator.name} nedir?`}
      >
        <Info size={11} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl"
            style={{ background: "var(--bg-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{indicator.name}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{indicator.short}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{indicator.detail}</p>

              {indicator.ranges && indicator.ranges.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Değer Aralıkları</p>
                  {indicator.ranges.map((r) => (
                    <div key={r.label} className="flex items-start gap-3">
                      <span className={`text-xs font-mono font-bold flex-shrink-0 w-20 ${r.color}`}>{r.label}</span>
                      <span className="text-xs text-[var(--text-muted)] leading-relaxed">{r.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
