"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type CustomerOption, rankCustomers } from "@/lib/customerSearch";

type Props = {
  customers: CustomerOption[];
  defaultValue: string;
  status?: string;
};

function highlight(name: string, q: string) {
  const idx = q ? name.toLowerCase().indexOf(q) : -1;
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <span className="font-bold text-emerald-700">{name.slice(idx, idx + q.length)}</span>
      {name.slice(idx + q.length)}
    </>
  );
}

export default function CustomerSearch({ customers, defaultValue, status }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  const results = rankCustomers(customers, value);
  const trimmed = value.trim();
  const q = trimmed.toLowerCase();
  const show = open && (trimmed !== "" || results.length > 0);

  function handleFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function handleSelect(name: string) {
    // Set the DOM value directly so requestSubmit reads the chosen name.
    if (inputRef.current) inputRef.current.value = name;
    setValue(name);
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="relative w-full">
      <form ref={formRef} method="get" action="/" className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            name="q"
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              if (e.target.value === "" && defaultValue !== "") {
                router.push("/?status=ALL");
              }
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search customer name (Naam se dhoondhiye)"
            className="w-full rounded-full border-2 border-emerald-200 bg-white py-3 pl-11 pr-4 text-base text-stone-800 shadow-sm outline-none transition focus:border-emerald-500 focus:shadow-md"
          />
          {status ? <input type="hidden" name="status" value={status} /> : null}
        </div>
        <button
          type="submit"
          className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white shadow hover:bg-emerald-700 active:scale-95 transition"
        >
          Search
        </button>
      </form>

      {show && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-stone-500">No customer found for &quot;{value}&quot;</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(c.name)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 font-medium text-stone-800">{highlight(c.name, q)}</span>
                {i === 0 && <span className="ml-auto text-xs text-stone-400">Enter</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
