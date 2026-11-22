export interface Customer {
  id: number;
  name: string;
  delay: number;
  conf: number;
}

export interface Invoice {
  id: number;
  customerId: number;
  total: number;
  paid: number;
  due: number;
}

export interface Bill {
  id: number;
  name: string;
  amount: number;
  d: number;
}

export interface Settings {
  openingBalance: number;
  avgDailyCashSales: number;
  shopName?: string;
}

export interface Point {
  day: number;
  balance: number;
}

export const remaining = (inv: Invoice): number => inv.total - inv.paid;

export function invoiceStatus(inv: Invoice): 'PAID' | 'PARTIAL' | 'UNPAID' {
  if (remaining(inv) <= 0) return 'PAID';
  if (inv.paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

// paidNowIds = array of invoice ids the user assumes are paid in full TOMORROW (day 1)
export function runForecast({
  settings,
  customers,
  invoices,
  bills,
  days = 90,
  paidNowIds = [],
}: {
  settings: Settings;
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  days?: number;
  paidNowIds?: number[];
}): Point[] {
  const points: Point[] = [];
  let balance = settings.openingBalance;
  const startDow = new Date().getDay();

  for (let d = 0; d < days; d++) {
    // cash sales: only 70% on Sundays
    const dow = (startDow + d) % 7;
    const cashIn = settings.avgDailyCashSales * (dow === 0 ? 0.7 : 1);

    // money expected from customers
    let creditIn = 0;
    for (const inv of invoices) {
      const left = remaining(inv);
      if (left <= 0) continue;
      const cust = customers.find((c) => c.id === inv.customerId)!;
      const forcedNow = paidNowIds.includes(inv.id);
      let expectedDay = inv.due + cust.delay;      // due date + usual delay
      if (forcedNow) expectedDay = 1;               // what-if: pays tomorrow
      else if (expectedDay < 0) expectedDay = 2;    // already late: assume in 2 days
      if (expectedDay === d) creditIn += left * (forcedNow ? 1 : cust.conf);
    }

    const out = bills.filter((b) => b.d === d).reduce((s, b) => s + b.amount, 0);
    balance += cashIn + creditIn - out;
    points.push({ day: d, balance: Math.round(balance) });
  }
  return points;
}

export function summarize(points: Point[], windowDays: number) {
  const slice = points.slice(0, windowDays);
  const lowest = slice.reduce((m, p) => (p.balance < m.balance ? p : m), slice[0]);
  const firstNegative = slice.find((p) => p.balance < 0) || null;
  return { lowest, firstNegative, safe: !firstNegative };
}

export const dayToDate = (d: number): string => {
  const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d);
  return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
