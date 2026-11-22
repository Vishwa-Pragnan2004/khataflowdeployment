"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerSchema } from "@/lib/validation";
import { nextBillNumber } from "@/lib/billNumber";
import { formatShortDate, parseInputDate, startOfDay } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { recentReminderWarning } from "@/lib/reminders";
import { TERMS_CHOICES, computeTermsDueDate, termsDaysFromDue } from "@/lib/terms";
import {
  allowedActions,
  deriveInvoiceStatus,
  statusAfterSend,
  type StoredInvoiceStatus,
} from "@/lib/invoiceStatus";
import {
  generateReminder,
  getReminderStage,
  type FollowInvoice,
  type FollowTone,
} from "@/lib/followups";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_ERROR = "Could not save changes (Save nahi ho paya, dobara try kijiye)";

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function fail<T = undefined>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input (Galat jaankari)";
}

function storedOf(status: string): StoredInvoiceStatus {
  if (status === "DRAFT" || status === "CANCELLED") return status;
  return "SENT";
}

function refresh(billId?: number): void {
  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath("/followups");
  if (billId !== undefined) {
    revalidatePath(`/bill/${billId}`);
    revalidatePath(`/invoices/${billId}`);
  }
}

const idSchema = z.number().int().positive();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date (Date chuniye)");
const methodSchema = z.enum(["CASH", "UPI", "BANK", "OTHER"]);
const toneSchema = z.enum(["POLITE", "DUE_TODAY", "FIRM", "FINAL"]);
const channelSchema = z.enum(["WHATSAPP", "EMAIL", "COPY"]);
const languageSchema = z.enum(["EN", "HI"]);

const itemSchema = z.object({
  description: z.string().trim().min(1, "Item name is required (Saman ka naam likhiye)").max(120),
  qty: z.number().int().positive("Qty must be at least 1 (Qty 1 ya zyada likhiye)").max(10000),
  unitPrice: z.number().int().min(0, "Price must be 0 or more (Price 0 ya zyada likhiye)"),
});

const invoiceBase = z.object({
  customerId: idSchema,
  mode: z.enum(["TOTAL", "ITEMS"]),
  totalOnly: z.number().int().positive("Enter an amount (Amount likhiye)").optional(),
  items: z.array(itemSchema).default([]),
  discount: z.number().int().min(0, "Discount cannot be negative").default(0),
  terms: z.enum(TERMS_CHOICES).default("D15"),
  customDueDate: dateString.optional(),
  issueDate: dateString.optional(),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(["DRAFT", "SENT"]).default("DRAFT"),
});

type InvoiceFields = z.infer<typeof invoiceBase>;

function checkInvoiceFields(v: InvoiceFields, ctx: z.RefinementCtx): void {
  if (v.mode === "TOTAL" && v.totalOnly === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter an amount (Amount likhiye)",
      path: ["totalOnly"],
    });
  }
  if (v.mode === "ITEMS" && v.items.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add at least one item (Kam se kam ek saman likhiye)",
      path: ["items"],
    });
  }
  if (v.terms === "CUSTOM" && !v.customDueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a due date (Due date chuniye)",
      path: ["customDueDate"],
    });
  }
}

const createInvoiceSchema = invoiceBase.superRefine(checkInvoiceFields);
const updateInvoiceSchema = invoiceBase.extend({ id: idSchema }).superRefine(checkInvoiceFields);

type LineItem = { description: string; qty: number; unitPrice: number; amount: number };

function buildLines(v: InvoiceFields): { items: LineItem[]; subtotal: number } {
  if (v.mode === "TOTAL") return { items: [], subtotal: v.totalOnly ?? 0 };
  const items = v.items.map((it) => ({
    description: it.description,
    qty: it.qty,
    unitPrice: it.unitPrice,
    amount: Math.round(it.qty * it.unitPrice),
  }));
  return { items, subtotal: items.reduce((sum, it) => sum + it.amount, 0) };
}

function computeTotals(
  v: InvoiceFields,
): ActionResult<{ items: LineItem[]; subtotal: number; total: number }> {
  const { items, subtotal } = buildLines(v);
  if (v.discount > subtotal) {
    return fail("Discount cannot exceed subtotal (Discount total se zyada nahi ho sakta)");
  }
  const total = subtotal - v.discount;
  if (total <= 0) {
    return fail("Total must be greater than 0 (Total 0 se zyada hona chahiye)");
  }
  return ok({ items, subtotal, total });
}

type LoadedBill = {
  status: string;
  totalAmount: number;
  dueDate: Date;
  payments: { amount: number }[];
};

function derive(bill: LoadedBill, now: Date) {
  return deriveInvoiceStatus(
    {
      status: storedOf(bill.status),
      totalAmount: bill.totalAmount,
      dueDate: bill.dueDate,
      payments: bill.payments,
    },
    now,
  );
}

async function loadBill(id: number) {
  return prisma.bill.findUnique({
    where: { id },
    include: { payments: { select: { amount: true } } },
  });
}

export async function createInvoice(
  input: unknown,
): Promise<ActionResult<{ id: number; billNumber: string; shareToken: string }>> {
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true },
    });
    if (!customer) return fail("Customer not found (Customer nahi mila)");

    const totals = computeTotals(data);
    if (!totals.ok) return fail(totals.error);
    const { items, subtotal, total } = totals.data;

    const issueDate = data.issueDate ? parseInputDate(data.issueDate) : startOfDay(new Date());
    const dueDate = computeTermsDueDate(
      data.terms,
      issueDate,
      data.customDueDate ? parseInputDate(data.customDueDate) : undefined,
    );
    const sent = data.status === "SENT";
    const shareToken = randomBytes(12).toString("base64url");

    const activities: { type: string; detail: string }[] = [
      { type: "CREATED", detail: "Invoice created" },
    ];
    if (sent) activities.push({ type: "SENT", detail: "Marked as sent" });

    const bill = await prisma.$transaction(async (tx) => {
      const last = await tx.bill.findFirst({
        orderBy: { id: "desc" },
        select: { billNumber: true },
      });
      return tx.bill.create({
        data: {
          billNumber: nextBillNumber(last?.billNumber ?? null),
          customerId: data.customerId,
          totalAmount: total,
          subtotal,
          discount: data.discount,
          billDate: issueDate,
          dueDate,
          termsDays: termsDaysFromDue(issueDate, dueDate),
          status: sent ? "SENT" : "DRAFT",
          sentAt: sent ? issueDate : null,
          notes: data.notes ? data.notes : null,
          shareToken,
          items: { create: items },
          activities: { create: activities },
        },
        select: { id: true, billNumber: true },
      });
    });

    refresh(bill.id);
    return ok({ id: bill.id, billNumber: bill.billNumber, shareToken });
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function updateInvoice(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = updateInvoiceSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;
  try {
    const bill = await loadBill(data.id);
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");

    const now = new Date();
    const derived = derive(bill, now);
    if (!allowedActions(derived.display, derived.paidAmount).canEdit) {
      return fail("This invoice is locked and cannot be edited.");
    }

    const totals = computeTotals(data);
    if (!totals.ok) return fail(totals.error);
    const { items, subtotal, total } = totals.data;
    if (total < derived.paidAmount) {
      return fail("New total cannot be less than the amount already paid");
    }

    const issueDate = data.issueDate ? parseInputDate(data.issueDate) : bill.billDate;
    const dueDate = computeTermsDueDate(
      data.terms,
      issueDate,
      data.customDueDate ? parseInputDate(data.customDueDate) : undefined,
    );
    const resend = storedOf(bill.status) === "SENT";

    await prisma.$transaction(async (tx) => {
      await tx.billItem.deleteMany({ where: { billId: bill.id } });
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          subtotal,
          discount: data.discount,
          totalAmount: total,
          billDate: issueDate,
          dueDate,
          termsDays: termsDaysFromDue(issueDate, dueDate),
          notes: data.notes ? data.notes : null,
          items: { create: items },
        },
      });
      if (resend) {
        await tx.activityLog.create({
          data: { billId: bill.id, type: "SENT", detail: "Edited and resent" },
        });
      }
    });

    refresh(bill.id);
    return ok({ id: bill.id });
  } catch {
    return fail(SAVE_ERROR);
  }
}

const billDetailsSchema = customerSchema
  .pick({ name: true, whatsappNumber: true })
  .extend({
    billId: idSchema,
    totalAmount: z.number().int().positive("Amount likhiye"),
    dueDate: dateString,
    notes: z.string().trim().max(500).optional(),
  });

export async function updateBillDetails(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = billDetailsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;
  try {
    const bill = await loadBill(data.billId);
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");

    const derived = derive(bill, new Date());
    if (!allowedActions(derived.display, derived.paidAmount).canEdit) {
      return fail("This invoice is locked and cannot be edited.");
    }
    if (data.totalAmount < derived.paidAmount) {
      return fail("New total cannot be less than the amount already paid");
    }

    const dueDate = parseInputDate(data.dueDate);
    await prisma.$transaction([
      prisma.customer.update({
        where: { id: bill.customerId },
        data: { name: data.name, whatsappNumber: data.whatsappNumber },
      }),
      prisma.bill.update({
        where: { id: bill.id },
        data: {
          totalAmount: data.totalAmount,
          subtotal: data.totalAmount + bill.discount,
          dueDate,
          termsDays: termsDaysFromDue(bill.billDate, dueDate),
          notes: data.notes ? data.notes : null,
        },
      }),
    ]);

    refresh(bill.id);
    return ok({ id: bill.id });
  } catch {
    return fail(SAVE_ERROR);
  }
}


export async function markSent(
  input: unknown,
): Promise<ActionResult<{ id: number; status: string }>> {
  const parsed = z
    .object({ id: idSchema, channel: z.enum(["WHATSAPP", "EMAIL", "COPY", "PRINT", "MARK"]) })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, channel } = parsed.data;
  try {
    const bill = await prisma.bill.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");
    const stored = storedOf(bill.status);
    if (stored === "CANCELLED") return fail("This invoice is cancelled");

    if (stored === "DRAFT") {
      const next = statusAfterSend(stored);
      await prisma.$transaction([
        prisma.bill.update({ where: { id }, data: { status: next, sentAt: new Date() } }),
        prisma.activityLog.create({
          data: { billId: id, type: "SENT", detail: `Marked as sent via ${channel}` },
        }),
      ]);
      refresh(id);
      return ok({ id, status: next });
    }

    if (channel !== "MARK") {
      await prisma.activityLog.create({
        data: { billId: id, type: "SENT", detail: `Shared again via ${channel}` },
      });
      refresh(id);
    }
    return ok({ id, status: stored });
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function recordInvoicePayment(
  input: unknown,
): Promise<ActionResult<{ id: number; paidAmount: number; balance: number; display: string }>> {
  const parsed = z
    .object({
      billId: idSchema,
      amount: z.number().int().positive("Enter an amount greater than 0"),
      method: methodSchema,
      paidOn: dateString.optional(),
      reference: z.string().trim().max(60).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;
  try {
    const bill = await loadBill(data.billId);
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");

    const stored = storedOf(bill.status);
    if (stored === "DRAFT") return fail("Send the invoice first, then record payments.");
    if (stored === "CANCELLED") return fail("This invoice is cancelled.");

    const now = new Date();
    if (derive(bill, now).balance <= 0) return fail("This invoice is already paid");

    const paidOn = data.paidOn ? parseInputDate(data.paidOn) : startOfDay(now);
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          billId: data.billId,
          amount: data.amount,
          method: data.method,
          paidOn,
          reference: data.reference ? data.reference : null,
        },
      }),
      prisma.activityLog.create({
        data: {
          billId: data.billId,
          type: "PAYMENT",
          detail: `Got ${formatRupees(data.amount)} via ${data.method}`,
        },
      }),
    ]);

    const after = deriveInvoiceStatus(
      {
        status: stored,
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        payments: [...bill.payments, { amount: data.amount }],
      },
      now,
    );
    refresh(data.billId);
    return ok({
      id: data.billId,
      paidAmount: after.paidAmount,
      balance: Math.max(0, after.balance),
      display: after.display,
    });
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function markFullyPaid(
  input: unknown,
): Promise<ActionResult<{ id: number }>> {
  const parsed = z
    .object({ billId: idSchema, method: methodSchema, paidOn: dateString.optional() })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  try {
    const bill = await loadBill(parsed.data.billId);
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");
    const balance = derive(bill, new Date()).balance;
    if (balance <= 0) return fail("Already paid");

    const result = await recordInvoicePayment({
      billId: parsed.data.billId,
      amount: balance,
      method: parsed.data.method,
      paidOn: parsed.data.paidOn,
    });
    if (!result.ok) return fail(result.error);
    return ok({ id: parsed.data.billId });
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function setPromise(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = z.object({ billId: idSchema, promisedDate: dateString }).safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { billId, promisedDate } = parsed.data;
  try {
    const bill = await loadBill(billId);
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");
    const display = derive(bill, new Date()).display;
    if (display !== "SENT" && display !== "OVERDUE" && display !== "PARTIALLY_PAID") {
      return fail("A promise can only be set on an unpaid sent invoice.");
    }

    const date = parseInputDate(promisedDate);
    await prisma.$transaction([
      prisma.bill.update({ where: { id: billId }, data: { promisedDate: date } }),
      prisma.activityLog.create({
        data: {
          billId,
          type: "PROMISE",
          detail: `Promised to pay on ${formatShortDate(date)}`,
        },
      }),
    ]);
    refresh(billId);
    return ok({ id: billId });
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function cancelInvoice(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = z.object({ billId: idSchema }).safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { billId } = parsed.data;
  try {
    const bill = await loadBill(billId);
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");
    const derived = derive(bill, new Date());
    const actions = allowedActions(derived.display, derived.paidAmount);
    if (!actions.canCancel) {
      return fail(actions.cancelBlockedReason ?? "This invoice cannot be cancelled");
    }
    await prisma.$transaction([
      prisma.bill.update({ where: { id: billId }, data: { status: "CANCELLED" } }),
      prisma.activityLog.create({
        data: { billId, type: "CANCELLED", detail: "Invoice cancelled" },
      }),
    ]);
    refresh(billId);
    return ok({ id: billId });
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function deleteDraft(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = z.object({ billId: idSchema }).safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: parsed.data.billId },
      select: { status: true },
    });
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");
    if (storedOf(bill.status) !== "DRAFT") return fail("Only drafts can be deleted");
    await prisma.bill.delete({ where: { id: parsed.data.billId } });
    refresh();
    return ok(undefined);
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function logInvoiceReminder(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = z
    .object({
      billId: idSchema,
      tone: toneSchema,
      channel: channelSchema,
      message: z.string().trim().min(1).max(2000),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { billId, tone, channel, message } = parsed.data;
  try {
    const existingBill = await prisma.bill.findUnique({
      where: { id: billId },
      select: { id: true },
    });
    if (!existingBill) return fail("Invoice not found (Invoice nahi mila)");

    const now = new Date();
    await prisma.$transaction([
      prisma.reminderLog.create({ data: { billId, tone, channel, message, sentAt: now } }),
      prisma.activityLog.create({
        data: { billId, type: "REMINDER", detail: `${tone} reminder via ${channel}` },
      }),
    ]);
    refresh(billId);
    return ok(undefined);
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function getFollowupDraft(input: unknown): Promise<
  ActionResult<{
    tone: FollowTone;
    reason: string;
    promiseBroken: boolean;
    subject: string | null;
    body: string;
    needsEmail: boolean;
    lastRemindedAt: string | null;
    reminderWarning: string | null;
    whatsappNumber: string;
    customerEmail: string | null;
  }>
> {
  const parsed = z
    .object({
      billId: idSchema,
      tone: toneSchema.optional(),
      language: languageSchema.default("EN"),
      channel: channelSchema.default("WHATSAPP"),
    })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: data.billId },
      include: {
        customer: true,
        payments: { select: { amount: true } },
        reminders: { orderBy: { sentAt: "desc" }, take: 1 },
      },
    });
    if (!bill) return fail("Invoice not found (Invoice nahi mila)");
    const shop = await prisma.shop.findUnique({ where: { id: 1 } });
    if (!shop) return fail("Shop details not found (Dukaan ki jaankari nahi mili)");

    const now = new Date();
    const invoice: FollowInvoice = {
      status: storedOf(bill.status),
      totalAmount: bill.totalAmount,
      dueDate: bill.dueDate,
      promisedDate: bill.promisedDate,
      payments: bill.payments,
    };
    const recommendation = getReminderStage(invoice, now);
    const chosenTone: FollowTone = data.tone ?? recommendation.tone ?? "POLITE";
    const shareUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") +
      "/i/" +
      (bill.shareToken ?? "");

    const draft = generateReminder({
      invoice: {
        invoiceNumber: bill.billNumber,
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        payments: bill.payments,
        promisedDate: bill.promisedDate,
      },
      customer: { name: bill.customer.name, email: bill.customer.email },
      shop: { name: shop.name, upiId: shop.upiId, ownerName: shop.ownerName },
      tone: chosenTone,
      language: data.language,
      channel: data.channel,
      today: now,
      shareUrl,
    });

    const latest = bill.reminders[0]?.sentAt ?? null;
    return ok({
      tone: chosenTone,
      reason: recommendation.reason,
      promiseBroken: recommendation.promiseBroken,
      subject: draft.subject,
      body: draft.body,
      needsEmail: draft.needsEmail,
      lastRemindedAt: latest ? latest.toISOString() : null,
      reminderWarning: recentReminderWarning(latest, now),
      whatsappNumber: bill.customer.whatsappNumber,
      customerEmail: bill.customer.email,
    });
  } catch {
    return fail("Could not load follow-up draft");
  }
}

export async function createCustomerQuick(
  input: unknown,
): Promise<ActionResult<{ id: number; name: string; whatsappNumber: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  try {
    const customer = await prisma.customer.create({
      data: { name: parsed.data.name, whatsappNumber: parsed.data.whatsappNumber },
      select: { id: true, name: true, whatsappNumber: true },
    });
    refresh();
    return ok(customer);
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function getRepeatSource(customerId: number): Promise<
  ActionResult<{
    mode: "TOTAL" | "ITEMS";
    items: { description: string; qty: number; unitPrice: number }[];
    totalOnly: number | null;
  }>
> {
  const parsed = idSchema.safeParse(customerId);
  if (!parsed.success) return fail("Select a customer (Customer chuniye)");
  try {
    const bill = await prisma.bill.findFirst({
      where: { customerId, status: { not: "CANCELLED" } },
      orderBy: { id: "desc" },
      include: { items: { orderBy: { id: "asc" } } },
    });
    if (!bill) return ok({ mode: "TOTAL" as const, items: [], totalOnly: null });
    if (bill.items.length > 0) {
      return ok({
        mode: "ITEMS" as const,
        items: bill.items.map((it) => ({
          description: it.description,
          qty: it.qty,
          unitPrice: it.unitPrice,
        })),
        totalOnly: null,
      });
    }
    return ok({ mode: "TOTAL" as const, items: [], totalOnly: bill.totalAmount });
  } catch {
    return fail("Could not load previous bill (Pichla bill nahi mil paya)");
  }
}

export async function getItemSuggestions(): Promise<
  ActionResult<{ description: string; unitPrice: number }[]>
> {
  try {
    const rows = await prisma.billItem.findMany({
      orderBy: { id: "desc" },
      select: { description: true, unitPrice: true },
      take: 500,
    });
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (!seen.has(row.description)) seen.set(row.description, row.unitPrice);
      if (seen.size >= 30) break;
    }
    return ok(
      Array.from(seen.entries()).map(([description, unitPrice]) => ({ description, unitPrice })),
    );
  } catch {
    return fail("Could not load item suggestions");
  }
}