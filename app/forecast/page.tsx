import Link from "next/link";
import { prisma } from "@/lib/db";
import CashForecastPanel from "@/components/cashforecast/CashForecastPanel";
import { toForecastInput } from "@/lib/cashforecast/fromDb";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const bills = await prisma.bill.findMany({
    where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
    include: {
      customer: { select: { id: true, name: true, whatsappNumber: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const rawExpenses = await prisma.expense.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      amount: true,
      dueDate: true,
      paidOn: true,
    },
    orderBy: { dueDate: "asc" },
  });

  const shop = await prisma.shop.findFirst({
    select: { name: true },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const forecastInput = toForecastInput({
    bills,
    expenses: rawExpenses,
    todayStart,
    shopName: shop?.name ?? "Sri Laxmi Stores",
    openingBalance: 25000,
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <nav
        aria-label="Page views"
        className="flex rounded-2xl border border-stone-200 bg-stone-100 p-1.5 shadow-inner"
      >
        <Link
          href="/"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-center text-sm font-semibold text-stone-600 transition-all hover:text-stone-900 sm:text-base"
        >
          <span aria-hidden="true">📄</span>
          <span>Udhaar Receivables</span>
        </Link>
        <span
          aria-current="page"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-center text-sm font-semibold text-stone-900 shadow-sm sm:text-base"
        >
          <span aria-hidden="true">📈</span>
          <span>Cash Forecast</span>
        </span>
      </nav>

      <CashForecastPanel input={forecastInput} showBackLink={false} />
    </main>
  );
}