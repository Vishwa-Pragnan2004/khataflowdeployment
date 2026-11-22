"use client";

const money = (n: number) => (n < 0 ? "-" : "") + "\u20B9" + Math.abs(n).toLocaleString("en-IN");

const STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  UNPAID: { label: "Unpaid", icon: "\u274C", cls: "bg-red-100 text-red-700" },
  PARTIAL: { label: "Partial", icon: "\uD83D\uDFE1", cls: "bg-amber-100 text-amber-800" },
};

const BUTTON =
  "min-h-11 rounded-full border border-indigo-600 px-4 text-sm font-medium text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2";

export interface WhatIfItem {
  id: string | number;
  customerName: string;
  status: string;
  owed: number;
  daysLate: number;
}

interface WhatIfListProps {
  items: WhatIfItem[];
  selected: (string | number)[];
  pieFilter: string | null;
  onToggle: (id: string | number) => void;
  onTickOverdue: () => void;
  onTickTop3: () => void;
  onClear: () => void;
  tickedTotal: number;
  tickedCount: number;
}

export default function WhatIfList({
  items, selected, pieFilter, onToggle, onTickOverdue, onTickTop3, onClear, tickedTotal, tickedCount,
}: WhatIfListProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Tick who pays you, see what changes</h2>
      <p className="text-sm text-gray-600">Tap a row to tick it. Ticked means paid in full tomorrow.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onTickOverdue} className={BUTTON}>Tick all overdue</button>
        <button type="button" onClick={onTickTop3} className={BUTTON}>Tick top 3 biggest</button>
        <button type="button" onClick={onClear} className={BUTTON}>Clear</button>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
          {pieFilter ? "No invoices in this group." : "No money is owed to you right now. Nice work!"}
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const isSelected = selected.includes(item.id);
            const st = STATUS[item.status];
            return (
              <li key={item.id}>
                <label
                  className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border p-3 ${
                    isSelected ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-6 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
                    checked={isSelected}
                    onChange={() => onToggle(item.id)}
                    aria-label={`${item.customerName}, owes ${money(item.owed)}`}
                  />
                  <span className="font-semibold text-gray-900">{item.customerName}</span>
                  {st && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                      {st.icon} {st.label}
                    </span>
                  )}
                  <span className="text-sm text-gray-900">
                    {money(item.owed)} <span className="text-gray-600">still owed</span>
                  </span>
                  {item.daysLate > 0 ? (
                    <span className="text-sm text-red-700">{item.daysLate} days late</span>
                  ) : item.daysLate < 0 ? (
                    <span className="text-sm text-gray-600">due in {-item.daysLate} days</span>
                  ) : (
                    <span className="text-sm text-gray-600">due today</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-sm font-medium text-gray-900">
        Ticked: {money(tickedTotal)} from {tickedCount} customers
      </p>
    </div>
  );
}
