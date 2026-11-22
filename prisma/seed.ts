import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "../lib/dates";
import { formatBillNumber } from "../lib/billNumber";
import { termsDaysFromDue } from "../lib/terms";
import { formatRupees } from "../lib/money";

const prisma = new PrismaClient();

type PaymentMethod = "CASH" | "UPI" | "BANK" | "OTHER";
type StoredStatus = "DRAFT" | "SENT" | "CANCELLED";

type CustomerSeed = {
  name: string;
  whatsappNumber: string;
  email: string | null;
};

type ItemSeed = {
  description: string;
  qty: number;
  unitPrice: number;
};

type BillSeed = {
  customer: number;
  status: StoredStatus;
  dueOffset: number;
  promisedOffset?: number;
  discount?: number;
  totalOnly?: number;
  items?: ItemSeed[];
  notes?: string | null;
  payments: [number, PaymentMethod][];
  hasReminder?: boolean;
};

const customers: CustomerSeed[] = [
  { name: "Sunita Devi", whatsappNumber: "9876501001", email: "sunita.devi@example.com" },
  { name: "Rakesh Yadav", whatsappNumber: "9812302002", email: null },
  { name: "Priya Sharma", whatsappNumber: "9898703003", email: "priya.sharma@example.com" },
  { name: "Mohammed Irfan", whatsappNumber: "9123404004", email: "irfan.traders@example.com" },
  { name: "Anjali Verma", whatsappNumber: "9406505005", email: null },
  { name: "Suresh Patel", whatsappNumber: "9722206006", email: "suresh.patel@example.com" },
  { name: "Kavita Singh", whatsappNumber: "9633307007", email: null },
  { name: "Vijay Kumar", whatsappNumber: "9555508008", email: "vijay.kumar@example.com" },
  { name: "Neha Gupta", whatsappNumber: "9044409009", email: null },
  { name: "Arun Mishra", whatsappNumber: "8800010010", email: "arun.mishra@example.com" },
];

const bills: BillSeed[] = [
  {
    customer: 0,
    status: "SENT",
    dueOffset: 10,
    items: [
      { description: "Atta 5 kg", qty: 1, unitPrice: 250 },
      { description: "Toor Dal 1 kg", qty: 5, unitPrice: 190 },
    ],
    notes: "Monthly ration pack",
    payments: [],
  },
  {
    customer: 1,
    status: "SENT",
    dueOffset: 10,
    totalOnly: 450,
    payments: [],
  },
  {
    customer: 2,
    status: "SENT",
    dueOffset: 3,
    promisedOffset: 4,
    items: [{ description: "Cement 50kg Bag", qty: 20, unitPrice: 400 }],
    notes: "Site delivery",
    payments: [],
    hasReminder: true,
  },
  {
    customer: 3,
    status: "SENT",
    dueOffset: 3,
    items: [
      { description: "Chai Patti 500g", qty: 2, unitPrice: 225 },
      { description: "Biscuit Carton", qty: 1, unitPrice: 200 },
    ],
    payments: [],
  },
  {
    customer: 4,
    status: "SENT",
    dueOffset: -3,
    items: [{ description: "Basmati Rice 25 kg", qty: 1, unitPrice: 2300 }],
    payments: [],
    hasReminder: true,
  },
  {
    customer: 5,
    status: "SENT",
    dueOffset: -3,
    totalOnly: 750,
    payments: [],
  },
  {
    customer: 6,
    status: "SENT",
    dueOffset: -12,
    promisedOffset: -2,
    items: [
      { description: "Mustard Oil 5 L", qty: 2, unitPrice: 850 },
      { description: "Sugar 5 kg", qty: 4, unitPrice: 425 },
    ],
    payments: [],
    hasReminder: true,
  },
  {
    customer: 7,
    status: "SENT",
    dueOffset: -12,
    totalOnly: 980,
    payments: [],
  },
  {
    customer: 8,
    status: "SENT",
    dueOffset: -35,
    items: [{ description: "Wholesale Kirana Box", qty: 10, unitPrice: 1250 }],
    discount: 500,
    notes: "Bulk credit order",
    payments: [],
    hasReminder: true,
  },
  {
    customer: 9,
    status: "SENT",
    dueOffset: -40,
    totalOnly: 300,
    payments: [],
  },
  {
    customer: 0,
    status: "SENT",
    dueOffset: 7,
    totalOnly: 5500,
    notes: "Monthly groceries",
    payments: [[2000, "CASH"]],
  },
  {
    customer: 2,
    status: "SENT",
    dueOffset: 7,
    totalOnly: 5500,
    notes: "Monthly groceries",
    payments: [[2000, "UPI"]],
  },
  {
    customer: 3,
    status: "SENT",
    dueOffset: -5,
    items: [
      { description: "Desi Ghee 1 kg", qty: 4, unitPrice: 700 },
      { description: "Fresh Paneer 1 kg", qty: 4, unitPrice: 350 },
    ],
    payments: [[1000, "UPI"]],
    hasReminder: true,
  },
  {
    customer: 4,
    status: "SENT",
    dueOffset: -20,
    totalOnly: 6000,
    notes: "Festival masala set",
    payments: [
      [2500, "CASH"],
      [500, "BANK"],
    ],
    hasReminder: true,
  },
  {
    customer: 5,
    status: "SENT",
    dueOffset: 14,
    totalOnly: 1800,
    payments: [[1800, "UPI"]],
  },
  {
    customer: 6,
    status: "SENT",
    dueOffset: -2,
    totalOnly: 900,
    payments: [[900, "CASH"]],
  },
  {
    customer: 7,
    status: "SENT",
    dueOffset: 20,
    totalOnly: 2750,
    payments: [[2750, "OTHER"]],
  },
  {
    customer: 8,
    status: "SENT",
    dueOffset: 0,
    totalOnly: 500,
    notes: "Due today",
    payments: [],
  },
  {
    customer: 1,
    status: "DRAFT",
    dueOffset: 15,
    items: [
      { description: "Gehu Atta 10 kg", qty: 5, unitPrice: 420 },
      { description: "Besan 2 kg", qty: 5, unitPrice: 200 },
    ],
    notes: "Draft invoice awaiting confirmation",
    payments: [],
  },
  {
    customer: 9,
    status: "CANCELLED",
    dueOffset: -8,
    totalOnly: 1500,
    notes: "Cancelled duplicate entry",
    payments: [],
  },
];

function validateSeed(): void {
  if (customers.length < 10) {
    throw new Error("validateSeed: expected at least 10 customers");
  }
  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    if (b.customer < 0 || b.customer >= customers.length) {
      throw new Error(`validateSeed: bill ${i + 1} has invalid customer index ${b.customer}`);
    }
    const itemsTotal = (b.items ?? []).reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
    const subtotal = b.items && b.items.length > 0 ? itemsTotal : (b.totalOnly ?? 0);
    const total = subtotal - (b.discount ?? 0);
    if (total <= 0) {
      throw new Error(`validateSeed: bill ${i + 1} has non-positive total (${total})`);
    }
  }
}

async function main(): Promise<void> {
  validateSeed();

  await prisma.shop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Sri Laxmi Stores",
      ownerName: "Ramesh",
      upiId: "shop@upi",
    },
  });

  if ((await prisma.expense.count()) === 0) {
    const expenseToday = startOfDay(new Date());
    const expenseSeeds: {
      title: string;
      category: string;
      amount: number;
      recurring: string | null;
      dueOffset: number;
    }[] = [
      { title: "Shop rent", category: "RENT", amount: 12000, recurring: "MONTHLY", dueOffset: 5 },
      { title: "Shop rent", category: "RENT", amount: 12000, recurring: "MONTHLY", dueOffset: 35 },
      { title: "Shop rent", category: "RENT", amount: 12000, recurring: "MONTHLY", dueOffset: 65 },
      {
        title: "Shop rent (last month)",
        category: "RENT",
        amount: 12000,
        recurring: "MONTHLY",
        dueOffset: -3,
      },
      { title: "Staff salary (Ravi)", category: "SALARY", amount: 9000, recurring: "MONTHLY", dueOffset: 10 },
      { title: "Staff salary (Meena)", category: "SALARY", amount: 9000, recurring: "MONTHLY", dueOffset: 10 },
      { title: "Staff salary (Ravi)", category: "SALARY", amount: 9000, recurring: "MONTHLY", dueOffset: 40 },
      { title: "Wholesale stock order", category: "SUPPLIER", amount: 8500, recurring: null, dueOffset: 18 },
      { title: "Packaging supplier", category: "SUPPLIER", amount: 3200, recurring: null, dueOffset: 50 },
      { title: "Electricity", category: "UTILITY", amount: 1800, recurring: null, dueOffset: 12 },
      { title: "Shop insurance", category: "OTHER", amount: 4000, recurring: null, dueOffset: 80 },
    ];
    for (const e of expenseSeeds) {
      await prisma.expense.create({
        data: {
          title: e.title,
          category: e.category,
          amount: e.amount,
          recurring: e.recurring,
          dueDate: addDays(expenseToday, e.dueOffset),
          paidOn: null,
        },
      });
    }
    console.log(`Seeded ${expenseSeeds.length} expenses.`);
  }

  if ((await prisma.product.count()) === 0) {
    const productSeeds: {
      name: string;
      nameHi: string | null;
      category: string;
      unit: "KG" | "L" | "PIECE";
      pricePerUnit: number;
    }[] = [
      { name: "Dal Toor", nameHi: "Arhar Dal", category: "Pulses", unit: "KG", pricePerUnit: 150 },
      { name: "Dal Moong", nameHi: "Moong Dal", category: "Pulses", unit: "KG", pricePerUnit: 130 },
      { name: "Dal Chana", nameHi: "Chana Dal", category: "Pulses", unit: "KG", pricePerUnit: 95 },
      { name: "Rajma", nameHi: "Rajma", category: "Pulses", unit: "KG", pricePerUnit: 160 },
      { name: "Kala Chana", nameHi: "Kala Chana", category: "Pulses", unit: "KG", pricePerUnit: 90 },
      { name: "Basmati Rice", nameHi: "Basmati Chawal", category: "Rice", unit: "KG", pricePerUnit: 110 },
      { name: "Sona Masoori Rice", nameHi: "Sona Masoori Chawal", category: "Rice", unit: "KG", pricePerUnit: 60 },
      { name: "Poha", nameHi: "Poha", category: "Rice", unit: "KG", pricePerUnit: 55 },
      { name: "Suji (Rava)", nameHi: "Suji", category: "Flour", unit: "KG", pricePerUnit: 50 },
      { name: "Wheat Flour (Atta)", nameHi: "Gehun ka Atta", category: "Flour", unit: "KG", pricePerUnit: 48 },
      { name: "Maida", nameHi: "Maida", category: "Flour", unit: "KG", pricePerUnit: 42 },
      { name: "Besan", nameHi: "Besan", category: "Flour", unit: "KG", pricePerUnit: 90 },
      { name: "Sugar", nameHi: "Cheeni", category: "Staples", unit: "KG", pricePerUnit: 44 },
      { name: "Salt", nameHi: "Namak", category: "Staples", unit: "KG", pricePerUnit: 25 },
      { name: "Tea Powder", nameHi: "Chai Patti", category: "Beverages", unit: "KG", pricePerUnit: 480 },
      { name: "Coffee Powder", nameHi: "Coffee", category: "Beverages", unit: "KG", pricePerUnit: 600 },
      { name: "Refined Oil", nameHi: "Refined Tel", category: "Oil", unit: "L", pricePerUnit: 160 },
      { name: "Mustard Oil", nameHi: "Sarson ka Tel", category: "Oil", unit: "L", pricePerUnit: 180 },
      { name: "Groundnut Oil", nameHi: "Moongfali Tel", category: "Oil", unit: "L", pricePerUnit: 190 },
      { name: "Ghee", nameHi: "Desi Ghee", category: "Dairy", unit: "KG", pricePerUnit: 640 },
      { name: "Milk", nameHi: "Doodh", category: "Dairy", unit: "L", pricePerUnit: 66 },
      { name: "Paneer", nameHi: "Paneer", category: "Dairy", unit: "KG", pricePerUnit: 400 },
      { name: "Turmeric Powder", nameHi: "Haldi", category: "Spices", unit: "KG", pricePerUnit: 180 },
      { name: "Red Chilli Powder", nameHi: "Lal Mirch", category: "Spices", unit: "KG", pricePerUnit: 220 },
      { name: "Cumin Seeds", nameHi: "Jeera", category: "Spices", unit: "KG", pricePerUnit: 650 },
      { name: "Garam Masala", nameHi: "Garam Masala", category: "Spices", unit: "KG", pricePerUnit: 700 },
      { name: "Mustard Seeds", nameHi: "Rai", category: "Spices", unit: "KG", pricePerUnit: 160 },
      { name: "Onion", nameHi: "Pyaz", category: "Vegetables", unit: "KG", pricePerUnit: 35 },
      { name: "Potato", nameHi: "Aloo", category: "Vegetables", unit: "KG", pricePerUnit: 30 },
      { name: "Tomato", nameHi: "Tamatar", category: "Vegetables", unit: "KG", pricePerUnit: 40 },
      { name: "Biscuits (Packet)", nameHi: "Biscuit", category: "Snacks", unit: "PIECE", pricePerUnit: 30 },
      { name: "Soap Bar", nameHi: "Sabun", category: "Household", unit: "PIECE", pricePerUnit: 40 },
      { name: "Detergent Powder", nameHi: "Detergent", category: "Household", unit: "KG", pricePerUnit: 120 },
    ];
    await prisma.product.createMany({ data: productSeeds });
    console.log(`Seeded ${productSeeds.length} products.`);
  }



  const existingBills = await prisma.bill.count();
  if (existingBills > 0) {
    console.log("Seed skipped: bills already exist. Run `npx prisma migrate reset` to reseed.");
    return;
  }

  const customerIds: number[] = [];
  for (const c of customers) {
    const created = await prisma.customer.create({
      data: {
        name: c.name,
        whatsappNumber: c.whatsappNumber,
        email: c.email,
      },
    });
    customerIds.push(created.id);
  }

  const today = startOfDay(new Date());
  let seededReminders = 0;

  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    const customerId = customerIds[b.customer];
    const lineItems = (b.items ?? []).map((it) => ({
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
      amount: Math.round(it.qty * it.unitPrice),
    }));

    const subtotal =
      lineItems.length > 0
        ? lineItems.reduce((sum, it) => sum + it.amount, 0)
        : (b.totalOnly ?? 0);
    const discount = b.discount ?? 0;
    const totalAmount = subtotal - discount;

    const dueDate = addDays(today, b.dueOffset);
    const billDate = addDays(today, Math.min(0, b.dueOffset - 15));
    const promisedDate =
      b.promisedOffset !== undefined ? addDays(today, b.promisedOffset) : null;
    const isSent = b.status === "SENT" || b.status === "CANCELLED";

    const activities: { type: string; detail: string }[] = [
      { type: "CREATED", detail: "Invoice created" },
    ];
    if (isSent) {
      activities.push({ type: "SENT", detail: "Marked as sent" });
    }
    if (b.status === "CANCELLED") {
      activities.push({ type: "CANCELLED", detail: "Invoice cancelled" });
    }
    for (const [amount, method] of b.payments) {
      activities.push({
        type: "PAYMENT",
        detail: `Got ${formatRupees(amount)} via ${method}`,
      });
    }

    const bill = await prisma.bill.create({
      data: {
        billNumber: formatBillNumber(i + 1),
        customerId,
        subtotal,
        discount,
        totalAmount,
        billDate,
        dueDate,
        promisedDate,
        termsDays: termsDaysFromDue(billDate, dueDate),
        status: b.status,
        sentAt: isSent ? billDate : null,
        notes: b.notes ?? null,
        itemsNote:
          lineItems.length > 0
            ? lineItems.map((it) => `${it.description} x${it.qty}`).join(", ")
            : (b.notes ?? null),
        shareToken: randomBytes(12).toString("base64url"),
        items: { create: lineItems },
        payments: {
          create: b.payments.map(([amount, method]) => ({
            amount,
            method,
            paidOn: billDate,
          })),
        },
        activities: { create: activities },
      },
    });

    if (b.hasReminder) {
      const reminderMessage = `Namaste ${customers[b.customer].name}, friendly reminder for invoice ${bill.billNumber} from Sri Laxmi Stores.`;
      await prisma.reminderLog.create({
        data: {
          billId: bill.id,
          tone: b.dueOffset < 0 ? "FIRM" : "POLITE",
          channel: "WHATSAPP",
          message: reminderMessage,
          sentAt: addDays(today, -1),
        },
      });
      await prisma.activityLog.create({
        data: {
          billId: bill.id,
          type: "REMINDER",
          detail: "Seeded reminder via WHATSAPP",
        },
      });
      seededReminders++;
    }
  }

  console.log(
    `Seeded ${customers.length} customers, ${bills.length} bills, and ${seededReminders} reminders.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());