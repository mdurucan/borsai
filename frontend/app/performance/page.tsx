"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Trophy, AlertTriangle } from "lucide-react";
import Sidebar from "@/components/Sidebar/Sidebar";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import {
  getPerformanceSummary, getPerformanceByStock,
  getPerformanceBySession, getCumulativeReturns, getTopRecommendations,
} from "@/lib/api";
import type { PerformanceSummary, StockPerformance } from "@/lib/types";

interface CumulativePoint { date: string; cumulative_value: number }
interface TopRec {
  symbol: string; action: string; created_at: string;
  price: number; return_pct: number; is_successful: boolean; days_held: number;
}

export default function PerformancePage() {
  const [summary, setSummary]         = useState<PerformanceSummary | null>(null);
  const [byStock, setByStock]         = useState<StockPerformance[]>([]);
  const [bySession, setBySession]     = useState<StockPerformance[]>([]);
  const [cumulative, setCumulative]   = useState<CumulativePoint[]>([]);
  const [topBest, setTopBest]         = useState<TopRec[]>([]);
  const [topWorst, setTopWorst]       = useState<TopRec[]>([]);
  const [days, setDays]               = useState(30);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPerformanceSummary(days),
      getPerformanceByStock(),
      getPerformanceBySession(),
      getCumulativeReturns(),
      getTopRecommendations(10, false),
      getTopRecommendations(10, true),
    ]).then(([sum, stock, sess, cum, best, worst]) => {
      setSummary(sum);
      setByStock(stock);
      setBySession(sess);
      setCumulative(cum);
      setTopBest(best);
      setTopWorst(worst);
    }).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  const gaugeData = summary
    ? [{ name: "Doğruluk", value: summary.accuracy, fill: summary.accuracy >= 60 ? "#00D4A8" : summary.accuracy >= 40 ? "#FBBF24" : "#FF4560" }]
    : [];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      <Sidebar />

      {/* İçerik */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Performans Analizi</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Öneri başarı istatistikleri ve kümülatif getiri</p>
          </div>
          <div className="flex gap-1">
            {[7,30,90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-lg font-mono font-semibold transition-colors ${
                  days === d ? "bg-[var(--accent-green)]/20 text-[var(--accent-green)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}>
                {d}G
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">Yükleniyor...</div>
        ) : (
          <>
            {/* Özet kartlar */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Toplam Öneri",     value: summary?.total ?? 0,                      color: "text-[var(--text-primary)]" },
                { label: "Başarılı",          value: summary?.successful ?? 0,                 color: "text-[var(--accent-green)]" },
                { label: "Başarısız",         value: summary?.failed ?? 0,                     color: "text-[var(--accent-red)]" },
                { label: "Ort. Getiri",       value: `${summary?.avg_return_pct?.toFixed(2) ?? "—"}%`, color: (summary?.avg_return_pct ?? 0) >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className={`font-mono text-2xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Doğruluk gauge + Kümülatif getiri */}
            <div className="grid grid-cols-3 gap-4">
              {/* Gauge */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                <h3 className="text-sm font-semibold self-start">Genel Başarı Oranı</h3>
                {summary && summary.total > 0 ? (
                  <>
                    <div className="relative w-40 h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart innerRadius="60%" outerRadius="90%" data={gaugeData} startAngle={180} endAngle={0}>
                          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#1F2937" }} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center mt-6">
                        <span className="font-mono text-3xl font-bold">{summary.accuracy.toFixed(1)}%</span>
                        <span className="text-xs text-[var(--text-muted)]">{summary.total} öneri</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Son {days} gün</p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">Henüz değerlendirilen öneri yok.</p>
                )}
              </div>

              {/* Kümülatif getiri */}
              <div className="col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">Kümülatif Getiri Simülasyonu</h3>
                {cumulative.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={cumulative}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 10 }}
                        tickFormatter={(v) => v.split("T")[0].slice(5)} />
                      <YAxis tick={{ fill: "#6B7280", fontSize: 10 }}
                        tickFormatter={(v) => `${v.toFixed(0)}`} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: "#9CA3AF" }}
                        formatter={(v) => [`${(v as number).toFixed(2)}`, "Değer"]}
                      />
                      <Line type="monotone" dataKey="cumulative_value" stroke="#00D4A8"
                        strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-[var(--text-muted)]">
                    Henüz veri yok.
                  </div>
                )}
              </div>
            </div>

            {/* Hisse + Seans bazında başarı */}
            <div className="grid grid-cols-2 gap-4">
              {/* Hisse bazında */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">Hisse Bazında Başarı</h3>
                {byStock.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byStock.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6B7280", fontSize: 10 }}
                        tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="symbol" width={55}
                        tick={{ fill: "#9CA3AF", fontSize: 10 }}
                        tickFormatter={(v) => v.replace(".IS", "")} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, fontSize: 11 }}
                        formatter={(v) => [`${(v as number).toFixed(1)}%`, "Başarı"]}
                      />
                      <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                        {byStock.slice(0, 10).map((entry, i) => (
                          <Cell key={i} fill={entry.accuracy >= 60 ? "#00D4A8" : entry.accuracy >= 40 ? "#FBBF24" : "#FF4560"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-[var(--text-muted)]">Henüz veri yok.</div>
                )}
              </div>

              {/* Seans bazında */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">Seans Bazında Başarı</h3>
                {bySession.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={bySession}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis dataKey="session" tick={{ fill: "#9CA3AF", fontSize: 11 }}
                        tickFormatter={(v) => v === "morning" ? "Sabah" : v === "noon" ? "Öğlen" : "Kapanış"} />
                      <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, fontSize: 11 }}
                        formatter={(v) => [`${(v as number).toFixed(1)}%`, "Başarı"]}
                      />
                      <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                        {bySession.map((entry, i) => (
                          <Cell key={i} fill={entry.accuracy >= 60 ? "#00D4A8" : "#FBBF24"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-[var(--text-muted)]">Henüz veri yok.</div>
                )}
              </div>
            </div>

            {/* Top 10 en iyi / en kötü */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "En İyi 10 Öneri",  icon: <Trophy size={14} className="text-[var(--accent-green)]" />, data: topBest },
                { title: "En Kötü 10 Öneri", icon: <AlertTriangle size={14} className="text-[var(--accent-red)]" />, data: topWorst },
              ].map(({ title, icon, data }) => (
                <div key={title} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">{icon}{title}</h3>
                  {data.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">Henüz veri yok.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {data.map((r: TopRec, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--text-muted)] w-5 font-mono">{i + 1}.</span>
                            <Link href={`/stocks/${r.symbol}`}
                              className="font-mono font-bold hover:text-[var(--accent-green)]">
                              {r.symbol.replace(".IS", "")}
                            </Link>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                              r.action === "BUY" ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]" : "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"}`}>
                              {r.action}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--text-muted)]">{r.days_held}g</span>
                            <span className={`font-mono font-bold ${r.return_pct >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                              {r.return_pct >= 0 ? "+" : ""}{r.return_pct?.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
