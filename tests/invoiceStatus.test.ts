import { describe, it, expect } from "vitest";
import { allowedActions, deriveInvoiceStatus, statusAfterSend } from "../lib/invoiceStatus";

const today = new Date(2024, 0, 15);

describe("deriveInvoiceStatus", () => {
  it("DRAFT with a future due date gives DRAFT", () => {
    const result = deriveInvoiceStatus(
      { status: "DRAFT", totalAmount: 5000, dueDate: new Date(2024, 0, 20), payments: [] },
      today,
    );
    expect(result.display).toBe("DRAFT");
  });

  it("SENT with no payments and a future due date gives SENT with 5 days until due", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 20), payments: [] },
      today,
    );
    expect(result.display).toBe("SENT");
    expect(result.daysUntilDue).toBe(5);
    expect(result.daysOverdue).toBe(0);
  });

  it("partially paid 2000 of 5000 gives PARTIALLY_PAID with balance 3000", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 20), payments: [{ amount: 2000 }] },
      today,
    );
    expect(result.display).toBe("PARTIALLY_PAID");
    expect(result.balance).toBe(3000);
    expect(result.paidAmount).toBe(2000);
  });

  it("unpaid past due gives OVERDUE with 5 days overdue", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 10), payments: [] },
      today,
    );
    expect(result.display).toBe("OVERDUE");
    expect(result.daysOverdue).toBe(5);
  });

  it("overdue with 2000 paid gives OVERDUE with paidAmount 2000 and balance 3000", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 10), payments: [{ amount: 2000 }] },
      today,
    );
    expect(result.display).toBe("OVERDUE");
    expect(result.paidAmount).toBe(2000);
    expect(result.balance).toBe(3000);
  });

  it("fully paid gives PAID with balance 0", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 20), payments: [{ amount: 5000 }] },
      today,
    );
    expect(result.display).toBe("PAID");
    expect(result.balance).toBe(0);
  });

  it("overpaid 6000 of 5000 gives PAID with balance -1000", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 20), payments: [{ amount: 6000 }] },
      today,
    );
    expect(result.display).toBe("PAID");
    expect(result.balance).toBe(-1000);
  });

  it("CANCELLED with payments gives CANCELLED", () => {
    const result = deriveInvoiceStatus(
      { status: "CANCELLED", totalAmount: 5000, dueDate: new Date(2024, 0, 10), payments: [{ amount: 2000 }] },
      today,
    );
    expect(result.display).toBe("CANCELLED");
  });

  it("due today with no payments gives SENT, not OVERDUE", () => {
    const result = deriveInvoiceStatus(
      { status: "SENT", totalAmount: 5000, dueDate: new Date(2024, 0, 15), payments: [] },
      today,
    );
    expect(result.display).toBe("SENT");
    expect(result.daysOverdue).toBe(0);
  });
});

describe("allowedActions", () => {
  it("DRAFT allows delete", () => {
    expect(allowedActions("DRAFT", 0).canDelete).toBe(true);
  });

  it("SENT with nothing paid allows cancel", () => {
    const actions = allowedActions("SENT", 0);
    expect(actions.canCancel).toBe(true);
    expect(actions.cancelBlockedReason).toBeNull();
  });

  it("PARTIALLY_PAID with 2000 paid blocks cancel with a reason", () => {
    const actions = allowedActions("PARTIALLY_PAID", 2000);
    expect(actions.canCancel).toBe(false);
    expect(actions.cancelBlockedReason).not.toBeNull();
  });

  it("PAID is LOCKED", () => {
    expect(allowedActions("PAID", 5000).editMode).toBe("LOCKED");
  });

  it("CANCELLED cannot record payment", () => {
    expect(allowedActions("CANCELLED", 0).canRecordPayment).toBe(false);
  });
});

describe("statusAfterSend", () => {
  it("DRAFT becomes SENT", () => {
    expect(statusAfterSend("DRAFT")).toBe("SENT");
  });

  it("CANCELLED stays CANCELLED", () => {
    expect(statusAfterSend("CANCELLED")).toBe("CANCELLED");
  });
});
