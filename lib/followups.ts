import { getBillStatus } from "./billStatus";
import { formatRupees } from "./money";
import { firstNameOf, ordinalDay } from "./reminders";
import { formatShortDate, startOfDay } from "./dates";

export type FollowTone = "POLITE" | "DUE_TODAY" | "FIRM" | "FINAL";
export type FollowChannel = "WHATSAPP" | "EMAIL" | "COPY";
export type FollowLanguage = "EN" | "HI";

export type FollowInvoice = {
  status: "DRAFT" | "SENT" | "CANCELLED";
  totalAmount: number;
  dueDate: Date;
  promisedDate: Date | null;
  payments: { amount: number }[];
};

export type ToneRecommendation = {
  tone: FollowTone | null;
  reason: string;
  promiseBroken: boolean;
};

const DAY_MS = 86400000;

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
function dayDiff(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
  );
}

export function getReminderStage(
  invoice: FollowInvoice,
  today: Date,
): ToneRecommendation {
  if (invoice.status !== "SENT") {
    return { tone: null, reason: "Nothing to chase yet", promiseBroken: false };
  }

  const { balance } = getBillStatus(
    {
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      payments: invoice.payments,
    },
    today,
  );
  if (balance <= 0) {
    return { tone: null, reason: "Already paid", promiseBroken: false };
  }

  const promisedDate = invoice.promisedDate;
  if (promisedDate !== null) {
    if (startOfDay(promisedDate).getTime() >= startOfDay(today).getTime()) {
      return {
        tone: null,
        reason: "Promised for " + formatShortDate(promisedDate),
        promiseBroken: false,
      };
    }
    return {
      tone: "FIRM",
      reason:
        "Promise broken (promised for " +
        formatShortDate(promisedDate) +
        "), firm nudge recommended",
      promiseBroken: true,
    };
  }

  const daysUntil = dayDiff(today, invoice.dueDate);

  if (daysUntil >= 1 && daysUntil <= 3) {
    return {
      tone: "POLITE",
      reason:
        "Due in " +
        daysUntil +
        (daysUntil === 1 ? " day" : " days") +
        ", polite reminder recommended",
      promiseBroken: false,
    };
  }

  if (daysUntil > 3) {
    return { tone: null, reason: "Not due yet", promiseBroken: false };
  }

  if (daysUntil === 0) {
    return { tone: "DUE_TODAY", reason: "Due today", promiseBroken: false };
  }

  const overdue = -daysUntil;
  if (overdue <= 14) {
    return {
      tone: "FIRM",
      reason:
        overdue +
        (overdue === 1 ? " day" : " days") +
        " overdue, firm nudge recommended",
      promiseBroken: false,
    };
  }

  return {
    tone: "FINAL",
    reason: overdue + " days overdue, final reminder recommended",
    promiseBroken: false,
  };
}

export type ReminderDraftInput = {
  invoiceNumber: string;
  totalAmount: number;
  dueDate: Date;
  payments: { amount: number }[];
  promisedDate: Date | null;
};

export type ReminderDraftCustomer = {
  name: string;
  email: string | null;
};

export type ReminderDraftShop = {
  name: string;
  upiId: string;
  ownerName: string;
};

export type ReminderDraft = {
  subject: string | null;
  body: string;
  needsEmail: boolean;
};

export function generateReminder(args: {
  invoice: ReminderDraftInput;
  customer: ReminderDraftCustomer;
  shop: ReminderDraftShop;
  tone: FollowTone;
  language: FollowLanguage;
  channel: FollowChannel;
  today: Date;
  shareUrl: string;
}): ReminderDraft {
  const { invoice, customer, shop, tone, language, channel, today, shareUrl } =
    args;

  const { balance } = getBillStatus(
    {
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      payments: invoice.payments,
    },
    today,
  );

  const money = formatRupees(Math.max(0, balance));
  const name = firstNameOf(customer.name);
  const due = ordinalDay(invoice.dueDate);
  const inv = invoice.invoiceNumber;
  const upi = shop.upiId;
  const overdueDays = Math.max(0, dayDiff(invoice.dueDate, today));
  const link = shareUrl;
  const promisedDate = invoice.promisedDate;
  const promiseDate = promisedDate !== null ? formatShortDate(promisedDate) : "";
  const promiseBroken =
    tone === "FIRM" &&
    promisedDate !== null &&
    startOfDay(promisedDate).getTime() < startOfDay(today).getTime();

  let body: string;
  if (language === "EN") {
    if (tone === "POLITE") {
      body = `Hi ${name} ji, quick reminder that ${money} (${inv}) at ${shop.name} is due on ${due}. UPI: ${upi}. Invoice: ${link}`;
    } else if (tone === "DUE_TODAY") {
      body = `Hi ${name} ji, ${money} (${inv}) is due today. UPI: ${upi}. Invoice: ${link}`;
    } else if (tone === "FIRM") {
      body = promiseBroken
        ? `Hi ${name} ji, you had promised to pay ${money} (${inv}) by ${promiseDate}, but it is still pending. Kindly clear it today. UPI: ${upi}. Invoice: ${link}`
        : `Hi ${name} ji, ${money} (${inv}) is overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}. Kindly clear it at your earliest convenience so we can settle our distributor bills. UPI: ${upi}. Invoice: ${link}`;
    } else {
      body = `Hi ${name} ji, ${money} (${inv}) is now ${overdueDays} days overdue. This is our final reminder before we stop further credit. Please clear it or call us. UPI: ${upi}. Invoice: ${link}`;
    }
  } else {
    if (tone === "POLITE") {
      body = `Namaste ${name} ji, ${money} ka balance (${inv}) ${due} tareekh ko due hai. Jab convenient ho UPI kar dijiye. UPI: ${upi}. Invoice: ${link}`;
    } else if (tone === "DUE_TODAY") {
      body = `Namaste ${name} ji, ${money} (${inv}) aaj due hai. UPI: ${upi}. Invoice: ${link}`;
    } else if (tone === "FIRM") {
      body = promiseBroken
        ? `Namaste ${name} ji, aapne ${promiseDate} tak ${money} (${inv}) dene ka vaada kiya tha, abhi tak baaki hai. Kripya aaj clear kar dijiye. UPI: ${upi}. Invoice: ${link}`
        : `Namaste ${name} ji, ${money} (${inv}) ${overdueDays} din se overdue hai. Kripya jald se jald clear kar dijiye, taaki hum apne distributor ke bills settle kar saken. UPI: ${upi}. Invoice: ${link}`;
    } else {
      body = `Namaste ${name} ji, ${money} (${inv}) ${overdueDays} din se overdue hai. Ye hamara aakhri reminder hai, aage credit rokna padega. Kripya clear kar dijiye ya call kijiye. UPI: ${upi}. Invoice: ${link}`;
    }
  }

  if (channel !== "EMAIL") {
    return { subject: null, body, needsEmail: false };
  }

  const subjectSuffix =
    tone === "FINAL"
      ? "final reminder"
      : tone === "FIRM"
        ? "overdue"
        : tone === "DUE_TODAY"
          ? "due today"
          : "due soon";

  return {
    subject: `${inv}: ${money} ${subjectSuffix}`,
    body: `Dear ${customer.name},\n\n${body}\n\nRegards, ${shop.ownerName}, ${shop.name}`,
    needsEmail: !customer.email,
  };
}
