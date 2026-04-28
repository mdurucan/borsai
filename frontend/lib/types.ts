export type ActionType = "BUY" | "SELL" | "HOLD" | "WATCH";
export type SessionType = "morning" | "noon" | "close" | "manual";
export type TimeHorizon = "daily" | "weekly" | "monthly";
export type RecStatus = "active" | "closed" | "expired" | "simulated";
export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export interface Stock {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  is_active: boolean;
  latest_price: number | null;
  change_pct: number | null;
  last_updated: string | null;
}

export interface Snapshot {
  id: number;
  timestamp: string;
  session: SessionType;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  change_pct: number | null;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  ema_20: number | null;
  ema_50: number | null;
  sma_200: number | null;
  adx: number | null;
  atr: number | null;
  vwap: number | null;
  volume_ratio_20d: number | null;
  high_52w: number | null;
  low_52w: number | null;
  fib_382: number | null;
  fib_500: number | null;
  fib_618: number | null;
  performance_1d: number | null;
  performance_1w: number | null;
  performance_1m: number | null;
  performance_3m: number | null;
  performance_1y: number | null;
}

export interface Performance {
  return_pct: number | null;
  is_successful: boolean | null;
  days_held: number | null;
  max_gain_pct: number | null;
  max_loss_pct: number | null;
  target_hit: boolean | null;
  stop_loss_hit: boolean | null;
  evaluated_at: string;
}

export interface Recommendation {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  created_at: string;
  session: SessionType;
  action: ActionType;
  price_at_recommendation: number;
  target_price: number | null;
  stop_loss: number | null;
  confidence_score: number;
  time_horizon: TimeHorizon;
  reasoning: string | null;
  key_signals: string[] | null;
  risks: string[] | null;
  sector_outlook: string | null;
  bist30_relative: string | null;
  technical_signals: Record<string, number | null> | null;
  status: RecStatus;
  closed_at: string | null;
  performance?: Performance;
}

export interface PerformanceSummary {
  total: number;
  successful: number;
  failed: number;
  accuracy: number;
  avg_return_pct: number;
  period_days: number;
}

export interface StockPerformance {
  symbol: string;
  name: string;
  total: number;
  successful: number;
  accuracy: number;
  avg_return_pct: number;
}

export interface LearningLog {
  id: number;
  created_at: string;
  pattern_type: string;
  pattern_description: string;
  success_rate: number;
  sample_size: number;
  overall_accuracy: number | null;
  best_patterns: string[] | null;
  worst_patterns: string[] | null;
  learning_notes: string | null;
  adjusted_weights: Record<string, number> | null;
  market_regime: MarketRegime | null;
}

export interface OHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketOverview {
  stocks: Array<{
    symbol: string;
    name: string;
    sector: string | null;
    close: number | null;
    change_pct: number | null;
    volume: number | null;
    rsi_14: number | null;
  }>;
  top_gainers: MarketOverview["stocks"];
  top_losers: MarketOverview["stocks"];
  total_active: number;
}

export interface Notification {
  id: number;
  created_at: string;
  source: string;
  title: string;
  body: string;
  symbol: string | null;
  action: string | null;
  confidence: number | null;
  meta: Record<string, unknown> | null;
  is_read: boolean;
}

export interface SchedulerJob {
  id: string;
  name: string;
  next_run: string | null;
}

export interface SchedulerStatus {
  running: boolean;
  jobs: SchedulerJob[];
}
