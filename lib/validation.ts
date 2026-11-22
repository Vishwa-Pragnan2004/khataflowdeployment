import { z } from "zod";

export const PAYMENT_METHODS = ["CASH", "UPI", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Naam likhiye").max(60),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "10 digit number likhiye (6-9 se shuru)"),
});

export const billSchema = z
  .object({
    customerId: z.number().int().positive(),
    totalAmount: z.number().int().positive("Amount likhiye"),
    itemsNote: z.string().trim().max(500).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bill date chuniye").optional(),
    paidNow: z.number().int().min(0).default(0),
    paidMethod: z.enum(PAYMENT_METHODS).default("CASH"),
  })
  .refine((v) => v.paidNow <= v.totalAmount, {
    message: "Abhi mile amount total se zyada nahi ho sakta",
    path: ["paidNow"],
  });

export const paymentSchema = z.object({
  billId: z.number().int().positive(),
  amount: z.number().int().positive("Amount likhiye"),
  method: z.enum(PAYMENT_METHODS),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date chuniye").optional(),
});

export const reminderSchema = z.object({
  billId: z.number().int().positive(),
  tone: z.enum(["POLITE", "FIRM"]),
  language: z.enum(["EN", "HI"]).optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type BillInput = z.infer<typeof billSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ReminderInput = z.infer<typeof reminderSchema>;
