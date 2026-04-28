export function fmt(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

export function fmtPct(val: number | null | undefined): string {
  if (val == null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export function fmtPrice(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function fmtVolume(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val);
}

export function fmtDate(iso: string): string {
  // Backend UTC döndürüyor ama Z/+00:00 eksik olabilir — normalize et
  const normalized = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(normalized).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export function pctColor(val: number | null | undefined): string {
  if (val == null) return "text-[var(--text-muted)]";
  return val >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]";
}

export function actionColor(action: string): string {
  switch (action) {
    case "BUY":   return "text-[var(--accent-green)] bg-[#00D4A815]";
    case "SELL":  return "text-[var(--accent-red)] bg-[#FF456015]";
    case "HOLD":  return "text-yellow-400 bg-yellow-400/10";
    case "WATCH": return "text-blue-400 bg-blue-400/10";
    default:      return "text-[var(--text-muted)]";
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case "BUY":   return "AL";
    case "SELL":  return "SAT";
    case "HOLD":  return "TUT";
    case "WATCH": return "İZLE";
    default:      return action;
  }
}

export function sessionLabel(session: string): string {
  switch (session) {
    case "morning": return "Sabah";
    case "noon":    return "Öğlen";
    case "close":   return "Kapanış";
    default:        return session;
  }
}
