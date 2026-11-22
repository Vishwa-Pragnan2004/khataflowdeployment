import type { Bill, Customer, Invoice, Settings } from "./forecast";

// Shape of one bill row as loaded from the database (no Prisma import here).
export interface BillRow {
  id: number;
  billNumber: string;
  totalAmount: number;
  dueDate: Date;
  customer: { name: string; whatsappNumber: string };
  payments: { amount: number }[];
}

export interface ExpenseRow {
  id: number;
  title: string;
  category?: string;
  amount: number;
  dueDate: Date;
  paidOn: Date | null;
}

export interface InvoiceRef {
  id: number;
  billNumber: string;
  customerName: string;
  customerPhone: string;
}

// Assumptions for forecast when customer delay/confidence isn't in DB yet.
const DEFAULT_DELAY_DAYS = 3;
const DEFAULT_CONF = 0.9;

const DEFAULT_OPENING_BALANCE = 25000;
const DEFAULT_AVG_DAILY_CASH_SALES = 1250;

const MS_PER_DAY = 86400000;

export function toForecastInput(args: {
  bills: BillRow[];
  todayStart: Date;
  expenses?: ExpenseRow[];
  shopName?: string;
  openingBalance?: number;
  avgDailyCashSales?: number;
}): {
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  settings: Settings;
  invoiceRefs: InvoiceRef[];
} {
  const {
    bills: rows,
    todayStart,
    expenses = [],
    shopName,
    openingBalance,
    avgDailyCashSales,
  } = args;

  // One customer per distinct name, numeric ids 1..N in first-appearance order.
  const customers: Customer[] = [];
  const customerIdByName = new Map<string, number>();
  for (const row of rows) {
    const name = row.customer.name;
    if (!customerIdByName.has(name)) {
      const id = customers.length + 1;
      customerIdByName.set(name, id);
      customers.push({ id, name, delay: DEFAULT_DELAY_DAYS, conf: DEFAULT_CONF });
    }
  }

  const invoices: Invoice[] = [];
  const invoiceRefs: InvoiceRef[] = [];
  rows.forEach((row) => {
    const id = row.id;
    const paid = row.payments.reduce((sum, p) => sum + p.amount, 0);
    invoices.push({
      id,
      customerId: customerIdByName.get(row.customer.name) as number,
      total: row.totalAmount,
      paid,
      due: Math.round((row.dueDate.getTime() - todayStart.getTime()) / MS_PER_DAY),
    });
    invoiceRefs.push({
      id,
      billNumber: row.billNumber,
      customerName: row.customer.name,
      customerPhone: row.customer.whatsappNumber,
    });
  });

  // Map unpaid expenses to outgoing bills in the forecast timeline
  const bills: Bill[] = expenses
    .filter((e) => e.paidOn === null)
    .map((e) => ({
      id: e.id,
      name: e.title,
      amount: e.amount,
      d: Math.max(0, Math.round((e.dueDate.getTime() - todayStart.getTime()) / MS_PER_DAY)),
    }));

  const settings: Settings = {
    openingBalance: openingBalance ?? DEFAULT_OPENING_BALANCE,
    avgDailyCashSales: avgDailyCashSales ?? DEFAULT_AVG_DAILY_CASH_SALES,
    shopName: shopName ?? "Sri Laxmi Stores",
  };

  return { customers, invoices, bills, settings, invoiceRefs };
}
