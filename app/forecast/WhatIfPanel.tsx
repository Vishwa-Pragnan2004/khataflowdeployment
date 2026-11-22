"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ScenarioTarget } from "@/lib/forecast";

export type TargetAvailability = {
  overdue: boolean;
  next: boolean;
  endOfMonth: boolean;
};

export type InitialRow = {
  customerId: number;
  delayDays: number;
  target: ScenarioTarget;
};

type Row = {
  id: number;
  customerId: string;
  delayDays: string;
  target: ScenarioTarget;
};

type Props = {
  customers: [number, string][];
  targetAvailability: Record<string, TargetAvailability>;
  initialRows: InitialRow[];
};

const DEFAULT_DELAY_DAYS = 15;

const TARGET_OPTIONS: { value: ScenarioTarget; label: string }[] = [
  { value: "all", label: "All unpaid bills" },
  { value: "overdue", label: "Most overdue bill" },
  { value: "next", label: "Next due bill" },
  { value: "endOfMonth", label: "All end-of-month bills" },
];

function newRow(id: number): Row {
  return { id, customerId: "", delayDays: String(DEFAULT_DELAY_DAYS), target: "all" };
}

function isAvailable(
  availability: TargetAvailability | undefined,
  target: ScenarioTarget,
): boolean {
  if (target === "all") return true;
  return availability ? availability[target] : false;
}

export default function WhatIfPanel({
  customers,
  targetAvailability,
  initialRows,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows.length > 0
      ? initialRows.map((r, i) => ({
          id: i,
          customerId: String(r.customerId),
          delayDays: String(r.delayDays),
          target: r.target,
        }))
      : [newRow(0)],
  );
  // Ids of rows whose remove-checkbox is unticked. Every other row is ticked by default.
  const [unchecked, setUnchecked] = useState<Set<number>>(() => new Set());
  const nextId = useRef(Math.max(initialRows.length, 1));
  const formRef = useRef<HTMLFormElement>(null);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const id = nextId.current;
    nextId.current += 1;
    setRows((prev) => [...prev, newRow(id)]);
  }

  // Only rows with a chosen customer can be selected for removal.
  const eligible = rows.filter((r) => r.customerId !== "");
  const checkedIds = eligible.filter((r) => !unchecked.has(r.id)).map((r) => r.id);
  const allChecked = eligible.length > 0 && checkedIds.length === eligible.length;

  const customerName = new Map(customers.map(([id, name]) => [String(id), name]));

  function toggleAll(checked: boolean) {
    setUnchecked(checked ? new Set() : new Set(eligible.map((r) => r.id)));
  }

  function toggleRow(id: number) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeSelected() {
    const doomed = new Set(checkedIds);
    // Commit the removal to the DOM first so the submitted form has only the kept rows.
    flushSync(() => {
      setRows((prev) => prev.filter((r) => !doomed.has(r.id)));
    });
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action="/forecast" method="get" className="mt-4 space-y-4">
      {eligible.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-md bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-700">Select what-ifs to remove</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4"
            />
            Select all
          </label>
          {eligible.map((r) => {
            const targetLabel =
              TARGET_OPTIONS.find((opt) => opt.value === r.target)?.label.toLowerCase() ?? "";
            return (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!unchecked.has(r.id)}
                  onChange={() => toggleRow(r.id)}
                  className="h-4 w-4"
                />
                {`${customerName.get(r.customerId) ?? "Customer"} — ${targetLabel}`}
              </label>
            );
          })}
          <button
            type="button"
            onClick={removeSelected}
            disabled={checkedIds.length === 0}
            className="min-h-12 rounded-md bg-rose-600 px-5 text-white disabled:opacity-50"
          >
            Remove selected
          </button>
        </div>
      ) : null}

      {rows.map((row, i) => {
        // Customers already picked in other rows are hidden from this row's list.
        const chosenElsewhere = new Set(
          rows.filter((_, j) => j !== i).map((r) => r.customerId).filter(Boolean),
        );
        const availability = row.customerId
          ? targetAvailability[row.customerId]
          : undefined;

        return (
          <div key={row.id} className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-stone-600">Customer</span>
              <select
                name={`s_${i}`}
                value={row.customerId}
                onChange={(e) => updateRow(i, { customerId: e.target.value })}
                className="min-h-12 rounded-md border border-stone-300 px-3"
              >
                <option value="">Choose a customer</option>
                {customers
                  .filter(([id]) => !chosenElsewhere.has(String(id)))
                  .map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>

            {row.customerId ? (
              <>
                <label className="flex flex-col text-sm">
                  <span className="mb-1 text-stone-600">Bills</span>
                  <select
                    name={`t_${i}`}
                    value={row.target}
                    onChange={(e) =>
                      updateRow(i, { target: e.target.value as ScenarioTarget })
                    }
                    className="min-h-12 rounded-md border border-stone-300 px-3"
                  >
                    {TARGET_OPTIONS.map((opt) => {
                      const available = isAvailable(availability, opt.value);
                      return (
                        <option key={opt.value} value={opt.value} disabled={!available}>
                          {available ? opt.label : `${opt.label} (none)`}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="flex flex-col text-sm">
                  <span className="mb-1 text-stone-600">Days late</span>
                  <input
                    type="number"
                    name={`d_${i}`}
                    min={0}
                    max={60}
                    value={row.delayDays}
                    onChange={(e) => updateRow(i, { delayDays: e.target.value })}
                    className="min-h-12 w-32 rounded-md border border-stone-300 px-3"
                  />
                </label>
              </>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={addRow}
          className="min-h-12 rounded-md bg-emerald-600 px-5 text-white hover:bg-emerald-700"
        >
          Add another what-if
        </button>
        <button
          type="submit"
          className="min-h-12 rounded-md bg-stone-900 px-5 text-white"
        >
          Run what-if
        </button>
      </div>
    </form>
  );
}
