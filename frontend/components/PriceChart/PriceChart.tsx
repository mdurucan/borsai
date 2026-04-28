"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import type { OHLCV, Snapshot } from "@/lib/types";

interface Props {
  data: OHLCV[];
  snapshots?: Snapshot[];
  height?: number;
}

export default function PriceChart({ data, snapshots = [], height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#111827" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "#1F2937" },
        horzLines: { color: "#1F2937" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#1F2937" },
      timeScale: {
        borderColor: "#1F2937",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Candlestick
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00D4A8",
      downColor: "#FF4560",
      borderUpColor: "#00D4A8",
      borderDownColor: "#FF4560",
      wickUpColor: "#00D4A8",
      wickDownColor: "#FF4560",
    });

    const candleData = data.map((d) => ({
      time: d.time.split("T")[0] as unknown as import("lightweight-charts").Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    // Hacim histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" as const },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeries.setData(
      data.map((d, i) => ({
        time: d.time.split("T")[0] as unknown as import("lightweight-charts").Time,
        value: d.volume,
        color: d.close >= (i > 0 ? data[i - 1].close : d.close) ? "rgba(0,212,168,0.3)" : "rgba(255,69,96,0.3)",
      }))
    );

    // EMA20 + EMA50 (snapshot verisinden)
    // Aynı gün içinde birden fazla snapshot olabilir (sabah/öğlen/kapanış).
    // lightweight-charts ascending+unique time zorunlu — her gün için son değeri al.
    function dedupByDay(
      snaps: typeof snapshots,
      getValue: (s: typeof snapshots[0]) => number | null
    ) {
      const map = new Map<string, number>();
      for (const s of snaps) {
        const day = s.timestamp.split("T")[0];
        const val = getValue(s);
        if (val != null) map.set(day, val); // sonraki üzerine yazar → günün son değeri
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, value]) => ({
          time: day as unknown as import("lightweight-charts").Time,
          value,
        }));
    }

    if (snapshots.length > 0) {
      const ema20Data = dedupByDay(snapshots, (s) => s.ema_20);
      const ema50Data = dedupByDay(snapshots, (s) => s.ema_50);

      if (ema20Data.length > 0) {
        const ema20Series = chart.addSeries(LineSeries, {
          color: "#FBBF24",
          lineWidth: 1,
          title: "EMA20",
        });
        ema20Series.setData(ema20Data);
      }

      if (ema50Data.length > 0) {
        const ema50Series = chart.addSeries(LineSeries, {
          color: "#818CF8",
          lineWidth: 1,
          title: "EMA50",
        });
        ema50Series.setData(ema50Data);
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, snapshots, height]);

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />;
}
