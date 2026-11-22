"use client";

import { useState, useEffect } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatRupees } from "@/lib/money";
import type { StatusCategory, StatusGroups } from "@/lib/invoiceStatus";

type Props = Pick<StatusGroups, "counts" | "amounts" | "groups">;

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2";

const SLICES: { key: StatusCategory; name: string; color: string }[] = [
  { key: "PAID", name: "Paid", color: "#16a34a" },
  { key: "PARTIAL", name: "Partially paid", color: "#f59e0b" },
  { key: "UNPAID", name: "Unpaid", color: "#dc2626" },
];

const STATUS_TEXT: Record<StatusCategory, string> = {
  PAID: "Paid",
  PARTIAL: "Partially paid",
  UNPAID: "Unpaid",
};

function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? "91" + digits : digits;
}

export default function StatusDonut({ counts, amounts, groups }: Props) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<StatusCategory | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = counts.PAID + counts.PARTIAL + counts.UNPAID;

  const labels: Record<StatusCategory, string> = {
    PAID: `✅ Paid: ${counts.PAID} invoices, ${formatRupees(amounts.PAID)} collected`,
    PARTIAL: `🟡 Partially paid: ${counts.PARTIAL} invoices, ${formatRupees(amounts.PARTIAL)} still to collect`,
    UNPAID: `❌ Unpaid: ${counts.UNPAID} invoices, ${formatRupees(amounts.UNPAID)} left to collect`,
  };

  const data = SLICES.map((s) => ({ name: s.name, value: counts[s.key], key: s.key }));

  function toggle(key: StatusCategory) {
    setSelected((current) => (current === key ? null : key));
  }

  const customers = selected ? groups[selected] : [];
  const outstanding = customers.reduce(
    (sum, customer) => sum + customer.invoices.reduce((s, inv) => s + inv.remaining, 0),
    0,
  );

  return (
    <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm">
      <div className="relative mt-2 h-60 min-w-0">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                onClick={(_, index) => toggle(SLICES[index].key)}
              >
                {SLICES.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    stroke={selected === s.key ? "#1e1b4b" : "none"}
                    strokeWidth={selected === s.key ? 3 : 0}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Loading chart...
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-indigo-900">{total}</span>
          <span className="text-xs text-gray-500">invoices</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {SLICES.map((s) => {
          const isSelected = selected === s.key;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(s.key)}
              className={`min-h-[44px] w-full min-w-0 break-words rounded-2xl border px-4 py-2 text-left text-sm ${
                isSelected ? "border-indigo-600 bg-indigo-50 font-semibold" : "border-gray-200 bg-white"
              } ${FOCUS}`}
            >
              {labels[s.key]}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 min-w-0">
          {customers.length === 0 ? (
            <p className="text-sm text-gray-500">No customers in this group right now.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {customers.map((customer) => (
                  <li key={customer.id} className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="break-words font-bold text-indigo-900">{customer.name}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm">
                      <a
                        href={"tel:" + customer.phone}
                        className={`break-all text-indigo-700 underline ${FOCUS}`}
                      >
                        {customer.phone}
                      </a>
                      <a
                        href={`https://wa.me/${whatsappNumber(customer.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-green-700 underline ${FOCUS}`}
                      >
                        WhatsApp
                      </a>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {customer.invoices.map((inv, idx) => (
                        <li key={`${inv.billNumber}-${idx}`} className="break-words border-t border-gray-100 pt-2 text-sm">
                          <span className="font-medium">{inv.billNumber}</span>
                          {" · "}
                          {new Date(inv.billDate).toLocaleDateString("en-IN")}
                          {" · Total "}
                          {formatRupees(inv.totalAmount)}
                          {" · Paid "}
                          {formatRupees(inv.paid)}
                          {" · Remaining "}
                          {formatRupees(inv.remaining)}
                          {" · "}
                          <span className="text-gray-600">{STATUS_TEXT[inv.category]}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-4 break-words text-sm font-semibold text-indigo-900">
                Total outstanding for these customers: {formatRupees(outstanding)}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
