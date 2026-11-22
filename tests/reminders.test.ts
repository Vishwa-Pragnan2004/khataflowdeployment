import { describe, it, expect } from "vitest";
import {
  defaultTone,
  firstNameOf,
  ordinalDay,
  formatItemsPhrase,
  generateReminder,
  recentReminderWarning,
  lastRemindedLabel,
  type ReminderBillInput,
} from "../lib/reminders";
import { buildWhatsAppLink } from "../lib/whatsapp";
import { computeDueDate } from "../lib/dueDates";

const today = new Date(2024, 0, 15);
const customer = { name: "Sunita Devi" };
const shop = { name: "Sri Laxmi Stores", upiId: "shop@upi" };

function makeBill(overrides: Partial<ReminderBillInput> = {}): ReminderBillInput {
  return {
    totalAmount: 5500,
    dueDate: new Date(2024, 0, 20),
    itemsNote: "Monthly groceries",
    payments: [{ amount: 2000 }],
    ...overrides,
  };
}

describe("defaultTone", () => {
  it("returns POLITE when the bill is not yet overdue", () => {
    const bill = makeBill({ totalAmount: 5500, dueDate: new Date(2024, 0, 20), payments: [] });
    expect(defaultTone(bill, today)).toBe("POLITE");
  });

  it("returns FIRM when the bill is overdue", () => {
    const bill = makeBill({ totalAmount: 5500, dueDate: new Date(2024, 0, 10), payments: [] });
    expect(defaultTone(bill, today)).toBe("FIRM");
  });
});

describe("generateReminder", () => {
  it("builds an EN POLITE message using the balance", () => {
    const message = generateReminder({
      bill: makeBill(),
      customer,
      shop,
      tone: "POLITE",
      today,
    });
    expect(message).toContain("₹3,500");
    expect(message).not.toContain("₹5,500");
    expect(message).toContain("Hi Sunita ji");
    expect(message).toContain("due on 20th");
    expect(message).toContain("UPI: shop@upi");
  });

  it("builds an EN FIRM message for a bill overdue by 5 days", () => {
    const message = generateReminder({
      bill: makeBill({ totalAmount: 2300, dueDate: new Date(2024, 0, 10), payments: [], itemsNote: null }),
      customer,
      shop,
      tone: "FIRM",
      today,
    });
    expect(message).toContain("is overdue by 5 days");
    expect(message).toContain("₹2,300");
  });

  it("uses singular 'day' when overdue by 1 day", () => {
    const message = generateReminder({
      bill: makeBill({ dueDate: new Date(2024, 0, 14), payments: [] }),
      customer,
      shop,
      tone: "FIRM",
      today,
    });
    expect(message).toContain("overdue by 1 day");
    expect(message).not.toContain("1 days");
  });

  it("uses the due-date wording in FIRM when due today or later", () => {
    const message = generateReminder({
      bill: makeBill({ dueDate: new Date(2024, 0, 20), payments: [] }),
      customer,
      shop,
      tone: "FIRM",
      today,
    });
    expect(message).toContain("is due on 20th");
    expect(message).not.toContain("overdue");
  });

  it("uses 'your purchase' in EN POLITE when itemsNote is null", () => {
    const message = generateReminder({
      bill: makeBill({ itemsNote: null, payments: [] }),
      customer,
      shop,
      tone: "POLITE",
      today,
      language: "EN",
    });
    expect(message).toContain("for your purchase at");
  });

  it("uses 'aapki kharidari' in HI POLITE when itemsNote is null", () => {
    const message = generateReminder({
      bill: makeBill({ itemsNote: null, payments: [] }),
      customer,
      shop,
      tone: "POLITE",
      today,
      language: "HI",
    });
    expect(message).toContain("aapki kharidari");
  });

  it("builds an HI FIRM message for a bill overdue by 3 days", () => {
    const message = generateReminder({
      bill: makeBill({ dueDate: new Date(2024, 0, 12), payments: [] }),
      customer,
      shop,
      tone: "FIRM",
      today,
      language: "HI",
    });
    expect(message).toContain("3 din se overdue hai");
    expect(message).toContain("Hi Sunita ji");
  });

  it("builds an HI POLITE message with the reminder phrase and UPI", () => {
    const message = generateReminder({
      bill: makeBill({ payments: [] }),
      customer,
      shop,
      tone: "POLITE",
      today,
      language: "HI",
    });
    expect(message).toContain("ek chhoti si yaad dilani thi");
    expect(message).toContain("UPI: shop@upi");
  });

  it("shows ₹0 when the bill is overpaid", () => {
    const message = generateReminder({
      bill: makeBill({ totalAmount: 1000, payments: [{ amount: 1500 }] }),
      customer,
      shop,
      tone: "POLITE",
      today,
    });
    expect(message).toContain("₹0");
  });
});

describe("firstNameOf", () => {
  it("returns the first word of a padded full name", () => {
    expect(firstNameOf("  Mohammed Irfan Khan ")).toBe("Mohammed");
  });

  it("falls back to 'Customer' for a blank name", () => {
    expect(firstNameOf("   ")).toBe("Customer");
  });
});

describe("ordinalDay", () => {
  const cases: [number, string][] = [
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [31, "31st"],
  ];

  for (const [n, expected] of cases) {
    it(`formats day ${n} as ${expected}`, () => {
      expect(ordinalDay(new Date(2024, 0, n))).toBe(expected);
    });
  }
});

describe("formatItemsPhrase", () => {
  it("joins non-empty trimmed lines with commas", () => {
    expect(formatItemsPhrase("Atta 5 kg\n Dal 1 kg\n\n", "EN")).toBe("Atta 5 kg, Dal 1 kg");
  });

  it("falls back to 'your purchase' when itemsNote is null", () => {
    expect(formatItemsPhrase(null, "EN")).toBe("your purchase");
  });
});

describe("recentReminderWarning", () => {
  const now = new Date(2024, 0, 15, 12, 0);

  it("returns null when there was no previous reminder", () => {
    expect(recentReminderWarning(null, now)).toBeNull();
  });

  it("warns less than an hour ago for a reminder 30 minutes back", () => {
    expect(recentReminderWarning(new Date(2024, 0, 15, 11, 30), now)).toBe(
      "Reminded less than an hour ago, send again?",
    );
  });

  it("warns 1 hour ago for a reminder 1 hour back", () => {
    expect(recentReminderWarning(new Date(2024, 0, 15, 11, 0), now)).toBe(
      "Reminded 1 hour ago, send again?",
    );
  });

  it("warns 3 hours ago for a reminder 3 hours back", () => {
    expect(recentReminderWarning(new Date(2024, 0, 15, 9, 0), now)).toBe(
      "Reminded 3 hours ago, send again?",
    );
  });

  it("returns null for a reminder 25 hours back", () => {
    expect(recentReminderWarning(new Date(2024, 0, 14, 11, 0), now)).toBeNull();
  });
});

describe("lastRemindedLabel", () => {
  const todayNoon = new Date(2024, 0, 15, 12, 0);

  it("returns null when there was no previous reminder", () => {
    expect(lastRemindedLabel(null, todayNoon)).toBeNull();
  });

  it("says 'today' for a reminder earlier the same day", () => {
    expect(lastRemindedLabel(new Date(2024, 0, 15, 9, 0), todayNoon)).toBe("Last reminded today");
  });

  it("says '1 day ago' for a reminder yesterday", () => {
    expect(lastRemindedLabel(new Date(2024, 0, 14, 9, 0), todayNoon)).toBe("Last reminded 1 day ago");
  });

  it("counts whole days for older reminders", () => {
    expect(lastRemindedLabel(new Date(2024, 0, 11, 9, 0), todayNoon)).toBe(
      "Last reminded 4 days ago",
    );
  });
});

describe("buildWhatsAppLink", () => {
  it("prefixes the country code and URL-encodes the message", () => {
    const message = "Rs ₹500 due\nUPI: a&b=c?";
    expect(buildWhatsAppLink("9876543210", message)).toBe(
      "https://wa.me/919876543210?text=" + encodeURIComponent(message),
    );
  });
});

describe("computeDueDate", () => {
  it("EOM returns the last day of February in a leap year", () => {
    expect(computeDueDate("EOM", new Date(2024, 1, 10)).getTime()).toBe(
      new Date(2024, 1, 29).getTime(),
    );
  });

  it("EOM returns the last day of April", () => {
    expect(computeDueDate("EOM", new Date(2024, 3, 10)).getTime()).toBe(
      new Date(2024, 3, 30).getTime(),
    );
  });

  it("EOM returns the last day of December", () => {
    expect(computeDueDate("EOM", new Date(2024, 11, 10)).getTime()).toBe(
      new Date(2024, 11, 31).getTime(),
    );
  });

  it("EOM returns the last day of January 2025", () => {
    expect(computeDueDate("EOM", new Date(2025, 0, 10)).getTime()).toBe(
      new Date(2025, 0, 31).getTime(),
    );
  });

  it("7d rolls over the year end", () => {
    expect(computeDueDate("7d", new Date(2024, 11, 28)).getTime()).toBe(
      new Date(2025, 0, 4).getTime(),
    );
  });

  it("15d rolls over the year end", () => {
    expect(computeDueDate("15d", new Date(2024, 11, 20)).getTime()).toBe(
      new Date(2025, 0, 4).getTime(),
    );
  });
});
