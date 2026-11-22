import { getBalance, getBillStatus, sumPayments } from "./billStatus";
import { startOfDay } from "./dates";
import { daysOverdue } from "./udhaarList";

export type StoredInvoiceStatus = "DRAFT" | "SENT" | "CANCELLED";

export type DisplayStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "OVERDUE" | "PAID" | "CANCELLED";

export type InvoiceStatusInput = {
  status: StoredInvoiceStatus;
  totalAmount: number;
  dueDate: Date;
  payments: { amount: number }[];
};

export type InvoiceDerived = {
  display: DisplayStatus;
  paidAmount: number;
  balance: number;
  daysOverdue: number;
  daysUntilDue: number;
};

export function deriveInvoiceStatus(input: InvoiceStatusInput, today: Date): InvoiceDerived {
  const info = getBillStatus(
    { totalAmount: input.totalAmount, dueDate: input.dueDate, payments: input.payments },
    today,
  );
  const paidAmount = info.paid;
  const balance = info.balance;

  const dueStart = startOfDay(input.dueDate).getTime();
  const todayStart = startOfDay(today).getTime();

  let display: DisplayStatus;
  if (input.status === "CANCELLED") {
    display = "CANCELLED";
  } else if (input.status === "DRAFT") {
    display = "DRAFT";
  } else if (balance <= 0) {
    display = "PAID";
  } else if (dueStart < todayStart) {
    display = "OVERDUE";
  } else if (paidAmount > 0) {
    display = "PARTIALLY_PAID";
  } else {
    display = "SENT";
  }

  const overdueDays = display === "OVERDUE" ? daysOverdue(input.dueDate, today) : 0;
  const daysUntilDue = Math.max(0, Math.round((dueStart - todayStart) / 86400000));

  return {
    display,
    paidAmount,
    balance,
    daysOverdue: overdueDays,
    daysUntilDue,
  };
}

export type InvoiceActions = {
  canEdit: boolean;
  editMode: "FREE" | "RESEND" | "LOCKED";
  canDelete: boolean;
  canMarkSent: boolean;
  canRecordPayment: boolean;
  canCancel: boolean;
  cancelBlockedReason: string | null;
};

export function allowedActions(display: DisplayStatus, paidAmount: number): InvoiceActions {
  if (display === "DRAFT") {
    return {
      canEdit: true,
      editMode: "FREE",
      canDelete: true,
      canMarkSent: true,
      canRecordPayment: false,
      canCancel: true,
      cancelBlockedReason: null,
    };
  }

  if (display === "SENT" || display === "OVERDUE" || display === "PARTIALLY_PAID") {
    const hasPayments = paidAmount > 0;
    return {
      canEdit: true,
      editMode: "RESEND",
      canDelete: false,
      canMarkSent: false,
      canRecordPayment: true,
      canCancel: !hasPayments,
      cancelBlockedReason: hasPayments
        ? "Payments are recorded on this invoice, so it cannot be cancelled."
        : null,
    };
  }

  return {
    canEdit: false,
    editMode: "LOCKED",
    canDelete: false,
    canMarkSent: false,
    canRecordPayment: false,
    canCancel: false,
    cancelBlockedReason:
      display === "PAID" ? "This invoice is fully paid, so it is locked." : "This invoice is cancelled.",
  };
}

export function statusAfterSend(current: StoredInvoiceStatus): StoredInvoiceStatus {
  return current === "DRAFT" ? "SENT" : current;
}


export type StatusCategory = "PAID" | "PARTIAL" | "UNPAID";

export type StatusBillInput = {
  billNumber: string;
  billDate: Date;
  totalAmount: number;
  customer: { id: number; name: string; whatsappNumber: string };
  payments: { amount: number }[];
};

export type GroupInvoice = {
  billNumber: string;
  billDate: string;
  totalAmount: number;
  paid: number;
  remaining: number;
  category: StatusCategory;
};

export type CustomerEntry = {
  id: number;
  name: string;
  phone: string;
  invoices: GroupInvoice[];
};

export type StatusGroups = {
  counts: Record<StatusCategory, number>;
  amounts: Record<StatusCategory, number>;
  groups: Record<StatusCategory, CustomerEntry[]>;
};

function categorize(totalAmount: number, paid: number): StatusCategory {
  if (getBalance(totalAmount, paid) <= 0) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

export function buildStatusGroups(bills: StatusBillInput[]): StatusGroups {
  const counts: Record<StatusCategory, number> = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
  const amounts: Record<StatusCategory, number> = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
  const groups: Record<StatusCategory, CustomerEntry[]> = { PAID: [], PARTIAL: [], UNPAID: [] };
  const byCustomer: Record<StatusCategory, Map<number, CustomerEntry>> = {
    PAID: new Map(),
    PARTIAL: new Map(),
    UNPAID: new Map(),
  };

  for (const bill of bills) {
    const paid = sumPayments(bill.payments);
    const category = categorize(bill.totalAmount, paid);
    const remaining = Math.max(0, getBalance(bill.totalAmount, paid));

    counts[category] += 1;
    amounts[category] += category === "PAID" ? bill.totalAmount : remaining;

    let entry = byCustomer[category].get(bill.customer.id);
    if (!entry) {
      entry = {
        id: bill.customer.id,
        name: bill.customer.name,
        phone: bill.customer.whatsappNumber,
        invoices: [],
      };
      byCustomer[category].set(bill.customer.id, entry);
      groups[category].push(entry);
    }

    entry.invoices.push({
      billNumber: bill.billNumber,
      billDate: bill.billDate.toISOString(),
      totalAmount: bill.totalAmount,
      paid,
      remaining,
      category,
    });
  }

  for (const category of Object.keys(groups) as StatusCategory[]) {
    groups[category].sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of groups[category]) {
      entry.invoices.sort((a, b) => a.billDate.localeCompare(b.billDate));
    }
  }

  return { counts, amounts, groups };
}

