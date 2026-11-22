import { describe, it, expect } from "vitest";
import {
  buildListHref,
  buildUdhaarRows,
  daysOverdue,
  filterRows,
  parseStatusParam,
  sortRows,
  summarize,
  toggleStatus,
  type UdhaarBillInput,
  type UdhaarRow,
} from "../lib/udhaarList";

const today = new Date(2024, 0, 15);

function bill(overrides: Partial<UdhaarBillInput> & { id: number }): UdhaarBillInput {
  return {
    billNumber: `B-${overrides.id}`,
    customerName: "Customer",
    totalAmount: 1000,
    dueDate: new Date(2024, 0, 20),
    payments: [],
    ...overrides,
  };
}

describe("parseStatusParam", () => {
  it("returns the default for undefined", () => {
    expect(parseStatusParam(undefined)).toEqual(["OVERDUE", "UNPAID"]);
  });

  it("returns all four statuses for ALL", () => {
    expect(parseStatusParam("ALL")).toEqual(["UNPAID", "PARTIALLY_PAID", "OVERDUE", "PAID"]);
  });

  it("dedupes and drops unknown values", () => {
    expect(parseStatusParam("PAID,bogus,PAID")).toEqual(["PAID"]);
  });

  it("returns the default when nothing valid is given", () => {
    expect(parseStatusParam("bogus")).toEqual(["OVERDUE", "UNPAID"]);
  });
});

describe("daysOverdue", () => {
  it("counts days past due", () => {
    expect(daysOverdue(new Date(2024, 0, 10), today)).toBe(5);
  });

  it("gives 0 when due today", () => {
    expect(daysOverdue(new Date(2024, 0, 15), today)).toBe(0);
  });

  it("gives 0 when due in the future", () => {
    expect(daysOverdue(new Date(2024, 0, 20), today)).toBe(0);
  });
});

describe("buildUdhaarRows", () => {
  it("marks a partly paid overdue bill as OVERDUE with balance and days", () => {
    const [row] = buildUdhaarRows(
      [bill({ id: 1, totalAmount: 5000, dueDate: new Date(2024, 0, 10), payments: [{ amount: 2000 }] })],
      today,
    );
    expect(row.status).toBe("OVERDUE");
    expect(row.balance).toBe(3000);
    expect(row.paid).toBe(2000);
    expect(row.daysOverdue).toBe(5);
  });

  it("marks a fully paid bill as PAID with 0 days overdue", () => {
    const [row] = buildUdhaarRows(
      [bill({ id: 2, totalAmount: 1000, dueDate: new Date(2024, 0, 10), payments: [{ amount: 1000 }] })],
      today,
    );
    expect(row.status).toBe("PAID");
    expect(row.daysOverdue).toBe(0);
  });
});

function makeRow(overrides: Partial<UdhaarRow> & { id: number }): UdhaarRow {
  return {
    billNumber: `B-${overrides.id}`,
    customerName: "Customer",
    totalAmount: 1000,
    dueDate: new Date(2024, 0, 20),
    payments: [],
    paid: 0,
    balance: 1000,
    status: "UNPAID",
    daysOverdue: 0,
    ...overrides,
  };
}

describe("filterRows", () => {
  const rows: UdhaarRow[] = [
    makeRow({ id: 1, status: "OVERDUE", customerName: "Ramesh", daysOverdue: 3 }),
    makeRow({ id: 2, status: "UNPAID", customerName: "Sita" }),
    makeRow({ id: 3, status: "PAID", customerName: "Ravi", balance: 0 }),
  ];

  it("excludes PAID when statuses are OVERDUE and UNPAID", () => {
    const result = filterRows(rows, ["OVERDUE", "UNPAID"], "");
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });

  it("matches the query case-insensitively", () => {
    const result = filterRows(rows, ["OVERDUE", "UNPAID", "PAID"], "ram");
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("keeps all rows for a blank query", () => {
    const result = filterRows(rows, ["OVERDUE", "UNPAID", "PAID"], "   ");
    expect(result).toHaveLength(3);
  });
});

describe("sortRows", () => {
  it("puts the 10-day overdue row before the 2-day overdue row", () => {
    const rows = [
      makeRow({ id: 1, status: "OVERDUE", daysOverdue: 2, dueDate: new Date(2024, 0, 13) }),
      makeRow({ id: 2, status: "OVERDUE", daysOverdue: 10, dueDate: new Date(2024, 0, 5) }),
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual([2, 1]);
  });

  it("puts overdue rows before a due-today UNPAID row", () => {
    const rows = [
      makeRow({ id: 1, status: "UNPAID", dueDate: new Date(2024, 0, 15) }),
      makeRow({ id: 2, status: "OVERDUE", daysOverdue: 1, dueDate: new Date(2024, 0, 14) }),
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual([2, 1]);
  });

  it("sorts non-overdue rows by dueDate ascending", () => {
    const rows = [
      makeRow({ id: 1, status: "UNPAID", dueDate: new Date(2024, 0, 25) }),
      makeRow({ id: 2, status: "PARTIALLY_PAID", dueDate: new Date(2024, 0, 18) }),
      makeRow({ id: 3, status: "UNPAID", dueDate: new Date(2024, 0, 16) }),
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});

describe("summarize", () => {
  const rows = [
    makeRow({ id: 1, status: "OVERDUE", balance: 3000, daysOverdue: 5 }),
    makeRow({ id: 2, status: "UNPAID", balance: 500 }),
    makeRow({ id: 3, status: "PAID", balance: 0 }),
    makeRow({ id: 4, status: "OVERDUE", balance: 700, daysOverdue: 2 }),
  ];

  it("excludes PAID rows from totalOutstanding", () => {
    expect(summarize(rows).totalOutstanding).toBe(4200);
  });

  it("sums OVERDUE balances into totalOverdue", () => {
    expect(summarize(rows).totalOverdue).toBe(3700);
  });

  it("counts OVERDUE rows", () => {
    expect(summarize(rows).overdueCount).toBe(2);
  });
});

describe("buildListHref", () => {
  it("encodes a status subset", () => {
    expect(buildListHref(["OVERDUE", "UNPAID"], "")).toBe("/?status=UNPAID%2COVERDUE");
  });

  it("uses ALL and includes the query when all statuses are selected", () => {
    expect(buildListHref(["UNPAID", "PARTIALLY_PAID", "OVERDUE", "PAID"], "Ram")).toBe(
      "/?status=ALL&q=Ram",
    );
  });
});

describe("toggleStatus", () => {
  it("selects only the clicked status", () => {
    expect(toggleStatus(["OVERDUE", "UNPAID"], "PARTIALLY_PAID")).toEqual(["PARTIALLY_PAID"]);
  });

  it("returns to All when the already-active status is clicked", () => {
    expect(toggleStatus(["OVERDUE"], "OVERDUE")).toEqual(["UNPAID", "PARTIALLY_PAID", "OVERDUE", "PAID"]);
  });
});
