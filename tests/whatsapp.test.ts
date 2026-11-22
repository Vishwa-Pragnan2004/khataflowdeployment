import { describe, it, expect } from "vitest";
import { buildWaLink, buildReminderMessage } from "../lib/whatsapp";

const dueDate = new Date(2024, 0, 15);

describe("buildWaLink", () => {
  it("builds a wa.me link with the 91 country code and encoded text", () => {
    expect(buildWaLink("9876543210", "hi")).toBe("https://wa.me/919876543210?text=hi");
  });
});

describe("buildReminderMessage", () => {
  it("adds the overdue note for a FIRM reminder on an overdue bill", () => {
    const message = buildReminderMessage({
      tone: "FIRM",
      shopName: "Sharma Kirana",
      customerName: "Ramesh",
      billNumber: "BILL-0001",
      balance: 3000,
      dueDate,
      upiId: "shop@upi",
      ownerName: "Sharma",
      overdue: true,
    });
    expect(message).toContain("due date nikal chuki hai");
  });

  it("includes the UPI id for a POLITE reminder", () => {
    const message = buildReminderMessage({
      tone: "POLITE",
      shopName: "Sharma Kirana",
      customerName: "Ramesh",
      billNumber: "BILL-0001",
      balance: 3000,
      dueDate,
      upiId: "shop@upi",
      ownerName: "Sharma",
      overdue: false,
    });
    expect(message).toContain("UPI: shop@upi");
  });
});
