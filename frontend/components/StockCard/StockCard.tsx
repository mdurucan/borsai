"use client";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Brain } from "lucide-react";
import type { Stock } from "@/lib/types";
import { fmtPrice, fmtPct, pctColor } from "@/lib/utils";

interface Props {
  stock: Stock;
  hasActiveRec?: boolean;
  livePrice?: { close: number; change_pct: number } | null;
}

export default function StockCard({ stock, hasActiveRec, livePrice }: Props) {
  const price = livePrice?.close ?? stock.latest_price;
  const chg = livePrice?.change_pct ?? stock.change_pct;
  const Icon = chg == null ? Minus : chg > 0 ? TrendingUp : TrendingDown;

  return (
    <Link
      href={`/stocks/${stock.symbol}`}
      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-1.5 h-8 rounded-full flex-shrink-0"
          style={{ background: chg == null ? "var(--neutral)" : chg >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
              {stock.symbol.replace(".IS", "")}
            </span>
            {hasActiveRec && (
              <Brain size={12} className="text-[var(--accent-green)] flex-shrink-0" />
            )}
          </div>
          <span className="text-xs text-[var(--text-muted)] truncate block">{stock.name}</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-mono text-sm text-[var(--text-primary)]">
          {fmtPrice(price)}
        </div>
        <div className={`font-mono text-xs flex items-center justify-end gap-0.5 ${pctColor(chg)}`}>
          <Icon size={10} />
          {fmtPct(chg)}
        </div>
      </div>
    </Link>
  );
}
