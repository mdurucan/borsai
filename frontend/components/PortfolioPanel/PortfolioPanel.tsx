"use client";
import { useState, useEffect } from "react";
import { Wallet, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { fmtPrice } from "@/lib/utils";

interface Position {
  id: string;
  lots: number;
  avgCost: number; // TL
  date: string;    // YYYY-MM-DD
}

interface Props {
  symbol: string;
  currentPrice: number | null;
}

function StorageKey(symbol: string) {
  return `portfolio_${symbol}`;
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function PortfolioPanel({ symbol, currentPrice }: Props) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [adding, setAdding]       = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);

  // Form state
  const [lots, setLots]         = useState("");
  const [cost, setCost]         = useState("");
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));

  // localStorage'dan yükle
  useEffect(() => {
    try {
      const raw = localStorage.getItem(StorageKey(symbol));
      if (raw) setPositions(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [symbol]);

  function save(next: Position[]) {
    setPositions(next);
    localStorage.setItem(StorageKey(symbol), JSON.stringify(next));
  }

  function resetForm() {
    setLots(""); setCost(""); setDate(new Date().toISOString().slice(0, 10));
    setAdding(false); setEditId(null);
  }

  function handleAdd() {
    const l = parseFloat(lots);
    const c = parseFloat(cost);
    if (!l || !c || l <= 0 || c <= 0) return;
    save([...positions, { id: genId(), lots: l, avgCost: c, date }]);
    resetForm();
  }

  function handleEdit(p: Position) {
    setEditId(p.id);
    setLots(String(p.lots));
    setCost(String(p.avgCost));
    setDate(p.date);
    setAdding(false);
  }

  function handleSaveEdit() {
    const l = parseFloat(lots);
    const c = parseFloat(cost);
    if (!l || !c || l <= 0 || c <= 0) return;
    save(positions.map((p) => p.id === editId ? { ...p, lots: l, avgCost: c, date } : p));
    resetForm();
  }

  function handleDelete(id: string) {
    save(positions.filter((p) => p.id !== id));
  }

  // Hesaplamalar
  const totalLots    = positions.reduce((s, p) => s + p.lots, 0);
  const totalCost    = positions.reduce((s, p) => s + p.lots * p.avgCost, 0);
  const avgCostAll   = totalLots > 0 ? totalCost / totalLots : 0;
  const currentValue = currentPrice != null ? totalLots * currentPrice : null;
  const pnl          = currentValue != null ? currentValue - totalCost : null;
  const pnlPct       = totalCost > 0 && pnl != null ? (pnl / totalCost) * 100 : null;

  const isPositive = (pnl ?? 0) >= 0;

  const inputCls = "w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] font-mono";

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-4">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Wallet size={14} className="text-[var(--accent-green)]" />
          Portföyüm
        </h4>
        {!adding && !editId && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-[var(--accent-green)] hover:opacity-80 transition-opacity">
            <Plus size={13} /> Alım Ekle
          </button>
        )}
      </div>

      {/* Özet — sadece pozisyon varsa */}
      {positions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg-hover)] rounded-lg p-2.5">
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Toplam Lot</p>
            <p className="font-mono font-bold text-sm">{totalLots.toLocaleString("tr-TR")}</p>
          </div>
          <div className="bg-[var(--bg-hover)] rounded-lg p-2.5">
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Ort. Maliyet</p>
            <p className="font-mono font-bold text-sm">{fmtPrice(avgCostAll)}</p>
          </div>
          <div className="bg-[var(--bg-hover)] rounded-lg p-2.5">
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Toplam Maliyet</p>
            <p className="font-mono font-bold text-sm">{fmtPrice(totalCost)}</p>
          </div>
          <div className="bg-[var(--bg-hover)] rounded-lg p-2.5">
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Güncel Değer</p>
            <p className="font-mono font-bold text-sm">
              {currentValue != null ? fmtPrice(currentValue) : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Kar/Zarar — büyük gösterim */}
      {positions.length > 0 && pnl != null && (
        <div className={`rounded-xl p-4 border ${
          isPositive
            ? "bg-[var(--accent-green)]/5 border-[var(--accent-green)]/20"
            : "bg-[var(--accent-red)]/5 border-[var(--accent-red)]/20"
        }`}>
          <p className="text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wider">
            {isPositive ? "Kâr" : "Zarar"}
          </p>
          <p className={`font-mono text-xl font-bold ${isPositive ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
            {isPositive ? "+" : ""}{fmtPrice(pnl)}
          </p>
          {pnlPct != null && (
            <p className={`font-mono text-sm font-semibold mt-0.5 ${isPositive ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
              {isPositive ? "+" : ""}{pnlPct.toFixed(2)}%
            </p>
          )}
          {currentPrice != null && avgCostAll > 0 && (
            <p className="text-[10px] text-[var(--text-muted)] mt-2">
              Maliyet {fmtPrice(avgCostAll)} → Güncel {fmtPrice(currentPrice)}
            </p>
          )}
        </div>
      )}

      {/* Alım listesi */}
      {positions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Alımlar</p>
          {positions.map((p) => {
            const pVal   = currentPrice != null ? p.lots * currentPrice : null;
            const pCost  = p.lots * p.avgCost;
            const pPnl   = pVal != null ? pVal - pCost : null;
            const pPct   = pPnl != null && pCost > 0 ? (pPnl / pCost) * 100 : null;
            const pos    = (pPnl ?? 0) >= 0;

            if (editId === p.id) {
              return (
                <div key={p.id} className="rounded-lg border border-[var(--accent-green)]/30 bg-[var(--bg-hover)] p-3 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)]">Lot</label>
                      <input value={lots} onChange={(e) => setLots(e.target.value)} type="number" min="1" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)]">Maliyet (₺)</label>
                      <input value={cost} onChange={(e) => setCost(e.target.value)} type="number" min="0.01" step="0.01" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)]">Tarih</label>
                    <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={inputCls} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={resetForm} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"><X size={13} /></button>
                    <button onClick={handleSaveEdit} className="p-1.5 rounded-lg text-[var(--accent-green)] hover:bg-[var(--accent-green)]/10 transition-colors"><Check size={13} /></button>
                  </div>
                </div>
              );
            }

            return (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--bg-hover)] group">
                <div>
                  <p className="font-mono text-xs font-semibold">
                    {p.lots.toLocaleString("tr-TR")} lot · {fmtPrice(p.avgCost)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">{p.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  {pPnl != null && (
                    <div className="text-right">
                      <p className={`font-mono text-xs font-bold ${pos ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                        {pos ? "+" : ""}{fmtPrice(pPnl)}
                      </p>
                      {pPct != null && (
                        <p className={`text-[10px] font-mono ${pos ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                          {pos ? "+" : ""}{pPct.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(p)} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"><Edit2 size={12} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alım ekleme formu */}
      {adding && (
        <div className="rounded-lg border border-[var(--accent-green)]/30 bg-[var(--bg-hover)] p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--accent-green)]">Yeni Alım</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">Lot</label>
              <input value={lots} onChange={(e) => setLots(e.target.value)} type="number" min="1" placeholder="100" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">Maliyet (₺/lot)</label>
              <input value={cost} onChange={(e) => setCost(e.target.value)} type="number" min="0.01" step="0.01" placeholder="68.50" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">Alım Tarihi</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={inputCls} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors">İptal</button>
            <button onClick={handleAdd} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--accent-green)]/15 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 font-semibold transition-colors">Kaydet</button>
          </div>
        </div>
      )}

      {/* Boş durum */}
      {positions.length === 0 && !adding && (
        <div className="text-center py-4">
          <p className="text-xs text-[var(--text-muted)]">Henüz alım eklenmedi.</p>
          <button onClick={() => setAdding(true)}
            className="mt-2 text-xs text-[var(--accent-green)] hover:underline">
            + İlk alımı ekle
          </button>
        </div>
      )}
    </div>
  );
}
