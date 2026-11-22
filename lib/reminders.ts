
import { getBillStatus } from "./billStatus";
import { daysOverdue } from "./udhaarList";
import { formatRupees } from "./money";
import { startOfDay } from "./dates";
import type { ReminderTone } from "./whatsapp";

export type ReminderLanguage = "EN" | "HI";

export type ReminderBillInput = {
  totalAmount: number;
  dueDate: Date;
  itemsNote: string | null;
  payments: { amount: number }[];
};

export type ReminderCustomerInput = {
  name: string;
};

export type ReminderShopInput = {
  name: string;
  upiId: string;
};

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

export function defaultTone(
  bill: ReminderBillInput,
  today: Date,
): ReminderTone {
  const status = getBillStatus(
    {
      totalAmount: bill.totalAmount,
      dueDate: bill.dueDate,
      payments: bill.payments,
    },
    today,
  );

  return status.isOverdue ? "FIRM" : "POLITE";
}

export function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "Customer";
}

export function ordinalDay(d: Date): string {
  const n = d.getDate();
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatItemsPhrase(
  itemsNote: string | null,
  language: ReminderLanguage,
): string {
  if (itemsNote !== null) {
    const lines = itemsNote
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 0) return lines.join(", ");
  }

  return language === "HI" ? "aapki kharidari" : "your purchase";
}

export function generateReminder(args: {
  bill: ReminderBillInput;
  customer: ReminderCustomerInput;
  shop: ReminderShopInput;
  tone: ReminderTone;
  today: Date;
  language?: ReminderLanguage;
}): string {
  const { bill, customer, shop, tone, today } = args;
  const language: ReminderLanguage = args.language ?? "EN";

  const status = getBillStatus(
    {
      totalAmount: bill.totalAmount,
      dueDate: bill.dueDate,
      payments: bill.payments,
    },
    today,
  );

  const money = formatRupees(Math.max(0, status.balance));
  const overdueDays = daysOverdue(bill.dueDate, today);
  const name = firstNameOf(customer.name);
  const items = formatItemsPhrase(bill.itemsNote, language);
  const due = ordinalDay(bill.dueDate);
  const upi = shop.upiId;
  const shopName = shop.name;

  if (language === "EN") {
    if (tone === "POLITE") {
      return `Hi ${name} ji, quick reminder that ${money} for ${items} at ${shopName} is due on ${due}. UPI: ${upi}`;
    }

    const dayWord = overdueDays === 1 ? "day" : "days";
    const phrase =
      overdueDays > 0
        ? `is overdue by ${overdueDays} ${dayWord}`
        : `is due on ${due}`;

    return `Hi ${name} ji, ${money} ${phrase}. Kindly clear at your earliest convenience so we can settle our distributor bills. UPI: ${upi}`;
  }

  if (tone === "POLITE") {
    return `Hi ${name} ji, ek chhoti si yaad dilani thi, ${items} ka ${money} ${shopName} ko ${due} tak dena hai. UPI: ${upi}`;
  }

  const phraseHi =
    overdueDays > 0
      ? `${overdueDays} din se overdue hai`
      : `${due} tak dena hai`;

  return `Hi ${name} ji, ${money} ${phraseHi}. Kripya jald se jald clear kar dijiye, taaki hum apne distributor ke bills settle kar saken. UPI: ${upi}`;
}

export function recentReminderWarning(
  lastSentAt: Date | null,
  now: Date,
): string | null {
  if (lastSentAt === null) return null;

  const diffMs = Math.max(0, now.getTime() - lastSentAt.getTime());

  if (diffMs >= DAY_MS) return null;

  const hours = Math.floor(diffMs / HOUR_MS);

  if (hours < 1) {
    return "Reminded less than an hour ago, send again?";
  }

  return `Reminded ${hours} ${hours === 1 ? "hour" : "hours"} ago, send again?`;
}

export function lastRemindedLabel(
  lastSentAt: Date | null,
  today: Date,
): string | null {
  if (lastSentAt === null) return null;

  const raw = Math.round(
    (startOfDay(today).getTime() -
      startOfDay(lastSentAt).getTime()) /
      DAY_MS,
  );

  const days = Math.max(0, raw);

  if (days === 0) return "Last reminded today";
  if (days === 1) return "Last reminded 1 day ago";

  return `Last reminded ${days} days ago`;
}
