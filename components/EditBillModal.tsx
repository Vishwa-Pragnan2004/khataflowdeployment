"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBillDetails } from "@/app/invoice-actions";

type EditBillModalProps = {
  billId: number;
  customerName: string;
  whatsappNumber: string;
  totalAmount: number;
  dueDate: string;
  notes: string;
};

export default function EditBillModal(props: EditBillModalProps) {
  const { billId, customerName, whatsappNumber, totalAmount, dueDate, notes } = props;

  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [total, setTotal] = useState<string>("");
  const [due, setDue] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  function openSheet() {
    setName(customerName);
    setPhone(whatsappNumber);
    setTotal(String(totalAmount));
    setDue(dueDate);
    setNote(notes);
    setError(null);
    setOpen(true);
  }

  function closeSheet() {
    setError(null);
    setOpen(false);
  }

  function handleSave() {
    const numeric = total.trim() === "" ? 0 : Number(total.trim());
    setError(null);

    startTransition(async () => {
      const result = await updateBillDetails({
        billId,
        name,
        whatsappNumber: phone,
        totalAmount: numeric,
        dueDate: due,
        notes: note,
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
        className="inline-flex items-center self-start rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        Edit (Badlo)
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40" onClick={closeSheet} />
          <div className="fixed bottom-0 left-0 right-0 mx-auto max-h-[90vh] max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Edit Bill (Bill Badlo)</h2>

            <div className="mb-4">
              <label htmlFor="edit-name" className="mb-2 block text-base text-gray-800">
                Customer name (Naam)
              </label>
              <input
                id="edit-name"
                type="text"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-phone" className="mb-2 block text-base text-gray-800">
                WhatsApp number (Phone)
              </label>
              <input
                id="edit-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-total" className="mb-2 block text-base text-gray-800">
                Total amount (Kul Rakam)
              </label>
              <input
                id="edit-total"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                className="min-h-12 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-due" className="mb-2 block text-base text-gray-800">
                Due date (Due Tarikh)
              </label>
              <input
                id="edit-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-notes" className="mb-2 block text-base text-gray-800">
                Notes (Note)
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
              />
            </div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Changes (Badlav Save Karo)"}
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
