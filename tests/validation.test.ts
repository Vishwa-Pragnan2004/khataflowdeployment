import { describe, it, expect } from "vitest";
import { customerSchema, billSchema } from "../lib/validation";

describe("customerSchema", () => {
  it("rejects a WhatsApp number that does not start with 6-9", () => {
    expect(
      customerSchema.safeParse({ name: "Ramesh", whatsappNumber: "5123456789" }).success,
    ).toBe(false);
  });

  it("accepts a valid 10-digit WhatsApp number", () => {
    expect(
      customerSchema.safeParse({ name: "Ramesh", whatsappNumber: "9876543210" }).success,
    ).toBe(true);
  });
});

describe("billSchema", () => {
  it("rejects paidNow greater than totalAmount", () => {
    const result = billSchema.safeParse({
      customerId: 1,
      totalAmount: 5000,
      dueDate: "2024-02-01",
      paidNow: 6000,
      paidMethod: "CASH",
    });
    expect(result.success).toBe(false);
  });
});
