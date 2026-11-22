import { describe, it, expect } from "vitest";
import {
  getReminderStage,
  generateReminder,
  type FollowInvoice,
  type ReminderDraftCustomer,
  type ReminderDraftShop,
} from "../lib/followups";

const today = new Date(2024, 0, 15);
const SHARE_URL = "https://example.test/i/abc123";

const customer: ReminderDraftCustomer = { name: "Sunita Devi", email: null };
const shop: ReminderDraftShop = {
  name: "Sri Laxmi Stores",
  upiId: "shop@upi",
  ownerName: "Ramesh",
};

function sentInvoice(overrides: Partial<FollowInvoice> = {}): FollowInvoice {
  return {
    status: "SENT",
    totalAmount: 5000,
    dueDate: new Date(2024, 0, 18),
    promisedDate: null,
    payments: [],
    ...overrides,
  };
}

type DraftArgs = Parameters<typeof generateReminder>[0];

const baseArgs: DraftArgs = {
  invoice: {
    invoiceNumber: "INV-0012",
    totalAmount: 5500,
    dueDate: new Date(2024, 0, 20),
    payments: [],
    promisedDate: null,
  },
  customer,
  shop,
  tone: "POLITE",
  language: "EN",
  channel: "WHATSAPP",
  today,
  shareUrl: SHARE_URL,
};

function draft(overrides: Partial<DraftArgs>) {
  return generateReminder({ ...baseArgs, ...overrides });
}

describe("getReminderStage boundaries", () => {
  it("due in 3 days gives POLITE", () => {
    const r = getReminderStage(sentInvoice({ dueDate: new Date(2024, 0, 18) }), today);
    expect(r.tone).toBe("POLITE");
    expect(r.promiseBroken).toBe(false);
  });

  it("due in 4 days gives no tone", () => {
    const r = getReminderStage(sentInvoice({ dueDate: new Date(2024, 0, 19) }), today);
    expect(r.tone).toBeNull();
  });

  it("due today gives DUE_TODAY", () => {
    const r = getReminderStage(sentInvoice({ dueDate: new Date(2024, 0, 15) }), today);
    expect(r.tone).toBe("DUE_TODAY");
  });

  it("due 1 day ago gives FIRM with '1 day overdue'", () => {
    const r = getReminderStage(sentInvoice({ dueDate: new Date(2024, 0, 14) }), today);
    expect(r.tone).toBe("FIRM");
    expect(r.reason).toContain("1 day overdue");
  });

  it("due Dec 31 2023 (15 days overdue) gives FINAL", () => {
    const r = getReminderStage(sentInvoice({ dueDate: new Date(2023, 11, 31) }), today);
    expect(r.tone).toBe("FINAL");
  });

  it("due Jan 1 2024 (14 days overdue) gives FIRM", () => {
    const r = getReminderStage(sentInvoice({ dueDate: new Date(2024, 0, 1) }), today);
    expect(r.tone).toBe("FIRM");
  });

  it("a partial payment does not change the due-date tone", () => {
    const r = getReminderStage(
      sentInvoice({
        dueDate: new Date(2024, 0, 18),
        payments: [{ amount: 2000 }],
      }),
      today,
    );
    expect(r.tone).toBe("POLITE");
  });
});

describe("getReminderStage status and payment", () => {
  it("DRAFT invoice gives no tone", () => {
    const r = getReminderStage(sentInvoice({ status: "DRAFT" }), today);
    expect(r.tone).toBeNull();
  });

  it("fully paid invoice gives no tone with reason 'Already paid'", () => {
    const r = getReminderStage(
      sentInvoice({ dueDate: new Date(2023, 11, 31), payments: [{ amount: 5000 }] }),
      today,
    );
    expect(r.tone).toBeNull();
    expect(r.reason).toBe("Already paid");
  });
});

describe("getReminderStage promises", () => {
  it("future promise gives no tone and reason 'Promised for'", () => {
    const r = getReminderStage(
      sentInvoice({
        dueDate: new Date(2023, 11, 31),
        promisedDate: new Date(2024, 0, 20),
      }),
      today,
    );
    expect(r.tone).toBeNull();
    expect(r.reason).toContain("Promised for");
  });

  it("promise dated today is still valid", () => {
    const r = getReminderStage(
      sentInvoice({
        dueDate: new Date(2023, 11, 31),
        promisedDate: new Date(2024, 0, 15),
      }),
      today,
    );
    expect(r.tone).toBeNull();
    expect(r.reason).toContain("Promised for");
    expect(r.promiseBroken).toBe(false);
  });

  it("broken promise gives FIRM with promiseBroken true", () => {
    const r = getReminderStage(
      sentInvoice({
        dueDate: new Date(2023, 11, 31),
        promisedDate: new Date(2024, 0, 10),
      }),
      today,
    );
    expect(r.tone).toBe("FIRM");
    expect(r.promiseBroken).toBe(true);
  });
});

describe("generateReminder", () => {
  it("EN POLITE uses the balance, not the total, and includes the details", () => {
    const d = draft({
      invoice: {
        invoiceNumber: "INV-0012",
        totalAmount: 5500,
        dueDate: new Date(2024, 0, 20),
        payments: [{ amount: 2000 }],
        promisedDate: null,
      },
      tone: "POLITE",
      language: "EN",
    });
    expect(d.body).toContain("₹3,500");
    expect(d.body).not.toContain("₹5,500");
    expect(d.body).toContain("Hi Sunita ji");
    expect(d.body).toContain("(INV-0012)");
    expect(d.body).toContain("due on 20th");
    expect(d.body).toContain("UPI: shop@upi");
    expect(d.body).toContain(SHARE_URL);
  });

  it("EN FIRM 12 days overdue shows the days and amount", () => {
    const d = draft({
      invoice: {
        invoiceNumber: "INV-0012",
        totalAmount: 4200,
        dueDate: new Date(2024, 0, 3),
        payments: [],
        promisedDate: null,
      },
      tone: "FIRM",
      language: "EN",
    });
    expect(d.body).toContain("overdue by 12 days");
    expect(d.body).toContain("₹4,200");
  });

  it("EN FIRM 1 day overdue uses singular 'day'", () => {
    const d = draft({
      invoice: {
        invoiceNumber: "INV-0012",
        totalAmount: 4200,
        dueDate: new Date(2024, 0, 14),
        payments: [],
        promisedDate: null,
      },
      tone: "FIRM",
      language: "EN",
    });
    expect(d.body).toContain("overdue by 1 day");
    expect(d.body).not.toContain("1 days");
  });

  it("HI POLITE contains 'due hai' and the greeting", () => {
    const d = draft({ tone: "POLITE", language: "HI" });
    expect(d.body).toContain("due hai");
    expect(d.body).toContain("Namaste Sunita ji");
  });

  it("HI FIRM contains 'din se overdue hai'", () => {
    const d = draft({
      invoice: {
        invoiceNumber: "INV-0012",
        totalAmount: 4200,
        dueDate: new Date(2024, 0, 3),
        payments: [],
        promisedDate: null,
      },
      tone: "FIRM",
      language: "HI",
    });
    expect(d.body).toContain("din se overdue hai");
  });

  it("EN broken promise says 'had promised to pay' and 'still pending'", () => {
    const d = draft({
      invoice: {
        invoiceNumber: "INV-0012",
        totalAmount: 5500,
        dueDate: new Date(2023, 11, 31),
        payments: [],
        promisedDate: new Date(2024, 0, 10),
      },
      tone: "FIRM",
      language: "EN",
    });
    expect(d.body).toContain("had promised to pay");
    expect(d.body).toContain("still pending");
  });

  it("EN FINAL contains 'final reminder'", () => {
    const d = draft({
      invoice: {
        invoiceNumber: "INV-0012",
        totalAmount: 5500,
        dueDate: new Date(2023, 11, 31),
        payments: [],
        promisedDate: null,
      },
      tone: "FINAL",
      language: "EN",
    });
    expect(d.body).toContain("final reminder");
  });

  it("EMAIL channel gives a subject containing the invoice number", () => {
    const d = draft({ channel: "EMAIL" });
    expect(d.subject).not.toBeNull();
    expect(d.subject).toContain("INV-0012");
  });

  it("WHATSAPP channel gives a null subject", () => {
    const d = draft({ channel: "WHATSAPP" });
    expect(d.subject).toBeNull();
    expect(d.needsEmail).toBe(false);
  });

  it("EMAIL with no customer email sets needsEmail and still returns a body", () => {
    const d = draft({
      channel: "EMAIL",
      customer: { name: "Sunita Devi", email: null },
    });
    expect(d.needsEmail).toBe(true);
    expect(d.body.length).toBeGreaterThan(0);
  });

  it("EMAIL with a customer email sets needsEmail false", () => {
    const d = draft({
      channel: "EMAIL",
      customer: { name: "Sunita Devi", email: "sunita@example.test" },
    });
    expect(d.needsEmail).toBe(false);
  });

  it("EMAIL body has the greeting first and the sign-off last", () => {
    const d = draft({ channel: "EMAIL" });
    expect(d.body.startsWith("Dear Sunita Devi,")).toBe(true);
    expect(d.body.endsWith("Regards, Ramesh, Sri Laxmi Stores")).toBe(true);
  });
});
