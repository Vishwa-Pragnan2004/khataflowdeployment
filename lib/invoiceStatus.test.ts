import { describe, it, expect } from "vitest";
import { buildStatusGroups } from "./invoiceStatus";

const customerA = { id: 1, name: "Asha", whatsappNumber: "9876543210" };
const customerB = { id: 2, name: "Ravi", whatsappNumber: "9123456780" };

function bill(
  billNumber: string,
  customer: typeof customerA,
  totalAmount: number,
  payments: number[],
) {
  return {
    billNumber,
    billDate: new Date(2024, 0, 10),
    totalAmount,
    customer,
    payments: payments.map((amount) => ({ amount })),
  };
}

describe("buildStatusGroups", () => {
  it("puts a fully paid bill in PAID", () => {
    const result = buildStatusGroups([bill("B1", customerA, 5000, [3000, 2000])]);
    expect(result.counts.PAID).toBe(1);
    expect(result.groups.PAID[0].invoices[0].category).toBe("PAID");
    expect(result.groups.PAID[0].invoices[0].remaining).toBe(0);
  });

  it("puts a part-paid bill in PARTIAL with the correct remaining", () => {
    const result = buildStatusGroups([bill("B2", customerA, 5000, [2000])]);
    expect(result.counts.PARTIAL).toBe(1);
    const invoice = result.groups.PARTIAL[0].invoices[0];
    expect(invoice.category).toBe("PARTIAL");
    expect(invoice.paid).toBe(2000);
    expect(invoice.remaining).toBe(3000);
  });

  it("puts a bill with no payments in UNPAID", () => {
    const result = buildStatusGroups([bill("B3", customerB, 4000, [])]);
    expect(result.counts.UNPAID).toBe(1);
    expect(result.groups.UNPAID[0].phone).toBe("9123456780");
    expect(result.groups.UNPAID[0].invoices[0].remaining).toBe(4000);
  });

  it("lists a customer with invoices in two groups in both, keeping each invoice intact", () => {
    const result = buildStatusGroups([
      bill("B4", customerA, 1000, [1000]),
      bill("B5", customerA, 2500, []),
    ]);
    expect(result.groups.PAID).toHaveLength(1);
    expect(result.groups.UNPAID).toHaveLength(1);
    expect(result.groups.PAID[0].invoices).toEqual([
      expect.objectContaining({ billNumber: "B4", totalAmount: 1000, paid: 1000, remaining: 0 }),
    ]);
    expect(result.groups.UNPAID[0].invoices).toEqual([
      expect.objectContaining({ billNumber: "B5", totalAmount: 2500, paid: 0, remaining: 2500 }),
    ]);
  });

  it("keeps one row per invoice when a customer has several in the same group", () => {
    const result = buildStatusGroups([
      bill("B6", customerA, 1000, []),
      bill("B7", customerA, 700, []),
    ]);
    expect(result.groups.UNPAID).toHaveLength(1);
    expect(result.groups.UNPAID[0].invoices.map((i) => i.billNumber)).toEqual(["B6", "B7"]);
  });

  it("sums amounts per category: PAID uses total, PARTIAL and UNPAID use remaining", () => {
    const result = buildStatusGroups([
      bill("P1", customerA, 5000, [5000]),
      bill("P2", customerB, 1200, [1200]),
      bill("R1", customerA, 5000, [2000]),
      bill("U1", customerB, 800, []),
      bill("U2", customerB, 200, []),
    ]);
    expect(result.amounts.PAID).toBe(6200);
    expect(result.amounts.PARTIAL).toBe(3000);
    expect(result.amounts.UNPAID).toBe(1000);
    expect(result.counts).toEqual({ PAID: 2, PARTIAL: 1, UNPAID: 2 });
  });

  it("never reports negative remaining for an overpaid bill", () => {
    const result = buildStatusGroups([bill("O1", customerA, 1000, [1500])]);
    expect(result.groups.PAID[0].invoices[0].remaining).toBe(0);
    expect(result.amounts.PAID).toBe(1000);
  });
});
