import { formatRupees } from "./money";
import { formatShortDate } from "./dates";

export type ReminderTone = "POLITE" | "FIRM";

export function buildWaLink(whatsappNumber10: string, message: string): string {
  return `https://wa.me/91${whatsappNumber10}?text=${encodeURIComponent(message)}`;
}

export function buildBillMessage(args: {
  shopName: string;
  customerName: string;
  billNumber: string;
  totalAmount: number;
  paidNow: number;
  dueDate: Date;
  ownerName: string;
}): string {
  const lines: string[] = [
    `Namaste ${args.customerName} ji,`,
    `${args.shopName} se aapka bill ${args.billNumber} bana hai.`,
    `Kul: ${formatRupees(args.totalAmount)}`,
  ];

  if (args.paidNow > 0) {
    lines.push(`Abhi mile: ${formatRupees(args.paidNow)}`);
    lines.push(`Baaki: ${formatRupees(args.totalAmount - args.paidNow)}`);
  } else {
    lines.push(`Baaki: ${formatRupees(args.totalAmount)}`);
  }

  lines.push(
    `Please ${formatShortDate(args.dueDate)} tak de dijiye. Dhanyavaad. - ${args.ownerName}`,
  );

  return lines.join("\n");
}

export function buildReminderMessage(args: {
  tone: ReminderTone;
  shopName: string;
  customerName: string;
  billNumber: string;
  balance: number;
  dueDate: Date;
  upiId: string;
  ownerName: string;
  overdue: boolean;
}): string {
  if (args.tone === "POLITE") {
    return `Namaste ${args.customerName} ji, yaad dilana tha ki ${args.shopName} ka ${formatRupees(args.balance)} baaki hai (bill ${args.billNumber}). Jab bhi suvidha ho, bhej dijiye. UPI: ${args.upiId}. Dhanyavaad.`;
  }

  const overdueNote = args.overdue ? ", ye due date nikal chuki hai" : "";
  return `Namaste ${args.customerName} ji, ${args.billNumber} ka ${formatRupees(args.balance)} baaki hai${overdueNote}. Kripya aaj hi bhej dijiye. UPI: ${args.upiId}. - ${args.ownerName}, ${args.shopName}`;
}
export function buildWhatsAppLink(
  number10: string,
  message: string,
): string {
  return `https://wa.me/91${number10}?text=${encodeURIComponent(message)}`;
}
