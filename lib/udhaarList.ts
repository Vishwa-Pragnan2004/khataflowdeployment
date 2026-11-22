import { getBillStatus, type BillStatus } from "./billStatus";
import { startOfDay } from "./dates";

export const FILTER_STATUSES = ["UNPAID", "PARTIALLY_PAID", "OVERDUE", "PAID"] as const;
export type FilterStatus = (typeof FILTER_STATUSES)[number];
export const DEFAULT_FILTER: FilterStatus[] = ["OVERDUE", "UNPAID"];

export type UdhaarBillInput = {
  id: number;
  billNumber: string;
  customerName: string;
  totalAmount: number;
  dueDate: Date;
  payments: { amount: number }[];
};
export type UdhaarRow = UdhaarBillInput & {
  paid: number;
  balance: number;
  status: BillStatus;
  daysOverdue: number;
};
export type UdhaarSummary = {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
};

function isFilterStatus(value: string): value is FilterStatus {
  return (FILTER_STATUSES as readonly string[]).includes(value);
}

export function parseStatusParam(raw: string | undefined): FilterStatus[] {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") {
    return [...DEFAULT_FILTER];
  }
  if (trimmed.toUpperCase() === "ALL") {
    return [...FILTER_STATUSES];
  }
  const requested = new Set<string>(
    trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(isFilterStatus),
  );
  const result = FILTER_STATUSES.filter((status) => requested.has(status));
  return result.length > 0 ? result : [...DEFAULT_FILTER];
}

export function daysOverdue(dueDate: Date, today: Date): number {
  return Math.max(
    0,
    Math.round((startOfDay(today).getTime() - startOfDay(dueDate).getTime()) / 86400000),
  );
}

export function buildUdhaarRows(inputs: UdhaarBillInput[], today: Date): UdhaarRow[] {
  return inputs.map((input) => {
    const info = getBillStatus(
      { totalAmount: input.totalAmount, dueDate: input.dueDate, payments: input.payments },
      today,
    );
    return {
      ...input,
      paid: info.paid,
      balance: info.balance,
      status: info.status,
      daysOverdue: info.status === "OVERDUE" ? daysOverdue(input.dueDate, today) : 0,
    };
  });
}

export function filterRows(rows: UdhaarRow[], statuses: FilterStatus[], query: string): UdhaarRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (!statuses.includes(row.status as FilterStatus)) {
      return false;
    }
    if (needle === "") {
      return true;
    }
    return row.customerName.toLowerCase().includes(needle);
  });
}

export function sortRows(rows: UdhaarRow[]): UdhaarRow[] {
  return [...rows].sort((a, b) => {
    const aOverdue = a.status === "OVERDUE";
    const bOverdue = b.status === "OVERDUE";
    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }
    if (aOverdue && bOverdue && a.daysOverdue !== b.daysOverdue) {
      return b.daysOverdue - a.daysOverdue;
    }
    if (!aOverdue && !bOverdue) {
      const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
      if (dueDiff !== 0) {
        return dueDiff;
      }
    }
    return a.id - b.id;
  });
}

export function summarize(rows: UdhaarRow[]): UdhaarSummary {
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  for (const row of rows) {
    if (row.balance > 0) {
      totalOutstanding += row.balance;
    }
    if (row.status === "OVERDUE") {
      totalOverdue += row.balance;
      overdueCount += 1;
    }
  }
  return { totalOutstanding, totalOverdue, overdueCount };
}

export function buildListHref(statuses: FilterStatus[], query: string): string {
  const allSelected = FILTER_STATUSES.every((status) => statuses.includes(status));
  const statusValue = allSelected
    ? "ALL"
    : FILTER_STATUSES.filter((status) => statuses.includes(status)).join(",");
  const params = new URLSearchParams();
  params.set("status", statusValue);
  const trimmedQuery = query.trim();
  if (trimmedQuery !== "") {
    params.set("q", trimmedQuery);
  }
  return "/?" + params.toString();
}

// Single-select: picking a status shows only that status. Picking the
// already-active status returns to "All" (every status, no filter).
export function toggleStatus(current: FilterStatus[], status: FilterStatus): FilterStatus[] {
  const isOnlyActive = current.length === 1 && current[0] === status;
  return isOnlyActive ? [...FILTER_STATUSES] : [status];
}
