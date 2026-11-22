"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProduct } from "@/app/products/actions";

type FormState = { ok: boolean; error?: string } | null;

const UNIT_OPTIONS = [
  { value: "KG", label: "per kg" },
  { value: "L", label: "per litre" },
  { value: "PIECE", label: "per piece" },
];

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const LABEL_CLASS = "text-sm font-semibold text-stone-800";

export default function AddProductForm({ categories }: { categories: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(createProduct, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-product-name" className={LABEL_CLASS}>
              Name (English)
            </label>
            <input id="new-product-name" name="name" type="text" required maxLength={80} className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-product-name-hi" className={LABEL_CLASS}>
              Name (Hindi, optional)
            </label>
            <input id="new-product-name-hi" name="nameHi" type="text" className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-product-category" className={LABEL_CLASS}>
              Category (Shreni)
            </label>
            <input
              id="new-product-category"
              name="category"
              type="text"
              required
              maxLength={60}
              list="product-categories"
              className={INPUT_CLASS}
            />
            <datalist id="product-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-product-unit" className={LABEL_CLASS}>
              Unit
            </label>
            <select id="new-product-unit" name="unit" defaultValue="KG" required className={INPUT_CLASS}>
              {UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-xs">
            <label htmlFor="new-product-price" className={LABEL_CLASS}>
              Price (Daam, whole rupees)
            </label>
            <input
              id="new-product-price"
              name="pricePerUnit"
              type="number"
              required
              min={1}
              max={100000}
              step={1}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {state && !state.ok && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}
        {state?.ok && <p className="text-sm font-medium text-emerald-700">Item added</p>}

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-stone-300"
          >
            {isPending ? "Adding..." : "Add item (Naya saman jodiye)"}
          </button>
        </div>
      </form>
    </div>
  );
}
