"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/app/actions";
import { formatRupees } from "@/lib/money";
import { toInputDate } from "@/lib/dates";
import { checkPaymentAmount } from "@/lib/paymentRules";

type PaymentMethod = "CASH" | "UPI" | "OTHER";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "OTHER", label: "Other (Aur tarike)" },
];

type RecordPaymentModalProps = {
  billId: number;
  balance: number;
};

export default function RecordPaymentModal(props: RecordPaymentModalProps) {
  const { billId, balance } = props;

  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [dateValue, setDateValue] = useState<string>(toInputDate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const amountCheck = checkPaymentAmount(amount.trim() === "" ? 0 : Number(amount.trim()), balance);
  const warning = amountCheck.ok ? amountCheck.warning : null;

  function resetForm() {
    setAmount("");
    setMethod("CASH");
    setDateValue(toInputDate(new Date()));
    setError(null);
  }

  function openSheet() {
    setAmount(String(balance));
    setMethod("CASH");
    setDateValue(toInputDate(new Date()));
    setError(null);
    setOpen(true);
  }

  function closeSheet() {
    resetForm();
    setOpen(false);
  }

  function handleSave() {
    const trimmed = amount.trim();
    const numeric = trimmed === "" ? 0 : Number(trimmed);
    const check = checkPaymentAmount(numeric, balance);

    if (!check.ok) {
      setError(check.error);
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await recordPayment({
        billId,
        amount: numeric,
        method,
        ...(dateValue === "" ? {} : { paidOn: dateValue }),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeSheet();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white"
      >
        Got Payment (Paisa Mila)
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40" onClick={closeSheet} />
          <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-2xl bg-white p-5 pb-8 shadow-xl">
            <h2 className="mb-2 text-xl font-bold text-gray-900">Got Payment (Paisa Mila)</h2>
            <p className="mb-4 text-base text-gray-800">
              Balance (Bacha Hua): {formatRupees(balance)}
            </p>

            <div className="mb-4">
              <input
                id="payment-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="min-h-16 w-full rounded-xl border border-gray-300 px-4 text-center text-3xl font-bold text-gray-900 focus:border-green-700 focus:outline-none"
              />
              {warning && <p className="mt-2 text-sm text-amber-700">{warning}</p>}
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {METHOD_OPTIONS.map((option) => {
                const selected = method === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMethod(option.value)}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "min-h-12 rounded-full bg-green-700 px-4 text-base font-medium text-white"
                        : "min-h-12 rounded-full bg-stone-200 px-4 text-base font-medium text-gray-800"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <label htmlFor="payment-date" className="mb-2 block text-base text-gray-800">
                Date (Kab Diya)
              </label>
              <input
                id="payment-date"
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
              />
            </div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Payment (Paisa Save Karo)"}
            </button>

            <button
              type="button"
              onClick={closeSheet}
              className="mt-3 min-h-14 w-full text-lg font-medium text-gray-700"
            >
              Cancel (Radd karo)
            </button>
          </div>
        </>
      )}
    </>
  );
}
