"use client";

import { useEffect, useState, useTransition } from "react";
import { createCustomer } from "@/app/actions";
import { customerSchema } from "@/lib/validation";

type Customer = { id: number; name: string; whatsappNumber: string };

type FieldErrors = {
  name?: string;
  whatsappNumber?: string;
};

type AddCustomerSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
};

export default function AddCustomerSheet(props: AddCustomerSheetProps) {
  const { open, onClose, onCreated } = props;

  const [name, setName] = useState<string>("");
  const [whatsappNumber, setWhatsappNumber] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  function resetForm() {
    setName("");
    setWhatsappNumber("");
    setFieldErrors({});
    setFormError(null);
  }

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSave() {
    const parsed = customerSchema.safeParse({ name, whatsappNumber });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name" && errors.name === undefined) {
          errors.name = issue.message;
        }
        if (key === "whatsappNumber" && errors.whatsappNumber === undefined) {
          errors.whatsappNumber = issue.message;
        }
      }
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await createCustomer(parsed.data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      onCreated(result.data);
      resetForm();
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-2xl bg-white p-5 pb-8 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Add New Customer (Naya Customer)</h2>

        <div className="mb-4">
          <label htmlFor="customer-name" className="mb-1 block text-base font-medium text-gray-800">
            Name (Naam)
          </label>
          <input
            id="customer-name"
            type="text"
            name="name"
            autoComplete="off"
            placeholder="Jaise: Sunita Didi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-14 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
          />
          {fieldErrors.name && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="customer-whatsapp"
            className="mb-1 block text-base font-medium text-gray-800"
          >
            WhatsApp Number
          </label>
          <input
            id="customer-whatsapp"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10 digit number"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
            className="min-h-14 w-full rounded-xl border border-gray-300 px-4 text-lg text-gray-900 focus:border-green-700 focus:outline-none"
          />
          {fieldErrors.whatsappNumber && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.whatsappNumber}</p>
          )}
        </div>

        {formError && <p className="mb-4 text-sm text-red-600">{formError}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save (Save karo)"}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="mt-3 min-h-14 w-full text-lg font-medium text-gray-700"
        >
          Cancel (Radd karo)
        </button>
      </div>
    </>
  );
}
