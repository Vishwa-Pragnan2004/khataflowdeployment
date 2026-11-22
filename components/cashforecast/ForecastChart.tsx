"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { dayToDate } from "@/lib/cashforecast/forecast";

const money = (n: number) => (n < 0 ? "-" : "") + "\u20B9" + Math.abs(n).toLocaleString("en-IN");

interface ForecastPoint {
  day: number;
  balance: number;
}

interface ForecastChartProps {
  points: ForecastPoint[];
  scenarioPoints: ForecastPoint[] | null;
  windowDays: number;
}

export default function ForecastChart({ points, scenarioPoints, windowDays }: ForecastChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-[340px] w-full items-center justify-center rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">
        Loading chart...
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="flex h-[340px] w-full items-center justify-center rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        No forecast data available for this window.
      </div>
    );
  }

  const data = points.map((p, i) => {
    const scen = scenarioPoints && scenarioPoints[i] ? scenarioPoints[i].balance : null;
    const diff = scen !== null ? scen - p.balance : null;
    return {
      day: p.day,
      baseline: p.balance,
      scenario: scen,
      difference: diff !== null && diff > 0 ? diff : null,
      belowZero: Math.min(p.balance, 0),
    };
  });

  const maxDay = Math.max(1, windowDays - 1);
  const ticks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxDay)))];
  const hasScenario = !!(scenarioPoints && scenarioPoints.length > 0);

  const source = hasScenario && scenarioPoints ? scenarioPoints : points;
  const low = source.reduce((m, p) => (p.balance < m.balance ? p : m), source[0]);
  const baseLow = points.reduce((m, p) => (p.balance < m.balance ? p : m), points[0]);

  return (
    <div className="h-[340px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, maxDay]}
            ticks={ticks}
            tickFormatter={(d: number) => dayToDate(d)}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            width={65}
            tickFormatter={(v: number) =>
              v === 0
                ? "\u20B90"
                : (v < 0 ? "-\u20B9" : "\u20B9") +
                  (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(0) + "k" : Math.abs(v))
            }
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip
            labelFormatter={(d: unknown) => dayToDate(Number(d ?? 0))}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value ?? 0);
              const label = String(name ?? "");
              if (label === "Difference") return ["+" + money(v), "Extra cash"];
              return [money(v), label];
            }}
          />
          <Area dataKey="belowZero" baseValue={0} fill="#fecaca" stroke="none" name="Shortfall" />
          {hasScenario && (
            <Area dataKey="difference" baseValue={0} fill="#bbf7d0" stroke="none" name="Difference" />
          )}
          <Line
            type="monotone"
            dataKey="baseline"
            name="Baseline projection"
            stroke="#4f46e5"
            strokeWidth={2.5}
            dot={false}
          />
          {hasScenario && (
            <Line
              type="monotone"
              dataKey="scenario"
              name="With ticked payments"
              stroke="#16a34a"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
            />
          )}
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
          {hasScenario && low && (
            <ReferenceDot
              x={low.day}
              y={low.balance}
              r={5}
              fill="#16a34a"
              stroke="#ffffff"
              strokeWidth={2}
              label={{
                value: money(low.balance),
                position: low.balance < 0 ? "bottom" : "top",
                fill: "#16a34a",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
          {!hasScenario && low && (
            <ReferenceDot
              x={baseLow.day}
              y={baseLow.balance}
              r={5}
              fill="#dc2626"
              stroke="#ffffff"
              strokeWidth={2}
              label={{
                value: money(baseLow.balance),
                position: baseLow.balance < 0 ? "bottom" : "top",
                fill: "#dc2626",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
          <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 10, fontSize: 13 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}