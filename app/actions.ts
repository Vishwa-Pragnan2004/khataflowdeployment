"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { customerSchema } from "@/lib/validation";
import { formatBillNumber } from "@/lib/billNumber";
import {
  addDays,
  formatShortDate,
  parseInputDate,
  startOfDay,
  toInputDate,
} from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import {
  generateReminder,
  recentReminderWarning,
  type ReminderLanguage,
} from "@/lib/reminders";



type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function fail<T = undefined>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function refresh(billId?: number): void {
  revalidatePath("/");
  revalidatePath("/bill/new");
  if (billId !== undefined) {
    revalidatePath(`/bill/${billId}`);
  }
}

export async function listCustomers() {
  return prisma.customer.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
      email: true,
      createdAt: true,
    },
  });
}

export async function createCustomer(input: {
  name: string;
  whatsappNumber: string;
}): Promise<ActionResult<{ id: number; name: string; whatsappNumber: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid customer details");
  }
  try {
    const created = await prisma.customer.create({
      data: {
        name: parsed.data.name,
        whatsappNumber: parsed.data.whatsappNumber,
      },
      select: { id: true, name: true, whatsappNumber: true },
    });
    refresh();
    return ok(created);
  } catch {
    return fail("Could not save customer (Customer save nahi ho paya)");
  }
}

export async function createBill(input: {
  customerId: number;
  totalAmount: number;
  itemsNote?: string | null;
  dueDate?: string | Date;
  billDate?: string;
  dueOption?: "7D" | "15D" | "EOM" | "CUSTOM";
  paidNow?: number;
  paidMethod?: "CASH" | "UPI" | "OTHER";
  paymentMethod?: "CASH" | "UPI" | "BANK" | "OTHER";
}): Promise<
  ActionResult<{
    id: number;
    billNumber: string;
    shopName: string;
    customerName: string;
    totalAmount: number;
    paidNow: number;
    dueDate: string;
    ownerName: string;
    customerWhatsapp: string;
    whatsappUrl: string;
    message: string;
  }>
> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      return fail("Customer not found (Customer nahi mila)");
    }
    if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
      return fail("Enter a valid amount (Sahi amount likhiye)");
    }

    const today = startOfDay(new Date());
    let dueDate: Date;
    if (input.dueDate instanceof Date) {
      dueDate = startOfDay(input.dueDate);
    } else if (typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      dueDate = parseInputDate(input.dueDate);
    } else if (input.dueOption === "7D") {
      dueDate = addDays(today, 7);
    } else if (input.dueOption === "EOM") {
      dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (input.dueOption === "CUSTOM" && typeof input.dueDate === "string") {
      dueDate = parseInputDate(input.dueDate);
    } else {
      dueDate = addDays(today, 15);
    }

    let billCreatedAt: Date | undefined;
    if (input.billDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.billDate)) {
        return fail("Invalid bill date (Bill ki tarikh galat hai)");
      }
      const billDay = startOfDay(parseInputDate(input.billDate));
      if (billDay > today) {
        return fail(
          "Bill date cannot be in the future (Bill ki tarikh aaj ya pehle ki honi chahiye)",
        );
      }
      billCreatedAt = new Date(billDay.getFullYear(), billDay.getMonth(), billDay.getDate(), 12, 0, 0);
    }

    const totalAmount = Math.round(input.totalAmount);
    const paidNow = Math.max(0, Math.round(input.paidNow ?? 0));
    const balance = Math.max(0, totalAmount - paidNow);
    const method = input.paidMethod ?? input.paymentMethod ?? "CASH";

    const bill = await prisma.$transaction(async (tx) => {
      const count = await tx.bill.count();
      const billNumber = formatBillNumber(count + 1);
      return tx.bill.create({
        data: {
          billNumber,
          customerId: customer.id,
          subtotal: totalAmount,
          discount: 0,
          totalAmount,
          itemsNote: input.itemsNote?.trim() ? input.itemsNote.trim() : null,
          notes: input.itemsNote?.trim() ? input.itemsNote.trim() : null,
          billDate: today,
          createdAt: billCreatedAt,
          dueDate,
          status: "SENT",
          sentAt: today,
          payments:
            paidNow > 0
              ? {
                  create: {
                    amount: paidNow,
                    method,
                    paidOn: today,
                  },
                }
              : undefined,
          activities: {
            create: [
              { type: "CREATED", detail: `Bill ${billNumber} created` },
              ...(paidNow > 0
                ? [
                    {
                      type: "PAYMENT",
                      detail: `Received ${formatRupees(paidNow)} upfront`,
                    },
                  ]
                : []),
            ],
          },
        },
      });
    });

    const shop = await prisma.shop.findUnique({ where: { id: 1 } });
    const shopName = shop?.name ?? "Our Shop";
    const ownerName = shop?.ownerName ?? shopName;

    const lines = [
      `Namaste ${customer.name},`,
      `Your credit bill (${bill.billNumber}) from ${shopName} is ${formatRupees(totalAmount)}.`,
      ...(paidNow > 0 ? [`Paid Now (Abhi Mile): ${formatRupees(paidNow)}`] : []),
      `Balance (Bacha Hua): ${formatRupees(balance)}`,
      `Due Date (Kab Tak Dena Hai): ${formatShortDate(dueDate)}`,
      ...(bill.itemsNote ? [`Items (Saman): ${bill.itemsNote}`] : []),
      `Thank you!`,
    ];
    const message = lines.join("\n");
    const phone = customer.whatsappNumber.replace(/\D/g, "");
    const normalizedPhone = phone.length === 10 ? `91${phone}` : phone;
    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

    refresh(bill.id);
    return ok({
      id: bill.id,
      billNumber: bill.billNumber,
      shopName,
      customerName: customer.name,
      totalAmount,
      paidNow,
      dueDate: toInputDate(dueDate),
      ownerName,
      customerWhatsapp: customer.whatsappNumber,
      whatsappUrl,
      message,
    });
  } catch {
    return fail("Could not save bill (Bill save nahi ho paya)");
  }
}

export async function recordPayment(input: {
  billId: number;
  amount: number;
  method: "CASH" | "UPI" | "BANK" | "OTHER";
  paidOn?: string;
  reference?: string;
}): Promise<ActionResult<{ id: number; paidAmount: number; balance: number }>> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return fail("Enter an amount greater than 0 (0 se zyada amount likhiye)");
  }

  try {
    const bill = await prisma.bill.findUnique({
      where: { id: input.billId },
      include: { payments: { select: { amount: true } } },
    });
    if (!bill) {
      return fail("Bill not found (Bill nahi mila)");
    }

    const amount = Math.round(input.amount);
    const paidOn = input.paidOn ? parseInputDate(input.paidOn) : startOfDay(new Date());

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          billId: bill.id,
          amount,
          method: input.method,
          paidOn,
          reference: input.reference?.trim() ? input.reference.trim() : null,
        },
      }),
      prisma.activityLog.create({
        data: {
          billId: bill.id,
          type: "PAYMENT",
          detail: `Got ${formatRupees(amount)} via ${input.method}`,
        },
      }),
    ]);

    const existingPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = existingPaid + amount;
    const balance = Math.max(0, bill.totalAmount - paidAmount);

    refresh(bill.id);
    return ok({ id: bill.id, paidAmount, balance });
  } catch {
    return fail("Could not record payment (Payment save nahi ho paya)");
  }
}

export async function prepareReminder(input: {
  billId: number;
  tone?: "POLITE" | "FIRM";
  language?: ReminderLanguage;
}): Promise<
  ActionResult<{
    tone: "POLITE" | "FIRM";
    message: string;
    waLink: string;
    balance: number;
    whatsappNumber: string;
  }>
> {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: input.billId },
      include: {
        customer: true,
        payments: { select: { amount: true } },
      },
    });
    if (!bill) {
      return fail("Bill not found (Bill nahi mila)");
    }

    const shop = await prisma.shop.findUnique({ where: { id: 1 } });
    const shopName = shop?.name ?? "Our Shop";

    const paid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, bill.totalAmount - paid);
    const today = new Date();
    const isOverdue = startOfDay(today) > startOfDay(bill.dueDate);
    const tone: "POLITE" | "FIRM" = input.tone ?? (isOverdue ? "FIRM" : "POLITE");
    const language: ReminderLanguage = input.language ?? "EN";

    const message = generateReminder({
      bill: {
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        itemsNote: bill.itemsNote,
        payments: bill.payments,
      },
      customer: { name: bill.customer.name },
      shop: { name: shopName, upiId: shop?.upiId ?? "" },
      tone,
      today,
      language,
    });

    const phone = bill.customer.whatsappNumber.replace(/\D/g, "");
    const normalizedPhone = phone.length === 10 ? `91${phone}` : phone;
    const waLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

    return ok({
      tone,
      message,
      waLink,
      balance,
      whatsappNumber: bill.customer.whatsappNumber,
    });
  } catch {
    return fail("Could not prepare reminder (Reminder nahi ban paya)");
  }
}

export async function getReminderWarning(
  billId: number,
): Promise<ActionResult<{ warning: string | null; whatsappNumber: string }>> {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      select: {
        customer: { select: { whatsappNumber: true } },
      },
    });
    if (!bill) {
      return fail("Bill not found (Bill nahi mila)");
    }

    const latest = await prisma.reminderLog.findFirst({
      where: { billId },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });

    return ok({
      warning: recentReminderWarning(latest?.sentAt ?? null, new Date()),
      whatsappNumber: bill.customer.whatsappNumber,
    });
  } catch {
    return fail("Could not check reminder (Reminder check nahi ho paya)");
  }
}

export async function logReminder(input: {
  billId: number;
  tone: string;
  channel?: string;
  message: string;
}): Promise<ActionResult<undefined>> {
  try {
    const channel = input.channel ?? "WHATSAPP";
    await prisma.$transaction([
      prisma.reminderLog.create({
        data: {
          billId: input.billId,
          tone: input.tone,
          channel,
          message: input.message,
          sentAt: new Date(),
        },
      }),
      prisma.activityLog.create({
        data: {
          billId: input.billId,
          type: "REMINDER",
          detail: `${input.tone} reminder via ${channel}`,
        },
      }),
    ]);
    refresh(input.billId);
    return ok(undefined);
  } catch {
    return fail("Could not log reminder (Reminder log nahi ho paya)");
  }
}


