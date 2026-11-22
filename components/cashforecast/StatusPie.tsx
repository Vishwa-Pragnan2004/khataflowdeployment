"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const money = (n: number) => (n < 0 ? "-" : "") + "\u20B9" + Math.abs(n).toLocaleString("en-IN");

type StatusKey = "PAID" | "PARTIAL" | "UNPAID";

const SLICES: { key: StatusKey; name: string; color: string; icon: string }[] = [
  { key: "PAID", name: "Paid", color: "#16a34a", icon: "\u2705" },
  { key: "PARTIAL", name: "Partially paid", color: "#f59e0b", icon: "\uD83D\uDFE1" },
  { key: "UNPAID", name: "Unpaid", color: "#dc2626", icon: "\u274C" },
];

export interface PieInvoice {
  id: number;
  customerName: string;
  customerPhone: string;
  status: StatusKey;
  owed: number;
  total: number;
}

interface StatusPieProps {
  invoices: PieInvoice[];
  selected: number[];
  pieFilter: StatusKey | null;
  onPick: (key: StatusKey) => void;
}

export default function StatusPie({ invoices, selected, pieFilter, onPick }: StatusPieProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // When a person is ticked (selected), their invoice is treated as PAID in the scenario.
  const scenarioInvoices = useMemo(
    () =>
      invoices.map((inv) =>
        selected.includes(inv.id) ? { ...inv, status: "PAID" as StatusKey, owed: 0 } : inv,
      ),
    [invoices, selected],
  );

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
    scenarioInvoices.forEach((inv) => {
      c[inv.status] += 1;
    });
    return c;
  }, [scenarioInvoices]);

  const amounts = useMemo(() => {
    const a: Record<StatusKey, number> = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
    scenarioInvoices.forEach((inv) => {
      if (inv.status === "PAID") a.PAID += inv.total;
      else a[inv.status] += inv.owed;
    });
    return a;
  }, [scenarioInvoices]);

  const total = scenarioInvoices.length;

  const byStatus = useMemo(() => {
    const map: Record<StatusKey, PieInvoice[]> = { PAID: [], PARTIAL: [], UNPAID: [] };
    scenarioInvoices.forEach((inv) => map[inv.status].push(inv));
    return map;
  }, [scenarioInvoices]);

  const pieData = SLICES.map((s) => ({ ...s, value: counts[s.key] })).filter((s) => s.value > 0);

  const detail: Record<StatusKey, string> = {
    PAID: `${counts.PAID} invoices, ${money(amounts.PAID)} collected`,
    PARTIAL: `${counts.PARTIAL} invoices, ${money(amounts.PARTIAL)} still to collect`,
    UNPAID: `${counts.UNPAID} invoices, ${money(amounts.UNPAID)} left to collect`,
  };

  const activeName = SLICES.find((s) => s.key === pieFilter)?.name;

  if (!mounted) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">
        Loading chart...
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="relative mx-auto h-[240px] w-full min-w-0 max-w-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                pieData.length > 0
                  ? pieData
                  : [{ name: "No invoices", value: 1, key: "EMPTY" as StatusKey, color: "#e2e8f0", icon: "" }]
              }
              dataKey="value"
              nameKey="name"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={pieData.length > 1 ? 3 : 0}
              onClick={(entry: { key?: StatusKey }) => {
                if (entry?.key && entry.key !== ("EMPTY" as StatusKey)) {
                  onPick(entry.key);
                }
              }}
            >
              {pieData.length > 0 ? (
                pieData.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    opacity={pieFilter && pieFilter !== s.key ? 0.35 : 1}
                    stroke={pieFilter === s.key ? "#1e1b4b" : "#ffffff"}
                    strokeWidth={pieFilter === s.key ? 2 : 1}
                    cursor="pointer"
                  />
                ))
              ) : (
                <Cell key="empty" fill="#e2e8f0" stroke="none" />
              )}
            </Pie>
            {pieData.length > 0 && (
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const entry = payload[0].payload as (typeof SLICES)[number] & { value: number };
                  const people = byStatus[entry.key];
                  return (
                    <div className="max-w-xs rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
                      <p className="font-semibold text-stone-900">
                        {entry.icon} {entry.name} ({entry.value} {entry.value === 1 ? "invoice" : "invoices"})
                      </p>
                      <p className="text-sm text-stone-600">
                        {entry.key === "PAID"
                          ? `${money(amounts.PAID)} collected`
                          : `${money(amounts[entry.key])} to collect`}
                      </p>
                      {people.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-stone-100 pt-2">
                          {people.slice(0, 12).map((p) => (
                            <li key={p.id} className="text-xs text-stone-700">
                              <span className="font-medium">{p.customerName}</span>
                              {p.customerPhone ? ` · ${p.customerPhone}` : ""}
                              <span className="text-stone-500">
                                {" "}— {money(p.status === "PAID" ? p.total : p.owed)}
                              </span>
                            </li>
                          ))}
                          {people.length > 12 && (
                            <li className="text-xs text-stone-400">+{people.length - 12} more…</li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{total}</span>
          <span className="text-xs font-medium text-gray-500">invoices</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {SLICES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={pieFilter === s.key}
            onClick={() => onPick(s.key)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 ${
              pieFilter === s.key
                ? "border-indigo-400 bg-indigo-50 font-medium shadow-sm"
                : "border-gray-200 bg-white hover:bg-slate-50"
            }`}
          >
            <span aria-hidden="true" className="text-base">{s.icon}</span>
            <div className="flex-1">
              <span className="font-semibold text-gray-900">{s.name}</span>
              <span className="block text-xs text-gray-600">{detail[s.key]}</span>
            </div>
          </button>
        ))}
      </div>

      {pieFilter && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Filtered by <span className="font-semibold text-gray-700">{activeName}</span>. Tap again to clear filter.
        </p>
      )}
    </div>
  );
}