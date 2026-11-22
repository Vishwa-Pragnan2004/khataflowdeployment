import { describe, it, expect } from "vitest";
import { getBillStatus } from "../lib/billStatus";

const today = new Date(2024, 0, 15);

describe("getBillStatus", () => {
  it("returns PAID when fully paid", () => {
    const result = getBillStatus(
      { totalAmount: 5000, dueDate: new Date(2024, 1, 1), payments: [{ amount: 5000 }] },
      today,
    );
    expect(result.status).toBe("PAID");
    expect(result.balance).toBe(0);
  });

  it("returns PARTIALLY_PAID when part paid and not yet due", () => {
    const result = getBillStatus(
      { totalAmount: 5000, dueDate: new Date(2024, 1, 1), payments: [{ amount: 2000 }] },
      today,
    );
    expect(result.status).toBe("PARTIALLY_PAID");
    expect(result.balance).toBe(3000);
    expect(result.isOverdue).toBe(false);
  });

  it("returns OVERDUE when past due with a balance", () => {
    const result = getBillStatus(
      { totalAmount: 5000, dueDate: new Date(2024, 0, 14), payments: [{ amount: 2000 }] },
      today,
    );
    expect(result.status).toBe("OVERDUE");
    expect(result.paid).toBe(2000);
    expect(result.balance).toBe(3000);
    expect(result.isOverdue).toBe(true);
  });

  it("returns UNPAID when there are no payments and the due date is in the future", () => {
    const result = getBillStatus(
      { totalAmount: 5000, dueDate: new Date(2024, 1, 1), payments: [] },
      today,
    );
    expect(result.status).toBe("UNPAID");
    expect(result.isOverdue).toBe(false);
  });

  it("returns UNPAID with isOverdue false when due today with no payment", () => {
    const result = getBillStatus(
      { totalAmount: 5000, dueDate: new Date(2024, 0, 15), payments: [] },
      today,
    );
    expect(result.status).toBe("UNPAID");
    expect(result.isOverdue).toBe(false);
  });

  it("returns PAID with a negative balance when overpaid", () => {
    const result = getBillStatus(
      { totalAmount: 5000, dueDate: new Date(2024, 1, 1), payments: [{ amount: 6000 }] },
      today,
    );
    expect(result.status).toBe("PAID");
    expect(result.balance).toBe(-1000);
  });
});
