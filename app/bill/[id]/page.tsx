import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBillStatus, type BillStatus } from "@/lib/billStatus";
import { formatRupees } from "@/lib/money";
import { formatShortDate } from "@/lib/dates";
import { progressPercent } from "@/lib/paymentRules";
import { lastRemindedLabel } from "@/lib/reminders";
import RecordPaymentModal from "@/components/RecordPaymentModal";
import ReminderModal from "@/components/ReminderModal";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<BillStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  OVERDUE: "Overdue",
  PAID: "Paid",
};

const STATUS_BADGE_CLASSES: Record<BillStatus, string> = {
  UNPAID: "bg-stone-200 text-stone-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-800",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  OTHER: "Other",
};

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      customer: true,
      payments: { orderBy: { paidOn: "asc" } },
      reminders: { orderBy: { sentAt: "desc" }, take: 5 },
    },
  });
  if (!bill) notFound();

  const info = getBillStatus(
    { totalAmount: bill.totalAmount, dueDate: bill.dueDate, payments: bill.payments },
    new Date(),
  );

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-4 bg-stone-50 p-4 pb-10">
      <Link href="/" className="inline-block min-h-12 py-3 text-lg font-medium text-stone-700">
        Back (Wapas)
      </Link>

      <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900">{bill.customer.name}</h1>
        <p className="text-base text-stone-700">+91 {bill.customer.whatsappNumber}</p>
        <a
          href={"tel:+91" + bill.customer.whatsappNumber}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-stone-300 px-4 text-lg font-semibold text-stone-900"
        >
          Call customer (Phone karo)
        </a>
        <p className="text-sm text-stone-500">{bill.billNumber}</p>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${STATUS_BADGE_CLASSES[info.status]}`}
        >
          {STATUS_LABELS[info.status]}
        </span>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-base text-stone-700">
          <span>Total Amount (Kul Rashi)</span>
          <span className="font-semibold text-stone-900">{formatRupees(bill.totalAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-base text-stone-700">
          <span>Paid (Mila)</span>
          <span className="font-semibold text-stone-900">{formatRupees(info.paid)}</span>
        </div>
        <div className="border-t pt-3">
          <p className="text-base text-stone-700">Balance (Bacha Hua)</p>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold text-stone-900">{formatRupees(info.balance)}</span>
            {info.status === "OVERDUE" && (
              <span className="text-lg font-semibold text-red-600">Overdue</span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500">Due {formatShortDate(bill.dueDate)}</p>
          <p className="mt-1 text-sm text-stone-500">Added {formatShortDate(bill.createdAt)}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">Progress (Kitna Mila)</h2>
        <p className="text-lg font-semibold text-stone-900">
          {formatRupees(info.paid)} of {formatRupees(bill.totalAmount)} paid
        </p>
        <div className="w-full h-4 rounded-full bg-stone-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-600"
            style={{ width: progressPercent(info.paid, bill.totalAmount) + "%" }}
          />
        </div>
        <p className="text-sm text-stone-500">
          {progressPercent(info.paid, bill.totalAmount)}% paid
        </p>
      </section>

      {info.balance > 0 ? (
        <RecordPaymentModal billId={bill.id} balance={info.balance} />
      ) : (
        <section className="rounded-2xl bg-green-100 p-5 text-center text-lg font-semibold text-green-800">
          Paid in full (Poora Mila)
        </section>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">Items (Saman)</h2>
        {bill.itemsNote ? (
          <p className="text-base whitespace-pre-line text-stone-800">{bill.itemsNote}</p>
        ) : (
          <p className="text-base text-stone-500">No item list (Saman ki list nahi)</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">Payments (Paisa Mila)</h2>
        {bill.payments.length === 0 ? (
          <p className="text-base text-stone-500">No payment yet (Abhi tak nahi mila)</p>
        ) : (
          <ul className="divide-y">
            {bill.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between py-3">
                <span className="text-base font-semibold text-stone-900">
                  {formatRupees(payment.amount)}
                </span>
                <span className="text-sm text-stone-600">
                  {METHOD_LABELS[payment.method] ?? payment.method} ·{" "}
                  {formatShortDate(payment.paidOn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {info.balance > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="sr-only">Follow-Up Reminder (Yaad Dilao)</h2>
          <ReminderModal billId={bill.id} overdue={info.isOverdue} />
          {bill.reminders.length > 0 && lastRemindedLabel(bill.reminders[0].sentAt, new Date()) && (
            <p className="text-sm text-stone-500">
              {lastRemindedLabel(bill.reminders[0].sentAt, new Date())}
            </p>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">Reminders Sent (Bheje Gaye)</h2>
        {bill.reminders.length === 0 ? (
          <p className="text-base text-stone-500">No reminders yet (Abhi tak nahi bheja)</p>
        ) : (
          <ul className="divide-y">
            {bill.reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center justify-between py-3">
                <span className="text-base font-medium text-stone-900">
                  {reminder.tone === "FIRM" ? "Firm" : "Polite"}
                </span>
                <span className="text-sm text-stone-600">{formatShortDate(reminder.sentAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
