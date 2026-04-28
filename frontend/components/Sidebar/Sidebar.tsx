"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, BarChart2, History, GraduationCap, Search } from "lucide-react";
import { getStocks, getActiveRecommendations, getMarketIndices, getLivePrices } from "@/lib/api";
import type { Stock, Recommendation } from "@/lib/types";
import StockCard from "@/components/StockCard/StockCard";

function Sk({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-[var(--border)] animate-pulse`} />;
}

export default function Sidebar() {
  const pathname = usePathname();

  const [stocks, setStocks]           = useState<Stock[]>([]);
  const [activeRecs, setActiveRecs]   = useState<Recommendation[]>([]);
  const [indices, setIndices]         = useState<Array<{ symbol: string; name: string; close: number | null; change_pct: number | null }>>([]);
  const [livePrices, setLivePrices]   = useState<Record<string, { close: number; change_pct: number }>>({});
  const [search, setSearch]           = useState("");
  const [sectorFilter, setSectorFilter] = useState("Tümü");
  const [loadingStocks, setLoadingStocks]         = useState(true);
  const [loadingIndices, setLoadingIndices]       = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(true);

  useEffect(() => {
    getStocks().then(setStocks).catch(console.error).finally(() => setLoadingStocks(false));
    getActiveRecommendations().then(setActiveRecs).catch(console.error);
    getMarketIndices().then(setIndices).catch(console.error).finally(() => setLoadingIndices(false));

    const applyLive = (lp: Array<{ symbol: string; close: number | null; change_pct: number | null }>) => {
      const m: Record<string, { close: number; change_pct: number }> = {};
      lp.forEach((p) => { if (p.close != null && p.change_pct != null) m[p.symbol] = { close: p.close, change_pct: p.change_pct }; });
      setLivePrices(m);
    };
    getLivePrices().then(applyLive).catch(() => {}).finally(() => setLoadingLivePrices(false));

    const id = setInterval(() => {
      getMarketIndices().then(setIndices).catch(() => {});
      getLivePrices().then(applyLive).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const activeSymbols = new Set(activeRecs.map((r) => r.symbol));
  const sectors = ["Tümü", ...Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean) as string[])).sort()];
  const filteredStocks = stocks.filter((s) => {
    const matchSearch = search === "" || s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase());
    const matchSector = sectorFilter === "Tümü" || s.sector === sectorFilter;
    return matchSearch && matchSector;
  });

  const navItems = [
    { href: "/",                label: "Dashboard",  icon: BarChart2 },
    { href: "/recommendations", label: "Öneriler",   icon: Brain },
    { href: "/performance",     label: "Performans", icon: History },
    { href: "/learning",        label: "AI Öğrenme", icon: GraduationCap },
  ];

  return (
    <aside className="w-72 flex-shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-[var(--accent-green)]" />
          <span className="font-mono font-bold text-[var(--text-primary)]">BIST30 AI</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Gemini Destekli Analiz</p>
      </div>

      {/* Nav */}
      <nav className="p-3 border-b border-[var(--border)] flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "text-[var(--accent-green)] bg-[var(--accent-green)]/10 font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}>
              <Icon size={15} /> {label}
            </Link>
          );
        })}
      </nav>

      {/* Endeks widget */}
      <div className="p-3 border-b border-[var(--border)] flex flex-col gap-1.5">
        {loadingIndices
          ? [1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[var(--bg-hover)]">
                <Sk w="w-16" h="h-3" />
                <div className="flex flex-col items-end gap-1"><Sk w="w-14" h="h-3" /><Sk w="w-10" h="h-2" /></div>
              </div>
            ))
          : indices.map((idx) => (
              <div key={idx.symbol} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[var(--bg-hover)]">
                <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{idx.name}</span>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-mono text-[var(--text-primary)]">
                    {idx.close != null ? idx.close.toLocaleString("tr-TR") : "—"}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${
                    idx.change_pct == null ? "text-[var(--text-muted)]" :
                    idx.change_pct >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                  }`}>
                    {idx.change_pct != null ? `${idx.change_pct >= 0 ? "+" : ""}${idx.change_pct.toFixed(2)}%` : "—"}
                  </span>
                </div>
              </div>
            ))
        }
      </div>

      {/* Arama & filtre */}
      <div className="p-3 border-b border-[var(--border)] flex flex-col gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hisse ara..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)]" />
        </div>
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)]">
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Hisse listesi */}
      <div className="flex-1 overflow-y-auto p-2">
        {(loadingStocks || loadingLivePrices)
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-1.5 h-8 rounded-full bg-[var(--border)] animate-pulse" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Sk w="w-14" h="h-3" />
                    <Sk w="w-24" h="h-2" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Sk w="w-12" h="h-3" />
                  <Sk w="w-10" h="h-2" />
                </div>
              </div>
            ))
          : filteredStocks.length === 0
            ? <div className="p-4 text-xs text-[var(--text-muted)] text-center">Sonuç bulunamadı.</div>
            : filteredStocks.map((s) => (
                <StockCard key={s.symbol} stock={s} hasActiveRec={activeSymbols.has(s.symbol)} livePrice={livePrices[s.symbol] ?? null} />
              ))
        }
      </div>
    </aside>
  );
}
