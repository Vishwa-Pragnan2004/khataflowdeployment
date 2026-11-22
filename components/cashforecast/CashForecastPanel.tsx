"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  remaining,
  invoiceStatus,
  runForecast,
  summarize,
  type Customer,
  type Invoice,
  type Bill,
  type Settings,
} from "@/lib/cashforecast/forecast";
import ForecastChart from "./ForecastChart";
import StatusPie, { type PieInvoice } from "./StatusPie";
import WhatIfList from "./WhatIfList";
import Verdict from "./Verdict";

type Status = "PAID" | "PARTIAL" | "UNPAID";

type InvoiceRef = {
  id: number;
  billNumber: string;
  customerName: string;
  customerPhone: string;
};

export type CashForecastInput = {
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  settings: Settings;
  invoiceRefs: InvoiceRef[];
};

type OpenRow = {
  id: number;
  customerName: string;
  status: Status;
  owed: number;
  daysLate: number;
};

const rupees = (n: number) => "\u20B9" + n.toLocaleString("en-IN");

const WINDOWS = [30, 60, 90];

export default function CashForecastPanel({
  input,
  showBackLink = false,
}: {
  input: CashForecastInput;
  showBackLink?: boolean;
}) {
  const { customers, invoices, bills, settings, invoiceRefs } = input;

  const [windowDays, setWindowDays] = useState(90);
  const [selected, setSelected] = useState<number[]>([]);
  const [pieFilter, setPieFilter] = useState<Status | null>(null);

  const baseline90 = useMemo(
    () =>
      runForecast({
        settings,
        customers,
        invoices,
        bills,
        days: 90,
        paidNowIds: [],
      }),
    [settings, customers, invoices, bills]
  );

  const scenario90 = useMemo(
    () =>
      runForecast({
        settings,
        customers,
        invoices,
        bills,
        days: 90,
        paidNowIds: selected,
      }),
    [settings, customers, invoices, bills, selected]
  );

  const hasTicked = selected.length > 0;
  const scenarioSource = hasTicked ? scenario90 : baseline90;
  const points = useMemo(() => baseline90.slice(0, windowDays), [baseline90, windowDays]);
  const scenarioPoints = useMemo(
    () => (hasTicked ? scenario90.slice(0, windowDays) : null),
    [hasTicked, scenario90, windowDays]
  );

  const chosen = useMemo(
    () => summarize(scenarioSource, windowDays),
    [scenarioSource, windowDays]
  );
  const all = useMemo(
    () => ({
      30: summarize(scenarioSource, 30),
      60: summarize(scenarioSource, 60),
      90: summarize(scenarioSource, 90),
    }),
    [scenarioSource]
  );

  // Pie chart invoice list with customer info for tooltips
  const pieInvoices = useMemo<PieInvoice[]>(
    () =>
      invoices.map((inv) => {
        const ref = invoiceRefs.find((r) => r.id === inv.id);
        return {
          id: inv.id,
          customerName: ref?.customerName ?? "",
          customerPhone: ref?.customerPhone ?? "",
          status: invoiceStatus(inv),
          owed: remaining(inv),
          total: inv.total,
        };
      }),
    [invoices, invoiceRefs]
  );

  const openInvoices = useMemo<OpenRow[]>(
    () =>
      invoices
        .filter((inv) => remaining(inv) > 0)
        .map((inv) => ({
          id: inv.id,
          customerName: invoiceRefs.find((r) => r.id === inv.id)?.customerName ?? "",
          status: invoiceStatus(inv),
          owed: remaining(inv),
          daysLate: -inv.due,
        })),
    [invoices, invoiceRefs]
  );

  const items = useMemo(() => {
    let rows: OpenRow[];
    if (pieFilter === "PAID") rows = [];
    else if (pieFilter === "PARTIAL" || pieFilter === "UNPAID")
      rows = openInvoices.filter((r) => r.status === pieFilter);
    else rows = openInvoices;
    return [...rows].sort((a, b) => b.daysLate - a.daysLate);
  }, [openInvoices, pieFilter]);

  const ticked = useMemo(
    () => openInvoices.filter((r) => selected.includes(r.id)),
    [openInvoices, selected]
  );
  const tickedTotal = useMemo(() => ticked.reduce((s, r) => s + r.owed, 0), [ticked]);
  const tickedCount = useMemo(
    () => new Set(ticked.map((r) => r.customerName)).size,
    [ticked]
  );
  const tickedNames = useMemo(
    () => [...new Set(ticked.map((r) => r.customerName))],
    [ticked]
  );

  const comingIn = useMemo(() => openInvoices.reduce((s, r) => s + r.owed, 0), [openInvoices]);
  const billsNext30 = useMemo(
    () => bills.filter((b) => b.d < 30).reduce((s, b) => s + b.amount, 0),
    [bills]
  );

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const tickOverdue = () => {
    const ids = items.filter((r) => r.daysLate > 0).map((r) => r.id);
    setSelected((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const tickTop3 = () => {
    const ids = [...items]
      .sort((a, b) => b.owed - a.owed)
      .slice(0, 3)
      .map((r) => r.id);
    setSelected((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clear = () => setSelected([]);

  const pick = (key: Status) => setPieFilter((prev) => (prev === key ? null : key));

  // Baseline vs scenario verdict for the selected window
  const baseVerdict = useMemo(() => summarize(baseline90, windowDays), [baseline90, windowDays]);
  const scenarioVerdict = useMemo(() => summarize(scenario90, windowDays), [scenario90, windowDays]);

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <header className="flex flex-col gap-1">
        {showBackLink && (
          <Link
            href="/"
            className="inline-flex w-fit items-center text-sm font-medium text-stone-700 hover:text-stone-900 hover:underline"
          >
            ← Back to Udhaar Receivables
          </Link>
        )}
        <div className="mt-1">
          <h2 className="text-2xl font-bold text-slate-900">Cash Forecast (Nakad Anumaan)</h2>
          <p className="text-sm text-slate-600">{settings.shopName ?? "Sri Laxmi Stores"}</p>
        </div>
      </header>

      {/* 30/60/90-Day Range Toggle */}
      <div className="grid grid-cols-3 gap-2">
        {WINDOWS.map((d) => {
          const active = windowDays === d;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => setWindowDays(d)}
              className={
                "min-h-11 rounded-xl px-3 font-semibold transition-colors " +
                (active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              {d} days
            </button>
          );
        })}
      </div>

      {/* Baseline vs Scenario Verdict */}
      <Verdict
        windowDays={windowDays}
        chosen={chosen}
        all={all}
        tickedNames={tickedNames}
        hasTicked={hasTicked}
        baseVerdict={baseVerdict}
        scenarioVerdict={scenarioVerdict}
        tickedTotal={tickedTotal}
      />

      {/* Interactive Forecast Line Chart */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">
            Cash balance over next {windowDays} days
          </h3>
          {hasTicked && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              +{rupees(tickedTotal)} from {tickedCount} customers
            </span>
          )}
        </div>
        <ForecastChart points={points} scenarioPoints={scenarioPoints} windowDays={windowDays} />
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-medium text-indigo-600">Indigo line</span> = baseline (no ticked payments)
          {hasTicked && (
            <>
              {" · "}
              <span className="font-medium text-green-600">Green dashed line</span> = with ticked payments
              {" · "}
              <span className="font-medium text-green-700">Green shaded area</span> = extra cash from ticking
            </>
          )}
        </p>
      </div>

      {/* Invoices by Status Pie / Donut — changes when ticking checkboxes */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-semibold text-slate-800">
          Invoices by status {hasTicked && <span className="text-sm font-normal text-green-700">(scenario: ticked = paid)</span>}
        </h3>
        <StatusPie
          invoices={pieInvoices}
          selected={selected}
          pieFilter={pieFilter}
          onPick={pick}
        />
      </div>

      {/* What-If Checkboxes */}
      {openInvoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-slate-700 shadow-sm">
          No money is owed to you right now. All caught up!
        </div>
      ) : (
        <WhatIfList
          items={items}
          selected={selected}
          pieFilter={pieFilter}
          onToggle={(id) => toggle(Number(id))}
          onTickOverdue={tickOverdue}
          onTickTop3={tickTop3}
          onClear={clear}
          tickedTotal={tickedTotal}
          tickedCount={tickedCount}
        />
      )}

      {/* Cash Summary Footer */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        Cash today {rupees(settings.openingBalance)} · Coming in (unpaid invoices){" "}
        {rupees(comingIn)} · Bills in next 30 days {rupees(billsNext30)}
      </div>
    </div>
  );
}