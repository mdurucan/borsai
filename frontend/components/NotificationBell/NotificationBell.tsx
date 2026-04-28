"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, X, CheckCheck, TrendingUp, TrendingDown, Info } from "lucide-react";
import Link from "next/link";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

export default function NotificationBell() {
  const [open, setOpen]             = useState(false);
  const [notes, setNotes]           = useState<Notification[]>([]);
  const [unread, setUnread]         = useState(0);
  const [selected, setSelected]     = useState<Notification | null>(null);
  const dropdownRef                 = useRef<HTMLDivElement>(null);

  // Okunmamış sayısını 30sn'de bir yokla
  useEffect(() => {
    const fetchCount = () =>
      getUnreadCount().then((d) => setUnread(d.count)).catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, []);

  // Dropdown açılınca bildirimleri yükle
  useEffect(() => {
    if (open) {
      getNotifications(false, 30).then(setNotes).catch(() => {});
    }
  }, [open]);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleMarkRead(id: number) {
    await markRead(id).catch(() => {});
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await markAllRead().catch(() => {});
    setNotes((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  function openNote(n: Notification) {
    setSelected(n);
    if (!n.is_read) handleMarkRead(n.id);
  }

  function actionIcon(action: string | null) {
    if (action === "BUY" || action === "BULLISH")
      return <TrendingUp size={13} className="text-[var(--accent-green)] flex-shrink-0" />;
    if (action === "SELL" || action === "BEARISH")
      return <TrendingDown size={13} className="text-[var(--accent-red)] flex-shrink-0" />;
    return <Info size={13} className="text-yellow-400 flex-shrink-0" />;
  }

  function actionBorder(action: string | null) {
    if (action === "BUY" || action === "BULLISH") return "border-l-[var(--accent-green)]";
    if (action === "SELL" || action === "BEARISH") return "border-l-[var(--accent-red)]";
    return "border-l-yellow-400";
  }

  type ScanRec = { symbol: string; action: string; confidence: number; price: number; target: number | null; stop: number | null };
  type Meta = {
    current_price?: number | null;
    target_price?: number | null;
    stop_loss?: number | null;
    top_pick?: string | null;
    avoid?: string | null;
    opportunity?: string | null;
    risk?: string | null;
    macro_risks?: string[];
    // Scanner bildirimi
    session?: string;
    scanned?: number;
    errors?: number;
    recommendations?: number;
    buy_count?: number;
    sell_count?: number;
    watch_count?: number;
    all_recs?: ScanRec[];
  };
  const meta = selected?.meta as Meta | null;
  const isScannerNote = selected?.source === "scanner";

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Çan butonu */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {unread > 0
            ? <BellRing size={18} className="text-[var(--accent-green)]" />
            : <Bell size={18} />
          }
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--accent-red)] text-white text-[10px] font-bold flex items-center justify-center font-mono">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute right-0 top-10 w-96 max-h-[520px] flex flex-col rounded-xl border border-[var(--border)] shadow-2xl z-50"
            style={{ background: "var(--bg-card)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-sm font-semibold">Bildirimler</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-green)] flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck size={12} /> Tümünü oku
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Liste */}
            <div className="overflow-y-auto flex-1">
              {notes.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                  <Bell size={20} className="mx-auto mb-2 opacity-40" />
                  Henüz bildirim yok.
                </div>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b border-[var(--border)]/50 border-l-2 transition-colors cursor-pointer hover:bg-[var(--bg-hover)]/60 ${
                      actionBorder(n.action)
                    } ${n.is_read ? "opacity-60" : "bg-[var(--bg-hover)]/40"}`}
                    onClick={() => openNote(n)}
                  >
                    <div className="mt-0.5">{actionIcon(n.action)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-snug ${n.is_read ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {n.created_at ? fmtDate(n.created_at) : ""}
                        </span>
                        {n.symbol && (
                          <Link
                            href={`/stocks/${n.symbol}`}
                            onClick={() => setOpen(false)}
                            className="text-[10px] text-[var(--accent-green)] hover:underline"
                          >
                            {n.symbol.replace(".IS", "")} →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">
                🏦 Bankacılık Ajanı aktif — 09:15 & 17:45 çalışır
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {notes.length} bildirim
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bildirim Detay Modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col"
            style={{ background: "var(--bg-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-start justify-between gap-3 p-5 border-b border-[var(--border)] border-l-4 rounded-tl-2xl ${actionBorder(selected.action)}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{actionIcon(selected.action)}</div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)] leading-snug">{selected.title}</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {selected.created_at ? fmtDate(selected.created_at) : ""}
                    {selected.symbol && (
                      <> · <Link href={`/stocks/${selected.symbol}`} onClick={() => setSelected(null)} className="text-[var(--accent-green)] hover:underline">{selected.symbol.replace(".IS", "")}</Link></>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex-shrink-0 mt-0.5">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">

              {/* ── Tarama özeti (scanner bildirimi) ── */}
              {isScannerNote && meta?.all_recs && meta.all_recs.length > 0 ? (
                <>
                  {/* İstatistik satırı */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Taranan", value: meta.scanned ?? "—", color: "text-[var(--text-primary)]" },
                      { label: "AL", value: meta.buy_count ?? 0, color: "text-[var(--accent-green)]" },
                      { label: "SAT", value: meta.sell_count ?? 0, color: "text-[var(--accent-red)]" },
                      { label: "İZLE", value: meta.watch_count ?? 0, color: "text-yellow-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[var(--bg-hover)] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</p>
                        <p className={`font-mono font-bold text-base ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Öneri kartları */}
                  <div className="flex flex-col gap-2">
                    {meta.all_recs
                      .sort((a, b) => ({"BUY":0,"SELL":1,"WATCH":2,"HOLD":3}[a.action]??4) - ({"BUY":0,"SELL":1,"WATCH":2,"HOLD":3}[b.action]??4) || b.confidence - a.confidence)
                      .map((r) => {
                        const em = { BUY: "📈", SELL: "📉", WATCH: "👁", HOLD: "⏸" }[r.action] ?? "•";
                        const accentColor = r.action === "BUY" ? "var(--accent-green)" : r.action === "SELL" ? "var(--accent-red)" : "#FBBF24";
                        return (
                          <div key={r.symbol} className="flex items-center justify-between rounded-lg px-3 py-2.5 border border-[var(--border)] bg-[var(--bg-hover)]/50">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{em}</span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Link href={`/stocks/${r.symbol}`} onClick={() => setSelected(null)}
                                    className="font-mono font-bold text-sm hover:underline" style={{ color: accentColor }}>
                                    {r.symbol.replace(".IS", "")}
                                  </Link>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${accentColor}20`, color: accentColor }}>
                                    {r.action}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)]">{r.price?.toFixed(2)} ₺ giriş</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col gap-0.5">
                              {r.target && <p className="text-[10px] font-mono text-[var(--accent-green)]">H: {r.target.toFixed(2)} ₺</p>}
                              {r.stop  && <p className="text-[10px] font-mono text-[var(--accent-red)]">S: {r.stop.toFixed(2)} ₺</p>}
                              <p className="text-[10px] font-mono text-[var(--text-muted)]">%{r.confidence} güven</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Ham metin (detay) */}
                  <details className="text-xs text-[var(--text-muted)]">
                    <summary className="cursor-pointer hover:text-[var(--text-primary)] transition-colors">Gemini gerekçeleri (detay)</summary>
                    <pre className="mt-2 whitespace-pre-wrap leading-relaxed text-[11px] bg-[var(--bg-hover)] p-3 rounded-lg">{selected.body}</pre>
                  </details>
                </>
              ) : (
                /* Normal bildirim — düz metin */
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{selected.body}</p>
              )}

              {/* Fiyat bilgileri */}
              {meta && (meta.current_price != null || meta.target_price != null || meta.stop_loss != null) && (
                <div className="grid grid-cols-3 gap-3">
                  {meta.current_price != null && (
                    <div className="bg-[var(--bg-hover)] rounded-lg p-3 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-1">Fiyat</p>
                      <p className="font-mono font-bold text-sm">{meta.current_price} ₺</p>
                    </div>
                  )}
                  {meta.target_price != null && (
                    <div className="bg-[var(--accent-green)]/5 border border-[var(--accent-green)]/20 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-1">Hedef</p>
                      <p className="font-mono font-bold text-sm text-[var(--accent-green)]">{meta.target_price} ₺</p>
                    </div>
                  )}
                  {meta.stop_loss != null && (
                    <div className="bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/20 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-[var(--text-muted)] mb-1">Stop</p>
                      <p className="font-mono font-bold text-sm text-[var(--accent-red)]">{meta.stop_loss} ₺</p>
                    </div>
                  )}
                </div>
              )}

              {/* Güven skoru */}
              {selected.confidence != null && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)]">Güven Skoru</span>
                    <span className="font-mono font-bold">{selected.confidence}%</span>
                  </div>
                  <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${selected.confidence}%`,
                        background: selected.confidence >= 75 ? "var(--accent-green)" : selected.confidence >= 55 ? "#FBBF24" : "var(--accent-red)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Sektör bildirimi meta */}
              {meta?.top_pick && (
                <div className="flex gap-3">
                  <div className="flex-1 bg-[var(--accent-green)]/5 border border-[var(--accent-green)]/20 rounded-lg p-3">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">En İyi Seçim</p>
                    <p className="font-mono font-bold text-[var(--accent-green)]">{meta.top_pick?.replace(".IS", "")}</p>
                  </div>
                  {meta.avoid && (
                    <div className="flex-1 bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/20 rounded-lg p-3">
                      <p className="text-[10px] text-[var(--text-muted)] mb-1">Kaçınılacak</p>
                      <p className="font-mono font-bold text-[var(--accent-red)]">{meta.avoid?.replace(".IS", "")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Fırsat */}
              {meta?.opportunity && (
                <div className="bg-[var(--bg-hover)] rounded-lg p-3">
                  <p className="text-[10px] text-[var(--accent-green)] font-semibold mb-1 uppercase tracking-wider">Fırsat</p>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">{meta.opportunity}</p>
                </div>
              )}

              {/* Risk */}
              {meta?.risk && (
                <div className="bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/10 rounded-lg p-3">
                  <p className="text-[10px] text-[var(--accent-red)] font-semibold mb-1 uppercase tracking-wider">Risk</p>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">{meta.risk}</p>
                </div>
              )}

              {/* Makro riskler listesi */}
              {meta?.macro_risks && meta.macro_risks.length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--accent-red)] font-semibold mb-2 uppercase tracking-wider">Makro Riskler</p>
                  <ul className="flex flex-col gap-1.5">
                    {meta.macro_risks.map((r, i) => (
                      <li key={i} className="flex gap-2 text-xs text-[var(--text-muted)] leading-relaxed">
                        <span className="text-[var(--accent-red)] mt-0.5 flex-shrink-0">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[var(--border)] flex justify-between items-center">
              <span className="text-[10px] text-[var(--text-muted)]">Kaynak: {selected.source}</span>
              {selected.symbol && (
                <Link
                  href={`/stocks/${selected.symbol}`}
                  onClick={() => setSelected(null)}
                  className="text-xs text-[var(--accent-green)] hover:underline font-semibold"
                >
                  {selected.symbol.replace(".IS", "")} detayına git →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
