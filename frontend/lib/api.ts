import axios from "axios";
import type {
  Stock, Snapshot, Recommendation, PerformanceSummary,
  StockPerformance, LearningLog, OHLCV, MarketOverview, SchedulerStatus,
  Notification,
} from "./types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  timeout: 15000,
});

// ── Stocks ────────────────────────────────────────────────────────────────────

export const getStocks = (sector?: string) =>
  api.get<Stock[]>("/api/stocks", { params: { sector } }).then((r) => r.data);

export const getStock = (symbol: string) =>
  api.get<Stock & { latest_snapshot: Snapshot | null }>(`/api/stocks/${symbol}`).then((r) => r.data);

export const getStockHistory = (symbol: string, period = "3mo", interval = "1d") =>
  api.get<OHLCV[]>(`/api/stocks/${symbol}/history`, { params: { period, interval } }).then((r) => r.data);

export const getStockSnapshots = (symbol: string, limit = 30) =>
  api.get<Snapshot[]>(`/api/stocks/${symbol}/snapshots`, { params: { limit } }).then((r) => r.data);

export const getStockRecommendations = (symbol: string, limit = 20) =>
  api.get<Recommendation[]>(`/api/stocks/${symbol}/recommendations`, { params: { limit } }).then((r) => r.data);

export const getSectors = () =>
  api.get<string[]>("/api/stocks/sectors").then((r) => r.data);

// ── Recommendations ───────────────────────────────────────────────────────────

export const getRecommendations = (params?: {
  symbol?: string; action?: string; status?: string;
  session?: string; date_from?: string; date_to?: string; limit?: number;
}) => api.get<Recommendation[]>("/api/recommendations", { params }).then((r) => r.data);

export const getActiveRecommendations = () =>
  api.get<Recommendation[]>("/api/recommendations/active").then((r) => r.data);

export const getRecommendation = (id: number) =>
  api.get<Recommendation>(`/api/recommendations/${id}`).then((r) => r.data);

export const closeRecommendation = (id: number) =>
  api.post(`/api/recommendations/${id}/close`).then((r) => r.data);

// ── Performance ───────────────────────────────────────────────────────────────

export const getPerformanceSummary = (days = 30) =>
  api.get<PerformanceSummary>("/api/performance/summary", { params: { days } }).then((r) => r.data);

export const getPerformanceByStock = () =>
  api.get<StockPerformance[]>("/api/performance/by-stock").then((r) => r.data);

export const getPerformanceBySession = () =>
  api.get<StockPerformance[]>("/api/performance/by-session").then((r) => r.data);

export const getCumulativeReturns = () =>
  api.get<Array<{ date: string; cumulative_value: number }>>("/api/performance/cumulative").then((r) => r.data);

export const getTopRecommendations = (limit = 10, worst = false) =>
  api.get("/api/performance/top", { params: { limit, worst } }).then((r) => r.data);

// ── Learning ──────────────────────────────────────────────────────────────────

export const getLearningLogs = (limit = 20) =>
  api.get<LearningLog[]>("/api/learning/logs", { params: { limit } }).then((r) => r.data);

export const getLearningPatterns = () =>
  api.get<LearningLog[]>("/api/learning/patterns").then((r) => r.data);

export const getLatestEvaluation = () =>
  api.get<LearningLog | { message: string }>("/api/learning/latest").then((r) => r.data);

// ── Market ────────────────────────────────────────────────────────────────────

export const getMarketOverview = () =>
  api.get<MarketOverview>("/api/market/overview").then((r) => r.data);

export const getSectorHeatmap = () =>
  api.get<Array<{ sector: string; avg_change_pct: number; stock_count: number }>>("/api/market/heatmap").then((r) => r.data);

export const getMarketIndices = () =>
  api.get<Array<{ symbol: string; name: string; close: number | null; change_pct: number | null }>>("/api/market/indices").then((r) => r.data);

export const getLivePrices = () =>
  api.get<Array<{ symbol: string; close: number | null; change_pct: number | null }>>("/api/stocks/live-prices").then((r) => r.data);

export const getLivePrice = (symbol: string) =>
  api.get<{ symbol: string; close: number; change_pct: number; prev_close: number; day_high: number | null; day_low: number | null; volume: number | null }>(`/api/stocks/${symbol}/live`).then((r) => r.data);

// ── Scanner ───────────────────────────────────────────────────────────────────

export const triggerScan = (session = "manual") =>
  api.post("/api/scanner/run", null, { params: { session } }).then((r) => r.data);

export const getScannerStatus = () =>
  api.get<SchedulerStatus>("/api/scanner/status").then((r) => r.data);

export const getScanHistory = (limit = 20) =>
  api.get("/api/scanner/history", { params: { limit } }).then((r) => r.data);

// ── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications = (unread_only = false, limit = 50) =>
  api.get<Notification[]>("/api/notifications", { params: { unread_only, limit } }).then((r) => r.data);

export const getUnreadCount = () =>
  api.get<{ count: number }>("/api/notifications/unread-count").then((r) => r.data);

export const markRead = (id: number) =>
  api.post(`/api/notifications/${id}/read`).then((r) => r.data);

export const markAllRead = () =>
  api.post("/api/notifications/read-all").then((r) => r.data);
