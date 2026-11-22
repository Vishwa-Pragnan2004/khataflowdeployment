"use client";

import { useEffect, useState } from "react";

export type PickedCustomer = { id: number; name: string; whatsappNumber: string };

type CustomerPickerProps = {
  customers: PickedCustomer[];
  selectedId: number | null;
  onSelect: (c: PickedCustomer) => void;
  onAddNew: () => void;
};

export default function CustomerPicker(props: CustomerPickerProps) {
  const { customers, selectedId, onSelect, onAddNew } = props;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const trimmed = query.trim().toLowerCase();
  const filtered =
    trimmed === ""
      ? customers
      : customers.filter(
          (c) =>
            c.name.toLowerCase().includes(trimmed) ||
            c.whatsappNumber.toLowerCase().includes(trimmed),
        );

  function closePanel() {
    setIsOpen(false);
    setQuery("");
  }

  function handleSelect(c: PickedCustomer) {
    onSelect(c);
    closePanel();
  }

  function handleAddNew() {
    onAddNew();
    closePanel();
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-12 w-full items-center rounded-xl border border-stone-300 bg-white px-4 text-left text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        {selected ? (
          <span className="flex flex-col">
            <span className="font-semibold text-stone-900">{selected.name}</span>
            <span className="text-stone-500">{selected.whatsappNumber}</span>
          </span>
        ) : (
          <span className="text-stone-500">Select customer (Customer chuniye)</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              autoFocus
              inputMode="search"
              autoComplete="off"
              placeholder="Naam ya number likhiye"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-500">No match found (Koi nahi mila)</p>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`flex w-full flex-col justify-center px-4 py-2.5 text-left text-sm text-stone-800 transition-colors duration-200 ${
                      c.id === selectedId ? "bg-emerald-50 text-emerald-700 font-medium" : "hover:bg-emerald-50"
                    }`}
                  >
                    <span className="font-semibold text-stone-800">{c.name}</span>
                    <span className="text-sm text-stone-500">{c.whatsappNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={handleAddNew}
            className="flex min-h-14 w-full items-center border-t border-stone-200 px-4 py-2.5 text-left text-sm font-semibold text-emerald-700 transition-colors duration-200 hover:bg-emerald-50"
          >
            + Add New Customer (+ Naya Customer)
          </button>
        </div>
      )}
    </div>
  );
}
