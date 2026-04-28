"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown, Brain, Wallet, Activity } from "lucide-react";
import {
  getStock, getStockHistory, getStockSnapshots, getStockRecommendations, getLivePrice,
} from "@/lib/api";
import type { OHLCV, Snapshot, Recommendation } from "@/lib/types";
import PriceChart from "@/components/PriceChart/PriceChart";
import AIInsightPanel from "@/components/AIInsightPanel/AIInsightPanel";
import PortfolioPanel from "@/components/PortfolioPanel/PortfolioPanel";
import Sidebar from "@/components/Sidebar/Sidebar";
import { fmtPrice, fmtPct, fmtVolume, pctColor, fmt } from "@/lib/utils";

const PERIODS = [
  { label: "1G",  value: "1d",  interval: "5m" },
  { label: "1H",  value: "5d",  interval: "15m" },
  { label: "1A",  value: "1mo", interval: "1d" },
  { label: "3A",  value: "3mo", interval: "1d" },
  { label: "1Y",  value: "1y",  interval: "1d" },
];

type RightTab = "ai" | "portfolio" | "technical";

interface StockDetail {
  symbol: string;
  name: string;
  sector: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  latest_snapshot: Snapshot | null;
}

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();

  const [stock, setStock]       = useState<StockDetail | null>(null);
  const [history, setHistory]   = useState<OHLCV[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [recs, setRecs]         = useState<Recommendation[]>([]);
  const [period, setPeriod]     = useState(PERIODS[3]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<RightTab>("ai");
  const [livePrice, setLivePrice] = useState<{
    close: number; change_pct: number; day_high: number | null; day_low: number | null
  } | null>(null);

  useEffect(() => {
    if (!symbol) return;
    const sym = symbol.includes(".") ? symbol : `${symbol}.IS`;
    Promise.all([
      getStock(sym),
      getStockSnapshots(sym, 100),
      getStockRecommendations(sym, 20),
    ]).then(([s, snaps, r]) => {
      setStock(s as StockDetail);
      setSnapshots(snaps);
      setRecs(r);
    }).catch(() => router.push("/")).finally(() => setLoading(false));

    getLivePrice(sym).then(setLivePrice).catch(() => {});
    const id = setInterval(() => getLivePrice(sym).then(setLivePrice).catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, [symbol, router]);

  useEffect(() => {
    if (!symbol) return;
    const sym = symbol.includes(".") ? symbol : `${symbol}.IS`;
    getStockHistory(sym, period.value, period.interval).then(setHistory).catch(console.error);
  }, [symbol, period]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <p className="text-[var(--text-muted)] text-sm animate-pulse">Yükleniyor...</p>
      </div>
    );
  }
  if (!stock) return null;

  const snap = stock.latest_snapshot;
  const price = livePrice?.close ?? snap?.close;
  const chgPct = livePrice?.change_pct ?? snap?.change_pct;

  const performances = [
    { label: "1G", value: snap?.performance_1d },
    { label: "1H", value: snap?.performance_1w },
    { label: "1A", value: snap?.performance_1m },
    { label: "3A", value: snap?.performance_3m },
    { label: "1Y", value: snap?.performance_1y },
  ];

  const indicators = snap ? [
    {
      label: "RSI(14)",
      value: fmt(snap.rsi_14),
      color: snap.rsi_14 == null ? "" : snap.rsi_14 > 70 ? "text-[var(--accent-red)]" : snap.rsi_14 < 30 ? "text-blue-400" : "text-[var(--accent-green)]",
      sub: snap.rsi_14 == null ? "—" : snap.rsi_14 > 70 ? "Aşırı Alım" : snap.rsi_14 < 30 ? "Aşırı Satım" : "Nötr",
    },
    {
      label: "MACD",
      value: fmt(snap.macd),
      color: (snap.macd_histogram ?? 0) >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
      sub: `Hist: ${fmt(snap.macd_histogram)}`,
    },
    {
      label: "ADX",
      value: fmt(snap.adx),
      color: (snap.adx ?? 0) > 25 ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]",
      sub: (snap.adx ?? 0) > 25 ? "Güçlü Trend" : "Zayıf",
    },
    {
      label: "EMA20",
      value: fmt(snap.ema_20),
      color: price != null && snap.ema_20 != null ? price > snap.ema_20 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]" : "",
      sub: price != null && snap.ema_20 != null ? price > snap.ema_20 ? "Üstünde" : "Altında" : "—",
    },
    {
      label: "SMA200",
      value: fmt(snap.sma_200),
      color: price != null && snap.sma_200 != null ? price > snap.sma_200 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]" : "",
      sub: price != null && snap.sma_200 != null ? price > snap.sma_200 ? "Üstünde" : "Altında" : "—",
    },
    {
      label: "Hacim",
      value: `${fmt(snap.volume_ratio_20d)}x`,
      color: (snap.volume_ratio_20d ?? 0) > 1.5 ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]",
      sub: fmtVolume(snap.volume),
    },
  ] : [];

  const TABS: { key: RightTab; label: string; icon: typeof Brain }[] = [
    { key: "ai",        label: "AI Analiz", icon: Brain },
    { key: "portfolio", label: "Portföy",   icon: Wallet },
    { key: "technical", label: "Teknik",    icon: Activity },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ArrowLeft size={15} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold">{stock.symbol.replace(".IS", "")}</span>
                <span className="text-sm text-[var(--text-muted)]">{stock.name}</span>
                {stock.sector && (
                  <span className="text-xs bg-[var(--bg-hover)] border border-[var(--border)] px-2 py-0.5 rounded-full text-[var(--text-muted)]">
                    {stock.sector}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xl font-bold">{fmtPrice(price)}</span>
                <span className={`font-mono text-sm font-semibold flex items-center gap-0.5 ${pctColor(chgPct)}`}>
                  {(chgPct ?? 0) >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {fmtPct(chgPct)}
                </span>
                {livePrice && (
                  <span className="text-[10px] font-mono text-[var(--accent-green)] border border-[var(--accent-green)]/30 px-1.5 py-0.5 rounded-full">
                    CANLI
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Performans şeridi */}
          <div className="flex items-center gap-4">
            {performances.map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
                <p className={`font-mono text-xs font-bold ${pctColor(value)}`}>{fmtPct(value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ana alan: Sol grafik | Sağ panel ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Sol — Grafik + gösterge şeridi */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border)]">

            {/* Periyot seçici */}
            <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-[var(--border)]">
              {PERIODS.map((p) => (
                <button key={p.value} onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs rounded-lg font-mono font-semibold transition-colors ${
                    period.value === p.value
                      ? "bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Grafik */}
            <div className="flex-1 overflow-hidden">
              {history.length > 0
                ? <PriceChart data={history} snapshots={snapshots} height={undefined} />
                : (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                    Grafik verisi yükleniyor...
                  </div>
                )
              }
            </div>

            {/* Gösterge şeridi */}
            {snap && (
              <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3 flex items-center gap-6 overflow-x-auto">
                {indicators.map(({ label, value, color, sub }) => (
                  <div key={label} className="flex-shrink-0 text-center min-w-[60px]">
                    <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</p>
                    <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>
                  </div>
                ))}

                {/* Destek/Direnç */}
                <div className="flex-shrink-0 h-8 w-px bg-[var(--border)]" />
                <div className="flex-shrink-0 text-center min-w-[70px]">
                  <p className="text-[10px] text-[var(--text-muted)] mb-0.5">BB Üst</p>
                  <p className="font-mono text-sm font-bold text-[var(--accent-red)]">{fmt(snap.bb_upper)}</p>
                </div>
                <div className="flex-shrink-0 text-center min-w-[70px]">
                  <p className="text-[10px] text-[var(--text-muted)] mb-0.5">BB Orta</p>
                  <p className="font-mono text-sm font-bold text-yellow-400">{fmt(snap.bb_middle)}</p>
                </div>
                <div className="flex-shrink-0 text-center min-w-[70px]">
                  <p className="text-[10px] text-[var(--text-muted)] mb-0.5">BB Alt</p>
                  <p className="font-mono text-sm font-bold text-[var(--accent-green)]">{fmt(snap.bb_lower)}</p>
                </div>

                <div className="flex-shrink-0 h-8 w-px bg-[var(--border)]" />
                <div className="flex-shrink-0 text-center min-w-[70px]">
                  <p className="text-[10px] text-[var(--text-muted)] mb-0.5">52H Yük.</p>
                  <p className="font-mono text-sm font-bold text-[var(--accent-green)]">{fmt(snap.high_52w)}</p>
                </div>
                <div className="flex-shrink-0 text-center min-w-[70px]">
                  <p className="text-[10px] text-[var(--text-muted)] mb-0.5">52H Düş.</p>
                  <p className="font-mono text-sm font-bold text-[var(--accent-red)]">{fmt(snap.low_52w)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sağ — Tab'lı panel */}
          <div className="w-[360px] flex-shrink-0 flex flex-col overflow-hidden">

            {/* Tab başlıkları */}
            <div className="flex-shrink-0 flex border-b border-[var(--border)]">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${
                    tab === key
                      ? "border-[var(--accent-green)] text-[var(--accent-green)]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* Tab içeriği */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* AI Sekmesi */}
              {tab === "ai" && (
                <div className="flex flex-col gap-4">
                  <AIInsightPanel recommendations={recs} />
                  {recs[0]?.sector_outlook && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Sektör Görünümü</h4>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{recs[0].sector_outlook}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Portföy Sekmesi */}
              {tab === "portfolio" && (
                <PortfolioPanel
                  symbol={stock.symbol}
                  currentPrice={livePrice?.close ?? snap?.close ?? null}
                />
              )}

              {/* Teknik Sekmesi */}
              {tab === "technical" && snap && (
                <div className="flex flex-col gap-4">

                  {/* Fiyat istatistikleri */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Fiyat</h4>
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                      {[
                        { label: "Açılış",    value: fmtPrice(snap.open) },
                        { label: "Yüksek",    value: fmtPrice(livePrice?.day_high ?? snap.high) },
                        { label: "Düşük",     value: fmtPrice(livePrice?.day_low ?? snap.low) },
                        { label: "Hacim",     value: fmtVolume(snap.volume) },
                        { label: "F/K",       value: fmt(stock.pe_ratio) },
                        { label: "PD/DD",     value: fmt(stock.pb_ratio) },
                        { label: "52H Max",   value: fmtPrice(snap.high_52w) },
                        { label: "52H Min",   value: fmtPrice(snap.low_52w) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-[var(--text-muted)]">{label}</span>
                          <span className="font-mono font-semibold">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fibonacci */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Fibonacci Seviyeleri</h4>
                    <div className="flex flex-col gap-1.5 text-xs">
                      {[
                        { label: "52H Yüksek", val: snap.high_52w, color: "text-[var(--accent-green)]" },
                        { label: "Fib %38.2",  val: snap.fib_382,  color: "text-[var(--text-primary)]" },
                        { label: "Fib %50.0",  val: snap.fib_500,  color: "text-[var(--text-primary)]" },
                        { label: "Fib %61.8",  val: snap.fib_618,  color: "text-[var(--text-primary)]" },
                        { label: "52H Düşük",  val: snap.low_52w,  color: "text-[var(--accent-red)]" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="flex justify-between items-center">
                          <span className="text-[var(--text-muted)]">{label}</span>
                          <span className={`font-mono font-semibold ${color} ${
                            snap.close != null && val != null && Math.abs(snap.close - val) / val < 0.01
                              ? "underline decoration-dotted" : ""
                          }`}>
                            {fmtPrice(val)}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-[var(--border)] pt-1.5 flex justify-between">
                        <span className="text-[var(--accent-green)] font-semibold">Güncel</span>
                        <span className="font-mono font-bold">{fmtPrice(snap.close)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hareketli ortalamalar detay */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Hareketli Ortalamalar</h4>
                    <div className="flex flex-col gap-2 text-xs">
                      {[
                        { label: "EMA 20",  val: snap.ema_20 },
                        { label: "EMA 50",  val: snap.ema_50 },
                        { label: "SMA 200", val: snap.sma_200 },
                      ].map(({ label, val }) => {
                        const above = price != null && val != null && price > val;
                        return (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">{label}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">{fmtPrice(val)}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                val == null ? "text-[var(--text-muted)]" :
                                above ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]" : "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
                              }`}>
                                {val == null ? "—" : above ? "Üstünde" : "Altında"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bollinger detay */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Bollinger Bantları</h4>
                    <div className="flex flex-col gap-2 text-xs">
                      {[
                        { label: "Üst Bant",  val: snap.bb_upper,  color: "text-[var(--accent-red)]" },
                        { label: "Orta Bant", val: snap.bb_middle, color: "text-yellow-400" },
                        { label: "Alt Bant",  val: snap.bb_lower,  color: "text-[var(--accent-green)]" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-[var(--text-muted)]">{label}</span>
                          <span className={`font-mono font-semibold ${color}`}>{fmtPrice(val)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Fiyatın bant içindeki pozisyonu */}
                    {snap.bb_upper != null && snap.bb_lower != null && price != null && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                          <span>Alt</span><span>Pozisyon</span><span>Üst</span>
                        </div>
                        <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent-green)]/40 rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, (price - snap.bb_lower) / (snap.bb_upper - snap.bb_lower) * 100))}%`
                            }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "technical" && !snap && (
                <p className="text-xs text-[var(--text-muted)] text-center py-8">Teknik veri yok.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
