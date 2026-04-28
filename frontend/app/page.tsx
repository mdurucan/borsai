"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveRecommendations, getMarketOverview, getSectorHeatmap, getLivePrices } from "@/lib/api";
import type { Recommendation, MarketOverview } from "@/lib/types";
import RecommendationCard from "@/components/RecommendationCard/RecommendationCard";
import ScheduleStatus from "@/components/ScheduleStatus/ScheduleStatus";
import NotificationBell from "@/components/NotificationBell/NotificationBell";
import Sidebar from "@/components/Sidebar/Sidebar";
import { fmtPrice, fmtPct, pctColor } from "@/lib/utils";

// ── Portföy özet widget'ı ───────────────────────────────────────────────────
function PortfolioSummary({ livePrices }: { livePrices: Record<string, { close: number; change_pct: number }> }) {
  // localStorage'daki tüm portfolio_* anahtarlarını oku
  const [positions, setPositions] = useState<Array<{
    symbol: string; lots: number; avgCost: number; currentPrice: number | null;
  }>>([]);

  useEffect(() => {
    const result: typeof positions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("portfolio_")) continue;
      const symbol = key.replace("portfolio_", "");
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{ lots: number; avgCost: number }>;
        const totalLots = raw.reduce((s, p) => s + p.lots, 0);
        const totalCost = raw.reduce((s, p) => s + p.lots * p.avgCost, 0);
        if (totalLots > 0) {
          result.push({
            symbol,
            lots: totalLots,
            avgCost: totalCost / totalLots,
            currentPrice: null,
          });
        }
      } catch { /* ignore */ }
    }
    setPositions(result);
  }, []);

  // livePrices gelince güncelle
  const enriched = positions.map((p) => {
    const lp = livePrices[p.symbol];
    return { ...p, currentPrice: lp?.close ?? null };
  });

  if (enriched.length === 0) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
        <p className="text-xs font-semibold text-[var(--text-muted)]">Portföy Durumu</p>
        <p className="text-xs text-[var(--text-muted)] opacity-60 mt-1">Hisse detay sayfasından alım ekleyebilirsin.</p>
      </div>
    );
  }

  const totalCost  = enriched.reduce((s, p) => s + p.lots * p.avgCost, 0);
  const totalValue = enriched.reduce((s, p) => p.currentPrice != null ? s + p.lots * p.currentPrice : s + p.lots * p.avgCost, 0);
  const totalPnl   = totalValue - totalCost;
  const totalPct   = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const isUp       = totalPnl >= 0;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Portföy Durumu</h3>
        <div className={`font-mono text-xs font-bold ${isUp ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
          {isUp ? "+" : ""}{totalPct.toFixed(2)}%
        </div>
      </div>

      {/* Toplam özet */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--bg-hover)] rounded-lg p-2">
          <p className="text-[10px] text-[var(--text-muted)]">Toplam Maliyet</p>
          <p className="font-mono text-xs font-bold">{fmtPrice(totalCost)}</p>
        </div>
        <div className="bg-[var(--bg-hover)] rounded-lg p-2">
          <p className="text-[10px] text-[var(--text-muted)]">Güncel Değer</p>
          <p className="font-mono text-xs font-bold">{fmtPrice(totalValue)}</p>
        </div>
      </div>

      {/* K/Z */}
      <div className={`rounded-lg p-2.5 border text-center ${
        isUp ? "bg-[var(--accent-green)]/5 border-[var(--accent-green)]/20" : "bg-[var(--accent-red)]/5 border-[var(--accent-red)]/20"
      }`}>
        <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{isUp ? "Toplam Kâr" : "Toplam Zarar"}</p>
        <p className={`font-mono text-base font-black ${isUp ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
          {isUp ? "+" : ""}{fmtPrice(totalPnl)}
        </p>
      </div>

      {/* Hisse bazında liste */}
      <div className="flex flex-col gap-1.5">
        {enriched.map((p) => {
          const cost  = p.lots * p.avgCost;
          const val   = p.currentPrice != null ? p.lots * p.currentPrice : cost;
          const pnl   = val - cost;
          const pct   = cost > 0 ? (pnl / cost) * 100 : 0;
          const pos   = pnl >= 0;
          const sym   = p.symbol.replace(".IS", "");
          return (
            <div key={p.symbol} className="flex items-center justify-between py-1 border-b border-[var(--border)]/40 last:border-0">
              <div>
                <p className="font-mono text-xs font-bold">{sym}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{p.lots.toLocaleString("tr-TR")} lot</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-xs font-bold ${pos ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {pos ? "+" : ""}{fmtPrice(pnl)}
                </p>
                <p className={`font-mono text-[10px] ${pos ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {pos ? "+" : ""}{pct.toFixed(2)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton bileşenleri ────────────────────────────────────────────────────
function Sk({ w = "w-full", h = "h-4", rounded = "rounded" }: { w?: string; h?: string; rounded?: string }) {
  return <div className={`${w} ${h} ${rounded} bg-[var(--border)] animate-pulse`} />;
}

function CardSk() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      <Sk w="w-1/3" h="h-4" />
      <Sk h="h-3" />
      <Sk w="w-3/4" h="h-3" />
      <Sk h="h-3" />
    </div>
  );
}

export default function Dashboard() {
  const [activeRecs, setActiveRecs] = useState<Recommendation[]>([]);
  const [overview, setOverview]   = useState<MarketOverview | null>(null);
  const [heatmap, setHeatmap]     = useState<Array<{ sector: string; avg_change_pct: number; stock_count: number }>>([]);
  const [livePrices, setLivePrices] = useState<Record<string, { close: number; change_pct: number }>>({});
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const [loadingRecs, setLoadingRecs]         = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingHeatmap, setLoadingHeatmap]   = useState(true);

  useEffect(() => {
    getActiveRecommendations()
      .then(setActiveRecs).catch(console.error)
      .finally(() => setLoadingRecs(false));

    getMarketOverview()
      .then(setOverview).catch(console.error)
      .finally(() => setLoadingOverview(false));

    getSectorHeatmap()
      .then(setHeatmap).catch(console.error)
      .finally(() => setLoadingHeatmap(false));

    const applyLivePrices = (lp: Array<{ symbol: string; close: number | null; change_pct: number | null }>) => {
      const m: Record<string, { close: number; change_pct: number }> = {};
      lp.forEach((p) => { if (p.close != null && p.change_pct != null) m[p.symbol] = { close: p.close, change_pct: p.change_pct }; });
      setLivePrices(m);
    };
    getLivePrices().then(applyLivePrices).catch(() => {});

    const id = setInterval(() => getLivePrices().then(applyLivePrices).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeSymbols = new Set(activeRecs.map((r) => r.symbol));

  const topRecs = [...activeRecs]
    .sort((a, b) => {
      const order = { BUY: 0, SELL: 1, WATCH: 2, HOLD: 3 };
      const oa = order[a.action as keyof typeof order] ?? 4;
      const ob = order[b.action as keyof typeof order] ?? 4;
      return oa !== ob ? oa - ob : b.confidence_score - a.confidence_score;
    })
    .slice(0, 3);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      <Sidebar />

      {/* ── Ana İçerik ── */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Dashboard</h1>
            <p className="text-xs text-[var(--text-muted)]">BIST30 anlık görünüm ve AI önerileri</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {overview ? `${overview.total_active} hisse aktif` : <Sk w="w-20" h="h-3" />}
            </span>
            <NotificationBell />
          </div>
        </div>

        {/* AI Insights Banner */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3 uppercase tracking-wider">
            Günün En Güçlü Önerileri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loadingRecs
              ? [1, 2, 3].map((i) => <CardSk key={i} />)
              : topRecs.length > 0
                ? topRecs.map((r) => <RecommendationCard key={r.id} rec={r} compact />)
                : (
                  <div className="col-span-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-xs text-[var(--text-muted)] text-center">
                    Henüz aktif öneri yok. Sonraki tarama sonrası görünür.
                  </div>
                )
            }
          </div>
        </section>

        {/* Heatmap + Zamanlayıcı */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Sektör Performansı</h3>
            {loadingHeatmap
              ? <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-lg p-3 bg-[var(--border)]/30 animate-pulse h-14" />
                  ))}
                </div>
              : heatmap.length === 0
                ? <p className="text-xs text-[var(--text-muted)]">Henüz veri yok. İlk tarama sonrası görünür.</p>
                : (
                  <div className="grid grid-cols-2 gap-2">
                    {heatmap.map((h) => {
                      const positive = h.avg_change_pct >= 0;
                      const intensity = Math.min(Math.abs(h.avg_change_pct) / 3, 1);
                      return (
                        <div key={h.sector} onClick={() => setSelectedSector(h.sector)}
                          className="rounded-lg p-3 flex justify-between items-center cursor-pointer hover:brightness-125 transition-all"
                          style={{
                            background: positive ? `rgba(0,212,168,${0.05 + intensity * 0.15})` : `rgba(255,69,96,${0.05 + intensity * 0.15})`,
                            border: `1px solid ${positive ? "rgba(0,212,168,0.2)" : "rgba(255,69,96,0.2)"}`,
                          }}>
                          <div>
                            <p className="text-xs font-medium">{h.sector}</p>
                            <p className="text-xs text-[var(--text-muted)]">{h.stock_count} hisse</p>
                          </div>
                          <span className={`font-mono text-sm font-bold ${pctColor(h.avg_change_pct)}`}>
                            {fmtPct(h.avg_change_pct)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
            }
          </div>

          <div className="flex flex-col gap-4">
            <PortfolioSummary livePrices={livePrices} />
            <ScheduleStatus />
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Aktif Öneriler</h3>
              {loadingRecs
                ? [1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Sk w="w-12" h="h-3" /><Sk w="w-6" h="h-3" />
                    </div>
                  ))
                : ["BUY", "SELL", "HOLD", "WATCH"].map((action) => (
                    <div key={action} className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">{action}</span>
                      <span className="font-mono font-bold">{activeRecs.filter((r) => r.action === action).length}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Top Gainers / Losers */}
        <div className="grid grid-cols-2 gap-4">
          {loadingOverview
            ? [1, 2].map((i) => <CardSk key={i} />)
            : overview
              ? [
                  { title: "En Çok Yükselen", data: overview.top_gainers },
                  { title: "En Çok Düşen",    data: overview.top_losers },
                ].map(({ title, data }) => (
                  <div key={title} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3">{title}</h3>
                    <div className="flex flex-col gap-2">
                      {data.map((s) => (
                        <Link key={s.symbol} href={`/stocks/${s.symbol}`}
                          className="flex justify-between items-center text-xs hover:bg-[var(--bg-hover)] px-2 py-1 rounded-lg transition-colors">
                          <span className="font-mono font-semibold">{s.symbol.replace(".IS", "")}</span>
                          <span className="text-[var(--text-muted)] truncate mx-2 flex-1">{s.name}</span>
                          <span className={`font-mono font-bold ${pctColor(s.change_pct)}`}>{fmtPct(s.change_pct)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              : null
          }
        </div>

        {/* Aktif öneriler tablosu */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold">Aktif Öneriler</h3>
              <Link href="/recommendations" className="text-xs text-[var(--accent-green)] hover:underline">Tümünü gör →</Link>
            </div>
            {loadingRecs
              ? <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-4 py-2 border-b border-[var(--border)]/50">
                      <Sk w="w-16" h="h-3" /><Sk w="w-12" h="h-3" /><Sk w="w-20" h="h-3" />
                      <Sk w="w-20" h="h-3" /><Sk w="w-10" h="h-3" />
                    </div>
                  ))}
                </div>
              : activeRecs.length === 0
                ? <p className="text-xs text-[var(--text-muted)] text-center py-4">Henüz aktif öneri yok.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                          {["Hisse", "İşlem", "Öneri Fiyatı", "Güncel", "Hedef", "Stop", "Güven"].map((h) => (
                            <th key={h} className="text-left pb-2 pr-3 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeRecs.slice(0, 5).map((r) => {
                          const lp = livePrices[r.symbol];
                          const currentPrice = lp?.close;
                          const pnlPct = currentPrice != null
                            ? ((currentPrice - r.price_at_recommendation) / r.price_at_recommendation) * 100
                            : null;
                          const isUp = (pnlPct ?? 0) >= 0;
                          return (
                            <tr key={r.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="py-2 pr-3">
                                <Link href={`/stocks/${r.symbol}`} className="font-mono font-semibold hover:text-[var(--accent-green)]">
                                  {r.symbol.replace(".IS", "")}
                                </Link>
                              </td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-md font-black font-mono text-[10px] ${
                                  r.action === "BUY"   ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]" :
                                  r.action === "SELL"  ? "bg-[var(--accent-red)]/10 text-[var(--accent-red)]" :
                                  r.action === "WATCH" ? "bg-blue-500/10 text-blue-400" :
                                  "bg-yellow-400/10 text-yellow-400"}`}>
                                  {r.action}
                                </span>
                              </td>
                              <td className="py-2 pr-3 font-mono">{r.price_at_recommendation.toFixed(2)} ₺</td>
                              <td className="py-2 pr-3">
                                {currentPrice != null ? (
                                  <div>
                                    <span className="font-mono">{currentPrice.toFixed(2)} ₺</span>
                                    {pnlPct != null && (
                                      <span className={`ml-1 font-mono text-[10px] font-bold ${isUp ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                                        {isUp ? "+" : ""}{pnlPct.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                ) : <span className="text-[var(--text-muted)]">—</span>}
                              </td>
                              <td className="py-2 pr-3 font-mono text-[var(--accent-green)]">{r.target_price?.toFixed(2) ?? "—"} ₺</td>
                              <td className="py-2 pr-3 font-mono text-[var(--accent-red)]">{r.stop_loss?.toFixed(2) ?? "—"} ₺</td>
                              <td className="py-2 font-mono">{r.confidence_score}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {activeRecs.length > 5 && (
                      <p className="text-[10px] text-[var(--text-muted)] text-center pt-2">
                        +{activeRecs.length - 5} öneri daha · <Link href="/recommendations" className="text-[var(--accent-green)] hover:underline">Tümünü gör</Link>
                      </p>
                    )}
                  </div>
                )
            }
        </div>
      </main>

      {/* ── Sektör Detay Modal ── */}
      {selectedSector && (() => {
        const sectorStocks = (overview?.stocks ?? []).filter((s) => s.sector === selectedSector);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setSelectedSector(null)}>
            <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-[var(--border)] shadow-2xl"
              style={{ background: "var(--bg-card)" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">{selectedSector}</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{sectorStocks.length} hisse</p>
                </div>
                <button onClick={() => setSelectedSector(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                      {["Hisse", "Ad", "Fiyat", "Günlük %", "Hacim", "RSI"].map((col) => (
                        <th key={col} className="text-left px-3 py-2 font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sectorStocks
                      .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0))
                      .map((s) => {
                        const lp = livePrices[s.symbol];
                        const price = lp?.close ?? s.close;
                        const chg = lp?.change_pct ?? s.change_pct;
                        return (
                          <tr key={s.symbol} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-3 py-2">
                              <Link href={`/stocks/${s.symbol}`} onClick={() => setSelectedSector(null)}
                                className="font-mono font-bold hover:text-[var(--accent-green)] transition-colors">
                                {s.symbol.replace(".IS", "")}
                              </Link>
                              {activeSymbols.has(s.symbol) && <span className="ml-1 text-[var(--accent-green)] text-[10px]">●</span>}
                            </td>
                            <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[140px]">{s.name}</td>
                            <td className="px-3 py-2 font-mono font-semibold">
                              {price != null ? `${price.toLocaleString("tr-TR")} ₺` : "—"}
                            </td>
                            <td className={`px-3 py-2 font-mono font-bold ${pctColor(chg ?? 0)}`}>
                              {chg != null ? fmtPct(chg) : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-[var(--text-muted)]">
                              {s.volume != null ? (s.volume >= 1_000_000 ? `${(s.volume / 1_000_000).toFixed(1)}M` : `${(s.volume / 1_000).toFixed(0)}K`) : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {s.rsi_14 != null ? (
                                <span className={s.rsi_14 > 70 ? "text-[var(--accent-red)]" : s.rsi_14 < 30 ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"}>
                                  {s.rsi_14.toFixed(1)}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                ● AI önerisi olan hisseler · RSI &gt;70 aşırı alım · RSI &lt;30 aşırı satım
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
