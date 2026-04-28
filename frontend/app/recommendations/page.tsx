"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Brain, ChevronDown, ChevronUp, X, Landmark, TrendingUp, TrendingDown, Minus, AlertTriangle, Lightbulb } from "lucide-react";
import Sidebar from "@/components/Sidebar/Sidebar";
import { getRecommendations } from "@/lib/api";
import type { Recommendation } from "@/lib/types";
import { fmtPrice, fmtDate, fmtPct, pctColor, actionColor, actionLabel, sessionLabel } from "@/lib/utils";

// ── Dummy ajan rapor verisi (gerçek API bağlandığında kaldırılacak) ────────────
const DUMMY_AGENT_REPORTS = [
  {
    id: 1,
    agent: "Bankacılık Ajanı",
    agent_key: "banking_agent",
    created_at: "2026-04-02T09:15:00",
    sector_signal: "BULLISH" as "BULLISH" | "BEARISH" | "NEUTRAL",
    sector_summary: "BIST30 bankacılık sektörü sabah seansında güçlü bir görünüm sergiliyor. Yabancı yatırımcıların özellikle özel bankalara olan ilgisi dikkat çekerken, kamu bankalarında daha temkinli bir seyir gözlemleniyor. RSI değerleri genel olarak 38-42 bandında seyretmesi alım baskısının henüz tam oluşmadığını gösteriyor.",
    top_pick: "YKBNK.IS",
    avoid: "ISCTR.IS",
    macro_risks: [
      "TCMB faiz kararlarındaki belirsizlik ve enflasyonla mücadele politikası",
      "Kur volatilitesi ve döviz pozisyonu riskleri",
      "BDDK'nın kredi büyümesine yönelik olası makro ihtiyati tedbirler",
    ],
    opportunity: "Faiz indirim döngüsüne girilmesi durumunda özel bankaların net faiz marjında belirgin iyileşme bekleniyor. YKBNK ve GARAN bu senaryodan en fazla fayda sağlayacak hisseler olarak öne çıkıyor.",
    stocks: [
      { symbol: "AKBNK.IS", action: "HOLD",  confidence: 62, target_price: 72.50,  stop_loss: 64.00,  key_insight: "Güçlü sermaye yapısı ve temkinli kredi büyümesi olumlu, ancak kısa vadede katalizör eksik.", risk: "Yüksek TL mevduat maliyetleri" },
      { symbol: "GARAN.IS", action: "BUY",   confidence: 74, target_price: 140.00, stop_loss: 122.00, key_insight: "Sektör ortalamasının üzerinde hacim ve RSI'da toparlanma sinyali. Güçlü dijital bankacılık altyapısı avantaj.", risk: "Kur oynaklığı" },
      { symbol: "HALKB.IS", action: "WATCH", confidence: 51, target_price: 38.50,  stop_loss: 33.00,  key_insight: "Kamu bankası olarak politika riskine daha açık. Temettü beklentisi destekleyici.", risk: "BDDK düzenlemeleri" },
      { symbol: "ISCTR.IS", action: "SELL",  confidence: 68, target_price: 11.80,  stop_loss: 13.60,  key_insight: "Düşen hacim ve zayıflayan teknik görünüm endişe verici. Sektör ortalamasının belirgin altında.", risk: "Yüksek takipteki kredi oranı riski" },
      { symbol: "VAKBN.IS", action: "HOLD",  confidence: 58, target_price: 33.50,  stop_loss: 28.50,  key_insight: "Kamu destekli yapısı riski sınırlıyor ancak büyüme potansiyeli sınırlı.", risk: "Faiz marjı baskısı" },
      { symbol: "YKBNK.IS", action: "BUY",   confidence: 75, target_price: 36.00,  stop_loss: 32.00,  key_insight: "Sektörde en güçlü momentum. Hacim artışı ve EMA20 üzerinde kapanış olumlu.", risk: "Genel piyasa duyarlılığı" },
    ],
  },
  {
    id: 2,
    agent: "Bankacılık Ajanı",
    agent_key: "banking_agent",
    created_at: "2026-04-01T17:45:00",
    sector_signal: "NEUTRAL" as "BULLISH" | "BEARISH" | "NEUTRAL",
    sector_summary: "Kapanış seansında bankacılık hisseleri karışık bir tablo sergiledi. Gün içi kar satışları kısmi değer kayıplarına yol açarken sektör genelinde işlem hacmi normalin altında kaldı. RSI değerleri 35-45 arasında konsolide bir bölgeye işaret ediyor.",
    top_pick: "GARAN.IS",
    avoid: "HALKB.IS",
    macro_risks: [
      "Küresel risk iştahındaki dalgalanmalar",
      "TL mevduat faizlerindeki yüksek seyir ve maliyet baskısı",
    ],
    opportunity: "Kısa vadeli düzeltme, orta vadeli pozisyon için alım fırsatı sunabilir. Seçici yaklaşım öneriliyor.",
    stocks: [
      { symbol: "AKBNK.IS", action: "HOLD",  confidence: 60, target_price: 71.00,  stop_loss: 63.50,  key_insight: "Güne nötr kapandı. Bekle-gör pozisyonu uygun.", risk: "Likidite sıkışması" },
      { symbol: "GARAN.IS", action: "BUY",   confidence: 71, target_price: 138.00, stop_loss: 121.00, key_insight: "Kapanışta güçlü alım ilgisi dikkat çekici.", risk: "Döviz kuru riski" },
      { symbol: "HALKB.IS", action: "WATCH", confidence: 48, target_price: 37.00,  stop_loss: 32.50,  key_insight: "Zayıf kapanış ve düşen hacim izleme listesine alındı.", risk: "Politika riski" },
      { symbol: "ISCTR.IS", action: "HOLD",  confidence: 55, target_price: 13.00,  stop_loss: 12.00,  key_insight: "Günü düşüşle kapattı, teknik destek bölgesinde.", risk: "Kötüleşen NPL oranları" },
      { symbol: "VAKBN.IS", action: "HOLD",  confidence: 57, target_price: 32.50,  stop_loss: 28.00,  key_insight: "Ortalama bir kapanış. Temettü getirisi cazip.", risk: "Kredi büyüme yavaşlaması" },
      { symbol: "YKBNK.IS", action: "BUY",   confidence: 72, target_price: 35.50,  stop_loss: 31.50,  key_insight: "Güne güçlü başlayıp kapanışa yakın hafif geriledi. Genel tablo olumlu.", risk: "Sektör geneli satış baskısı" },
    ],
  },
];

const ACTIONS   = ["Tümü", "BUY", "SELL", "HOLD", "WATCH"];
const STATUSES  = ["Tümü", "active", "closed", "simulated"];
const SESSIONS  = ["Tümü", "morning", "noon", "close"];

type Tab = "recommendations" | "agent_reports";

export default function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>("recommendations");
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  // Filtreler
  const [action, setAction]   = useState("Tümü");
  const [status, setStatus]   = useState("Tümü");
  const [session, setSession] = useState("Tümü");
  const [symbol, setSymbol]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    getRecommendations({
      action:  action  !== "Tümü" ? action  : undefined,
      status:  status  !== "Tümü" ? status  : undefined,
      session: session !== "Tümü" ? session : undefined,
      symbol:  symbol  || undefined,
      limit: 100,
    }).then(setRecs).catch(console.error).finally(() => setLoading(false));
  }, [action, status, session, symbol]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      <Sidebar />

      {/* İçerik */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold">Öneriler & Ajan Raporları</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">AI önerileri, ajan analizleri ve gerçekleşen sonuçlar</p>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("recommendations")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "recommendations"
                ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Brain size={14} /> AI Önerileri
          </button>
          <button
            onClick={() => setTab("agent_reports")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "agent_reports"
                ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Landmark size={14} /> Ajan Raporları
            <span className="text-[10px] font-mono bg-[var(--accent-green)]/10 text-[var(--accent-green)] px-1.5 py-0.5 rounded-full">
              {DUMMY_AGENT_REPORTS.length}
            </span>
          </button>
        </div>

        {/* Filtreler — sadece AI Önerileri sekmesinde */}
        {tab === "recommendations" && <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text-muted)]">Hisse</label>
            <div className="relative">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="THYAO"
                className="w-28 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)]"
              />
              {symbol && (
                <button onClick={() => setSymbol("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {[
            { label: "İşlem",    value: action,  set: setAction,  opts: ACTIONS },
            { label: "Durum",    value: status,  set: setStatus,  opts: STATUSES },
            { label: "Seans",    value: session, set: setSession, opts: SESSIONS },
          ].map(({ label, value, set, opts }) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-muted)]">{label}</label>
              <select value={value} onChange={(e) => set(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)]">
                {opts.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}

          <div className="flex items-end">
            <span className="text-xs text-[var(--text-muted)] font-mono">{recs.length} sonuç</span>
          </div>
        </div>}

        {/* ── Ajan Raporları sekmesi ── */}
        {tab === "agent_reports" && (
          <div className="flex flex-col gap-4">
            {DUMMY_AGENT_REPORTS.map((report) => {
              const isExpanded = expandedReport === report.id;
              const signalColor =
                report.sector_signal === "BULLISH" ? "text-[var(--accent-green)] bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30" :
                report.sector_signal === "BEARISH" ? "text-[var(--accent-red)] bg-[var(--accent-red)]/10 border-[var(--accent-red)]/30" :
                "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
              const signalBorder =
                report.sector_signal === "BULLISH" ? "border-l-[var(--accent-green)]" :
                report.sector_signal === "BEARISH" ? "border-l-[var(--accent-red)]" :
                "border-l-yellow-400";

              return (
                <div key={report.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                  {/* Rapor başlığı */}
                  <div
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors border-l-4 ${signalBorder}`}
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Landmark size={16} className="text-[var(--accent-green)] flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{report.agent}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${signalColor}`}>
                            {report.sector_signal}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full font-mono">DEMO</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{fmtDate(report.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-[var(--text-muted)]">En İyi Seçim</p>
                        <p className="text-xs font-mono font-bold text-[var(--accent-green)]">{report.top_pick.replace(".IS","")}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-[var(--text-muted)]">Kaçınılacak</p>
                        <p className="text-xs font-mono font-bold text-[var(--accent-red)]">{report.avoid.replace(".IS","")}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                    </div>
                  </div>

                  {/* Rapor detayı */}
                  {isExpanded && (
                    <div className="px-5 py-4 border-t border-[var(--border)] flex flex-col gap-5">

                      {/* Sektör özeti */}
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{report.sector_summary}</p>

                      {/* Fırsat + Makro Riskler */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[var(--accent-green)]/5 border border-[var(--accent-green)]/20 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-[var(--accent-green)] uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Lightbulb size={10} /> Fırsat
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{report.opportunity}</p>
                        </div>
                        <div className="bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/20 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-[var(--accent-red)] uppercase tracking-wider mb-2 flex items-center gap-1">
                            <AlertTriangle size={10} /> Makro Riskler
                          </p>
                          <ul className="flex flex-col gap-1">
                            {report.macro_risks.map((r, i) => (
                              <li key={i} className="flex gap-1.5 text-xs text-[var(--text-muted)]">
                                <span className="text-[var(--accent-red)] flex-shrink-0">•</span>{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Hisse önerileri tablosu */}
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Hisse Analizleri</p>
                        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-hover)]">
                                {["Hisse","İşlem","Güven","Hedef","Stop","İçgörü","Risk"].map((h) => (
                                  <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {report.stocks.map((s) => {
                                const ActionIcon = s.action === "BUY" ? TrendingUp : s.action === "SELL" ? TrendingDown : Minus;
                                return (
                                  <tr key={s.symbol} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                                    <td className="px-3 py-2">
                                      <Link href={`/stocks/${s.symbol}`} className="font-mono font-bold hover:text-[var(--accent-green)]">
                                        {s.symbol.replace(".IS","")}
                                      </Link>
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 w-fit ${actionColor(s.action)}`}>
                                        <ActionIcon size={9} />{actionLabel(s.action)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-12 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                                          <div className="h-full rounded-full bg-[var(--accent-green)]" style={{ width: `${s.confidence}%` }} />
                                        </div>
                                        <span className="font-mono">{s.confidence}%</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[var(--accent-green)]">{fmtPrice(s.target_price)}</td>
                                    <td className="px-3 py-2 font-mono text-[var(--accent-red)]">{fmtPrice(s.stop_loss)}</td>
                                    <td className="px-3 py-2 text-[var(--text-muted)] max-w-xs">{s.key_insight}</td>
                                    <td className="px-3 py-2 text-[var(--text-muted)]">{s.risk}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tablo — sadece AI Önerileri sekmesinde */}
        {tab === "recommendations" && <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">Yükleniyor...</div>
          ) : recs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">Sonuç bulunamadı.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  {["","Tarih","Hisse","İşlem","Fiyat","Hedef","Stop","Güven","Süre","Seans","Durum","Sonuç"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {expanded === r.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/stocks/${r.symbol}`} onClick={(e) => e.stopPropagation()}
                          className="font-mono font-bold hover:text-[var(--accent-green)]">
                          {r.symbol.replace(".IS", "")}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${actionColor(r.action)}`}>
                          {actionLabel(r.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{fmtPrice(r.price_at_recommendation)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--accent-green)]">{r.target_price ? fmtPrice(r.target_price) : "—"}</td>
                      <td className="px-4 py-3 font-mono text-[var(--accent-red)]">{r.stop_loss ? fmtPrice(r.stop_loss) : "—"}</td>
                      <td className="px-4 py-3 font-mono">{r.confidence_score}%</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{r.time_horizon}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{sessionLabel(r.session)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          r.status === "active"    ? "bg-blue-400/10 text-blue-400" :
                          r.status === "closed"    ? "bg-[var(--neutral)]/20 text-[var(--neutral)]" :
                          r.status === "simulated" ? "bg-yellow-400/10 text-yellow-400" :
                          "text-[var(--text-muted)]"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.performance ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono font-bold ${pctColor(r.performance.return_pct)}`}>
                              {fmtPct(r.performance.return_pct)}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              r.performance.is_successful === true  ? "bg-[var(--accent-green)]" :
                              r.performance.is_successful === false ? "bg-[var(--accent-red)]" :
                              "bg-[var(--neutral)]"}`}
                            />
                          </div>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    </tr>

                    {/* Expanded detay drawer */}
                    {expanded === r.id && (
                      <tr className="bg-[var(--bg-hover)]">
                        <td colSpan={12} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Gerekçe */}
                            <div>
                              <p className="text-xs font-semibold text-[var(--accent-green)] mb-2">AI Gerekçesi</p>
                              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                {r.reasoning ?? "Gerekçe mevcut değil."}
                              </p>
                            </div>
                            {/* Sinyaller + Riskler */}
                            <div className="flex flex-col gap-3">
                              {r.key_signals && r.key_signals.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">Temel Sinyaller</p>
                                  <div className="flex flex-wrap gap-1">
                                    {r.key_signals.map((s, i) => (
                                      <span key={i} className="text-xs bg-[var(--accent-green)]/10 text-[var(--accent-green)] px-2 py-0.5 rounded-full">{s}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.risks && r.risks.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">Riskler</p>
                                  <div className="flex flex-wrap gap-1">
                                    {r.risks.map((risk, i) => (
                                      <span key={i} className="text-xs bg-[var(--accent-red)]/10 text-[var(--accent-red)] px-2 py-0.5 rounded-full">{risk}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.performance && (
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {[
                                    { label: "Maks Kazanç", val: fmtPct(r.performance.max_gain_pct), color: "text-[var(--accent-green)]" },
                                    { label: "Maks Kayıp",  val: fmtPct(r.performance.max_loss_pct),  color: "text-[var(--accent-red)]" },
                                    { label: "Gün Tutuldu", val: `${r.performance.days_held ?? "—"} gün`, color: "" },
                                  ].map(({ label, val, color }) => (
                                    <div key={label} className="bg-[var(--bg-card)] rounded-lg p-2">
                                      <p className="text-[var(--text-muted)]">{label}</p>
                                      <p className={`font-mono font-bold mt-0.5 ${color}`}>{val}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>}
      </main>
    </div>
  );
}
