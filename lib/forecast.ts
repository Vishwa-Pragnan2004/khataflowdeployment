// Cash forecast engine. Pure module: no Prisma, no I/O.
// All dates are normalised with startOfDay before comparing, and day
// differences use Math.round so DST shifts cannot cause off-by-one errors.
import { addDays, startOfDay } from "./dates";

// ---------- Input types ----------

export type ForecastBill = {
  id: number;
  customerId: number;
  customerName: string;
  balance: number;
  dueDate: Date;
  promisedDate: Date | null;
  status: string;
};

export type ForecastExpense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  dueDate: Date;
  paidOn: Date | null;
};

// Which of a customer's unpaid bills a scenario shifts. Absent means "all".
export type ScenarioTarget = "all" | "overdue" | "next" | "endOfMonth";

export type Scenario = {
  customerId: number;
  delayDays: number;
  target?: ScenarioTarget;
};

export type ForecastInput = {
  today: Date;
  openingCash: number;
  bills: ForecastBill[];
  expenses: ForecastExpense[];
  scenario?: Scenario;
};

// ---------- Output types ----------

export type Bucket = {
  startDay: number;
  endDay: number;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  closingCash: number;
};

export type InflowItem = {
  billId: number;
  customerName: string;
  amount: number;
  expectedDate: Date;
};

export type OutflowItem = {
  expenseId: number;
  title: string;
  category: string;
  amount: number;
  date: Date;
};

export type ForecastResult = {
  buckets: Bucket[];
  inflow30: number;
  inflow60: number;
  inflow90: number;
  outflow30: number;
  outflow60: number;
  outflow90: number;
  net30: number;
  net60: number;
  net90: number;
  lowestCash: number;
  lowestCashDate: Date;
  firstNegativeDate: Date | null;
  closingCash90: number;
  inflowItems: InflowItem[];
  outflowItems: OutflowItem[];
};

export type ScenarioComparison = {
  base: ForecastResult;
  scenario: ForecastResult;
  lowestCashChange: number;
  // No longer shown on the page; kept for backward compatibility.
  closingCash90Change: number;
  // Scenario minus base running balance on the earliest original (pre-shift)
  // expected date of the bills the scenario moved. Negative = cash lower on the
  // day the money was expected. 0 when no bill is affected.
  dueDateCashChange: number;
};

export type ChaseItem = {
  billId: number;
  customerName: string;
  balance: number;
  daysOverdue: number;
  suggestedAction: "Chase today";
};

// ---------- Constants and helpers ----------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Overdue bills are assumed to land this many days from today.
const OVERDUE_RECEIPT_DAYS = 7;
const WEEKS = 13;
const HORIZON_DAYS = 90;

// Whole days from `from` to `to`, comparing start-of-day values.
function dayDiff(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY,
  );
}

// Sum of amounts whose day index falls within [from, to] inclusive.
function sumDays(
  entries: { day: number; amount: number }[],
  from: number,
  to: number,
): number {
  let total = 0;
  for (const e of entries) {
    if (e.day >= from && e.day <= to) total += e.amount;
  }
  return total;
}

// ---------- Forecast ----------

export function buildForecast(input: ForecastInput): ForecastResult {
  return buildForecastWithScenarios(input, input.scenario ? [input.scenario] : []);
}

// Short label for a target, for display.
export function describeTarget(target: ScenarioTarget = "all"): string {
  switch (target) {
    case "overdue":
      return "most overdue bill";
    case "next":
      return "next due bill";
    case "endOfMonth":
      return "end-of-month bills";
    default:
      return "all unpaid bills";
  }
}

// Picks which of one customer's open bills a scenario shifts. `today` must already
// be start-of-day.
// - "all": every open bill.
// - "overdue": the single open bill with the earliest due date strictly before today.
// - "next": the single open bill with the earliest due date today or later.
// - "endOfMonth": every open bill whose due date falls within the last 7 days of its
//   own calendar month (day >= daysInMonth - 6).
function selectTargetBills(
  bills: ForecastBill[],
  target: ScenarioTarget,
  today: Date,
): ForecastBill[] {
  if (target === "endOfMonth") {
    return bills.filter((b) => {
      const due = startOfDay(b.dueDate);
      const daysInMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
      return due.getDate() >= daysInMonth - 6;
    });
  }

  if (target === "overdue" || target === "next") {
    let best: ForecastBill | null = null;
    let bestTime = 0;
    for (const b of bills) {
      const due = startOfDay(b.dueDate).getTime();
      const eligible =
        target === "overdue" ? due < today.getTime() : due >= today.getTime();
      if (!eligible) continue;
      if (best === null || due < bestTime) {
        best = b;
        bestTime = due;
      }
    }
    return best ? [best] : [];
  }

  return bills;
}

// Shared engine. Each scenario shifts its customer's target bills by delayDays.
// If several scenarios name the same customer, the last one wins.
function buildForecastWithScenarios(
  input: Omit<ForecastInput, "scenario">,
  scenarios: Scenario[],
): ForecastResult {
  const today = startOfDay(input.today);
  const { openingCash } = input;

  // Customer -> winning scenario (last one wins).
  const delayByCustomer = new Map<number, Scenario>();
  for (const s of scenarios) delayByCustomer.set(s.customerId, s);

  // Bill id -> delay days, for the bills each winning scenario's target selects.
  const openBills = input.bills.filter(
    (b) => b.balance > 0 && b.status !== "DRAFT" && b.status !== "CANCELLED",
  );
  const delayByBill = new Map<number, number>();
  for (const s of delayByCustomer.values()) {
    const customerBills = openBills.filter((b) => b.customerId === s.customerId);
    for (const b of selectTargetBills(customerBills, s.target ?? "all", today)) {
      delayByBill.set(b.id, s.delayDays);
    }
  }

  // Inflows: open bills only (drafts and cancelled excluded).
  const inflowItems: InflowItem[] = [];
  for (const bill of input.bills) {
    if (!(bill.balance > 0)) continue;
    if (bill.status === "DRAFT" || bill.status === "CANCELLED") continue;

    // Use the promised date if it is not in the past, otherwise the due date.
    let expected =
      bill.promisedDate !== null &&
      startOfDay(bill.promisedDate).getTime() >= today.getTime()
        ? startOfDay(bill.promisedDate)
        : startOfDay(bill.dueDate);

    // Already overdue: assume it lands a week from today.
    if (expected.getTime() < today.getTime()) {
      expected = addDays(today, OVERDUE_RECEIPT_DAYS);
    }

    // What-if: delay the receipts selected by a scenario's target.
    const delay = delayByBill.get(bill.id);
    if (delay !== undefined) {
      expected = addDays(expected, delay);
    }

    inflowItems.push({
      billId: bill.id,
      customerName: bill.customerName,
      amount: bill.balance,
      expectedDate: expected,
    });
  }
  inflowItems.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());

  // Outflows: unpaid expenses. Overdue ones are counted today.
  const outflowItems: OutflowItem[] = [];
  for (const expense of input.expenses) {
    if (expense.paidOn !== null) continue;
    const due = startOfDay(expense.dueDate);
    outflowItems.push({
      expenseId: expense.id,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      date: due.getTime() < today.getTime() ? today : due,
    });
  }
  outflowItems.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Day-indexed copies for bucket and horizon sums.
  const inflowDays = inflowItems.map((i) => ({
    day: dayDiff(today, i.expectedDate),
    amount: i.amount,
  }));
  const outflowDays = outflowItems.map((o) => ({
    day: dayDiff(today, o.date),
    amount: o.amount,
  }));

  // Daily running balance over days 0..HORIZON_DAYS. Day-0 flows are applied
  // before the minimum is taken, so an overdue expense counts immediately.
  const dailyNet = new Array<number>(HORIZON_DAYS + 1).fill(0);
  for (const i of inflowDays) {
    if (i.day >= 0 && i.day <= HORIZON_DAYS) dailyNet[i.day] += i.amount;
  }
  for (const o of outflowDays) {
    if (o.day >= 0 && o.day <= HORIZON_DAYS) dailyNet[o.day] -= o.amount;
  }
  let dailyCash = openingCash;
  let lowestCash = 0;
  let lowestCashDate = today;
  for (let d = 0; d <= HORIZON_DAYS; d++) {
    dailyCash += dailyNet[d];
    // Ties keep the earliest date.
    if (d === 0 || dailyCash < lowestCash) {
      lowestCash = dailyCash;
      lowestCashDate = addDays(today, d);
    }
  }

  // Weekly buckets (chart only): day 0-6, 7-13, ..., 84-90.
  const buckets: Bucket[] = [];
  let runningCash = openingCash;
  let firstNegativeDate: Date | null = openingCash < 0 ? today : null;

  for (let w = 0; w < WEEKS; w++) {
    const startDay = w * 7;
    const endDay = startDay + 6;
    const inflow = sumDays(inflowDays, startDay, endDay);
    const outflow = sumDays(outflowDays, startDay, endDay);
    const net = inflow - outflow;
    runningCash += net;

    const bucketStart = addDays(today, startDay);
    buckets.push({
      startDay,
      endDay,
      label: `Week ${w + 1}`,
      inflow,
      outflow,
      net,
      closingCash: runningCash,
    });

    if (firstNegativeDate === null && runningCash < 0) {
      firstNegativeDate = bucketStart;
    }
  }


  // Horizon totals (inclusive day ranges starting at today).
  const inflow30 = sumDays(inflowDays, 0, 30);
  const inflow60 = sumDays(inflowDays, 0, 60);
  const inflow90 = sumDays(inflowDays, 0, 90);
  const outflow30 = sumDays(outflowDays, 0, 30);
  const outflow60 = sumDays(outflowDays, 0, 60);
  const outflow90 = sumDays(outflowDays, 0, 90);

  return {
    buckets,
    inflow30,
    inflow60,
    inflow90,
    outflow30,
    outflow60,
    outflow90,
    net30: inflow30 - outflow30,
    net60: inflow60 - outflow60,
    net90: inflow90 - outflow90,
    lowestCash,
    lowestCashDate,
    firstNegativeDate,
    closingCash90: buckets[WEEKS - 1].closingCash,
    inflowItems,
    outflowItems,
  };
}

// Running balance on `date` (end of that day): opening cash plus every inflow and
// outflow dated on or before it. Works for any date, inside or beyond the horizon.
function balanceOn(
  result: ForecastResult,
  openingCash: number,
  today: Date,
  date: Date,
): number {
  const day = dayDiff(today, date);
  let balance = openingCash;
  for (const i of result.inflowItems) {
    if (dayDiff(today, i.expectedDate) <= day) balance += i.amount;
  }
  for (const o of result.outflowItems) {
    if (dayDiff(today, o.date) <= day) balance -= o.amount;
  }
  return balance;
}

// Builds the comparison. dueDateCashChange is measured on the earliest ORIGINAL
// (pre-shift) expected date among the bills the scenario moved; 0 if none moved.
function makeComparison(
  input: Pick<ForecastInput, "today" | "openingCash">,
  base: ForecastResult,
  scenario: ForecastResult,
): ScenarioComparison {
  const baseDateById = new Map<number, Date>();
  for (const item of base.inflowItems) baseDateById.set(item.billId, item.expectedDate);

  let originalDate: Date | null = null;
  for (const item of scenario.inflowItems) {
    const original = baseDateById.get(item.billId);
    if (original === undefined || original.getTime() === item.expectedDate.getTime()) {
      continue;
    }
    if (originalDate === null || original.getTime() < originalDate.getTime()) {
      originalDate = original;
    }
  }

  const dueDateCashChange =
    originalDate === null
      ? 0
      : balanceOn(scenario, input.openingCash, input.today, originalDate) -
        balanceOn(base, input.openingCash, input.today, originalDate);

  return {
    base,
    scenario,
    lowestCashChange: scenario.lowestCash - base.lowestCash,
    // Kept for backward compatibility. No longer shown on the page; the page
    // uses dueDateCashChange instead.
    closingCash90Change: scenario.closingCash90 - base.closingCash90,
    dueDateCashChange,
  };
}

// Base forecast vs. forecast with a customer payment delay applied.
// Changes are scenario minus base.
export function compareScenario(
  input: Omit<ForecastInput, "scenario">,
  scenario: Scenario,
): ScenarioComparison {
  const base = buildForecast(input);
  const result = buildForecast({ ...input, scenario });
  return makeComparison(input, base, result);
}

// Baseline vs. forecast with ALL scenarios applied together. An empty list gives
// zero changes. Duplicate customerIds: the last scenario wins. Any input.scenario
// is ignored here; pass scenarios explicitly.
export function compareScenarios(
  input: ForecastInput,
  scenarios: Scenario[],
): ScenarioComparison {
  const base = buildForecastWithScenarios(input, []);
  const result = buildForecastWithScenarios(input, scenarios);
  return makeComparison(input, base, result);
}


// Open bills already past due, largest balance first.
export function suggestChaseList(bills: ForecastBill[], today: Date): ChaseItem[] {
  const todayStart = startOfDay(today);
  const items: ChaseItem[] = [];

  for (const bill of bills) {
    if (!(bill.balance > 0)) continue;
    const due = startOfDay(bill.dueDate);
    if (due.getTime() >= todayStart.getTime()) continue;

    items.push({
      billId: bill.id,
      customerName: bill.customerName,
      balance: bill.balance,
      daysOverdue: dayDiff(due, todayStart),
      suggestedAction: "Chase today",
    });
  }

  items.sort((a, b) => b.balance - a.balance);
  return items;
}
