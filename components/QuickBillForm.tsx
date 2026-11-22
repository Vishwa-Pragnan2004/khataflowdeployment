
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CustomerPicker, { type PickedCustomer } from "@/components/CustomerPicker";
import AddCustomerSheet from "@/components/AddCustomerSheet";
import { createBill } from "@/app/actions";
import { billSchema, type PaymentMethod } from "@/lib/validation";
import { buildItemsNote, itemsTotal, type BillItem } from "@/lib/itemsNote";
import { formatRupees } from "@/lib/money";
import { computeDueDate, DEFAULT_DUE_CHOICE, type DueChoice } from "@/lib/dueDates";
import { formatShortDate, parseInputDate, startOfDay, toInputDate } from "@/lib/dates";
import { buildBillMessage, buildWaLink } from "@/lib/whatsapp";
import { unitsFor, type UnitOption } from "@/lib/units";

type AmountMode = "TOTAL" | "ITEMS";

type ItemRow = {
  id: number;
  name: string;
  qty: string;
  price: string;
  productId: string;
  unitCode: string;
};

type Product = {
  id: number;
  name: string;
  nameHi: string | null;
  unit: string;
  pricePerUnit: number;
};

const DUE_OPTIONS: { value: DueChoice; label: string }[] = [
  { value: "7d", label: "7 days (7 din)" },
  { value: "15d", label: "15 days (15 din)" },
  { value: "EOM", label: "End of month (Mahine ke aakhir)" },
  { value: "custom", label: "Custom" },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "OTHER", label: "Aur tarike" },
];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function toIntOrZero(s: string): number {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

// Units offered on custom (free text) rows.
const CUSTOM_UNITS: UnitOption[] = [
  ...unitsFor("KG"),
  ...unitsFor("L"),
  ...unitsFor("PIECE"),
];

// Short label for a product's base unit, used in the product list.
function productUnitShort(unit: string): string {
  if (unit === "L") return "L";
  if (unit === "PIECE") return "piece";
  return "kg";
}

// Unit option for a row, falling back to the product's first unit.
function optionFor(product: Product, code: string): UnitOption {
  const units = unitsFor(product.unit);
  return units.find((u) => u.code === code) ?? units[0];
}

// Searchable product picker for one item row.
function ProductCombobox(props: {
  products: Product[];
  selected: Product | undefined;
  onPick: (p: Product | undefined) => void;
}) {
  const { products, selected, onPick } = props;
  const [query, setQuery] = useState(selected ? selected.name : "");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameHi ?? "").toLowerCase().includes(q)
    )
    .slice(0, 8);

  function handleChange(text: string) {
    setQuery(text);
    setOpen(true);
    // Drop a stale selection once the text no longer matches it
    if (selected && text !== selected.name) {
      onPick(undefined);
    }
  }

  function choose(p: Product) {
    onPick(p);
    setQuery(p.name);
    setOpen(false);
  }

  function chooseCustom() {
    onPick(undefined);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={query}
        autoComplete="off"
        placeholder="Search item... (saman dhoondhiye)"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg text-stone-900 focus:border-green-700 focus:outline-none"
      />

      {open && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-stone-300 bg-white shadow-sm">
          {matches.length === 0 && (
            <li className="px-3 py-2 text-base text-stone-600">
              No item found. Type a custom name:
            </li>
          )}

          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className="block min-h-12 w-full px-3 py-2 text-left text-base text-stone-900 hover:bg-stone-100"
              >
                {`${
                  p.nameHi ? `${p.name} / ${p.nameHi}` : p.name
                }, Rs ${p.pricePerUnit}/${productUnitShort(p.unit)}`}
              </button>
            </li>
          ))}

          <li>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                chooseCustom();
              }}
              className="block min-h-12 w-full border-t border-stone-200 px-3 py-2 text-left text-base font-semibold text-green-700 hover:bg-stone-100"
            >
              Custom item (khud likhiye)
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}


export default function QuickBillForm(props: {
  initialCustomers: PickedCustomer[];
  products?: Product[];
}) {
  const router = useRouter();
  const [isSaving, startTransition] = useTransition();
  const products = props.products ?? [];

  const [customers, setCustomers] = useState<PickedCustomer[]>(
    props.initialCustomers
  );

  const [selectedCustomer, setSelectedCustomer] =
    useState<PickedCustomer | null>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [mode, setMode] = useState<AmountMode>("TOTAL");

  const [totalStr, setTotalStr] = useState("");

  const [rows, setRows] = useState<ItemRow[]>([
    { id: 1, name: "", qty: "", price: "", productId: "", unitCode: "kg" },
  ]);

  const nextRowId = useRef(2);

  const [dueChoice, setDueChoice] =
    useState<DueChoice>(DEFAULT_DUE_CHOICE);

  const [customStr, setCustomStr] = useState(() =>
    toInputDate(startOfDay(new Date()))
  );

  const todayInput = toInputDate(startOfDay(new Date()));

  const [billDateStr, setBillDateStr] = useState(todayInput);

  const [paidStr, setPaidStr] = useState("");

  const [method, setMethod] = useState<PaymentMethod>("CASH");

  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  // Calculate total amount
  const typedTotal = toIntOrZero(totalStr);

  // Validate and prepare bill items
  const validItems: BillItem[] = rows.flatMap((r) => {
    const product = products.find((p) => String(p.id) === r.productId);
    const name = product ? product.name : r.name.trim();
    const qty = Number(r.qty);

    // Catalog rows: price per entered unit (e.g. Rs 150/kg -> Rs 0.15/g).
    const price = product
      ? product.pricePerUnit * optionFor(product, r.unitCode).toBase
      : toIntOrZero(r.price);

    if (!Number.isFinite(qty) || qty <= 0) {
      return [];
    }

    if (!product && (name === "" || price <= 0)) {
      return [];
    }

    return [{ name, qty, price }];
  });

  const itemsSum = itemsTotal(validItems);

  const total = mode === "TOTAL" ? typedTotal : itemsSum;

  const note =
    mode === "ITEMS" ? buildItemsNote(validItems) : "";

  // Calculate due date
  const customDate = customStr
    ? parseInputDate(customStr)
    : undefined;

  const dueDate: Date | null =
    dueChoice === "custom" && !customDate
      ? null
      : computeDueDate(dueChoice, new Date(), customDate);

  const dueInput = dueDate ? toInputDate(dueDate) : "";

  // Calculate payment
  const paidNow = toIntOrZero(paidStr);

  // Form validation
  const isValid =
    selectedCustomer !== null &&
    total > 0 &&
    paidNow <= total &&
    (dueChoice !== "custom" || Boolean(customDate));

  // Handle newly created customer
  function handleCreated(c: PickedCustomer) {
    setCustomers((prev) => [c, ...prev]);
    setSelectedCustomer(c);
    setIsSheetOpen(false);
  }

  // Update item row
  function updateRow(
    id: number,
    patch: Partial<Omit<ItemRow, "id">>
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      )
    );
  }

  // Select a catalog product for a row (or clear it to custom mode)
  function pickProduct(id: number, picked: Product | undefined) {
    if (picked) {
      updateRow(id, {
        productId: String(picked.id),
        name: picked.name,
        unitCode: unitsFor(picked.unit)[0].code,
      });
    } else {
      updateRow(id, {
        productId: "",
        name: "",
        unitCode: "kg",
      });
    }
  }


  // Add item row
  function addRow() {
    const id = nextRowId.current;
    nextRowId.current += 1;

    setRows((prev) => [
      ...prev,
      { id, name: "", qty: "", price: "", productId: "", unitCode: "kg" },
    ]);
  }

  // Remove item row
  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  // Save bill
  function save(sendWhatsApp: boolean) {
    if (isSaving) return;

    if (!selectedCustomer) {
      setError("Please select a customer.");
      return;
    }

    if (total <= 0) {
      setError("Please enter a valid bill amount.");
      return;
    }

    if (paidNow > total) {
      setError("Paid amount cannot exceed the total bill amount.");
      return;
    }

    if (dueChoice === "custom" && !customDate) {
      setError("Please select a valid due date.");
      return;
    }

    if (
      dueChoice === "custom" &&
      customStr < todayInput
    ) {
      setError("Due date cannot be in the past.");
      return;
    }

    if (!billDateStr) {
      setError("Please select a bill date.");
      return;
    }

    if (billDateStr > todayInput) {
      setError("Bill date cannot be in the future (Bill ki tarikh aaj ya pehle ki honi chahiye)");
      return;
    }

    const input = {
      customerId: selectedCustomer.id,
      totalAmount: total,
      itemsNote: note || undefined,
      dueDate: dueInput,
      billDate: billDateStr,
      paidNow,
      paidMethod: method,
    };

    const parsed = billSchema.safeParse(input);

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Invalid information."
      );
      return;
    }

    setError(null);

    // Open WhatsApp tab immediately to avoid popup blocking.
    const whatsappWindow = sendWhatsApp
      ? window.open("about:blank", "_blank")
      : null;

    if (sendWhatsApp && !whatsappWindow) {
      setError(
        "Please allow popups in your browser to open WhatsApp."
      );
      return;
    }

    startTransition(async () => {
      try {
        const result = await createBill(parsed.data);

        if (!result.ok) {
          whatsappWindow?.close();
          setError(result.error);
          return;
        }

        const data = result.data;

        // Send bill through WhatsApp
        if (sendWhatsApp) {
          const message = buildBillMessage({
            shopName: data.shopName,
            customerName: data.customerName,
            billNumber: data.billNumber,
            totalAmount: data.totalAmount,
            paidNow: data.paidNow,
            dueDate: parseInputDate(data.dueDate),
            ownerName: data.ownerName,
          });

          const whatsappUrl = buildWaLink(
            data.customerWhatsapp,
            message
          );

          if (whatsappWindow) {
            whatsappWindow.location.href = whatsappUrl;
          }
        }

        setToast("Bill ban gaya: " + data.billNumber);

        setTimeout(() => {
          setToast(null);
          router.push("/");
        }, 1200);

      } catch (err) {
        whatsappWindow?.close();

        console.error("Bill creation failed:", err);

        setError(
          "Something went wrong while creating the bill. Please try again."
        );
      }
    });
  }

  // Button styles
  const modeButtonClass = (active: boolean) =>
    `rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-white text-stone-900 shadow-sm"
        : "text-stone-600 hover:text-stone-900"
    }`;

  const chipClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
      active
        ? "border border-emerald-600 bg-emerald-600 text-white shadow-sm"
        : "border border-stone-300 bg-white text-stone-700 hover:border-emerald-400"
    }`;

  return (
    <div className="mx-auto grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">

      {/* Success toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-3 text-base text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Left column: input sections */}
      <div className="flex flex-col gap-5">

      {/* Customer selection */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-stone-800">
          Customer
        </h2>

        <CustomerPicker
          customers={customers}
          selectedId={selectedCustomer?.id ?? null}
          onSelect={(c) => setSelectedCustomer(c)}
          onAddNew={() => setIsSheetOpen(true)}
        />
      </section>

      {/* Amount mode */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => setMode("TOTAL")}
            className={modeButtonClass(mode === "TOTAL")}
          >
            Total Amount (Kul Rashi)
          </button>

          <button
            type="button"
            onClick={() => setMode("ITEMS")}
            className={modeButtonClass(mode === "ITEMS")}
          >
            Add Items (Saman ki List)
          </button>
        </div>

        <p className="text-center text-xs text-stone-500">
          {mode === "TOTAL"
            ? "Ek hi amount likhiye (Enter one total amount)"
            : "Saman ek-ek karke jodiye (Add items one by one)"}
        </p>

        {/* Total amount input */}
        {mode === "TOTAL" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-stone-800">
              Total Amount (Kul Rashi)
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={totalStr}
              onChange={(e) =>
                setTotalStr(digitsOnly(e.target.value))
              }
              placeholder="₹ 0"
              className="h-16 w-full rounded-xl border border-stone-300 bg-white text-center text-3xl font-semibold text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />

            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTotalStr(String(amt))}
                  aria-pressed={typedTotal === amt}
                  className={`rounded-full py-2 text-sm font-medium transition-colors duration-200 ${
                    typedTotal === amt
                      ? "bg-emerald-600 text-white"
                      : "bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {total > 0 && (
              <p className="text-center text-sm text-stone-500">
                {formatRupees(total)}
              </p>
            )}
          </div>
        ) : (

          /* Itemized bill */
          <div className="flex flex-col gap-3">
            {rows.map((r, index) => {
              const product = products.find(
                (p) => String(p.id) === r.productId
              );
              const units = product
                ? unitsFor(product.unit)
                : CUSTOM_UNITS;
              const option = product
                ? optionFor(product, r.unitCode)
                : (CUSTOM_UNITS.find((u) => u.code === r.unitCode) ??
                  CUSTOM_UNITS[0]);
              const perUnit = product
                ? Math.round(
                    product.pricePerUnit * option.toBase * 100
                  ) / 100
                : 0;

              return (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Saman {index + 1}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      aria-label="Saman hatao"
                      className="min-h-12 w-10 text-2xl text-stone-500"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <ProductCombobox
                    products={products}
                    selected={product}
                    onPick={(p) => pickProduct(r.id, p)}
                  />

                  {!product && (
                    <input
                      type="text"
                      value={r.name}
                      placeholder="Saman ka naam"
                      onChange={(e) =>
                        updateRow(r.id, {
                          name: e.target.value,
                        })
                      }
                      className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 px-3 text-lg text-stone-900 focus:border-green-700 focus:outline-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    value={r.qty}
                    placeholder="Qty"
                    onChange={(e) =>
                      updateRow(r.id, {
                        qty: e.target.value,
                      })
                    }
                    className="min-h-12 w-24 rounded-xl border border-stone-300 px-3 text-lg text-stone-900 focus:border-green-700 focus:outline-none"
                  />

                  <select
                    value={option.code}
                    onChange={(e) =>
                      updateRow(r.id, {
                        unitCode: e.target.value,
                      })
                    }
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-2 text-lg text-stone-900 focus:border-green-700 focus:outline-none"
                  >
                    {units.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                      </option>
                    ))}
                  </select>

                  {product ? (
                    <p className="min-h-12 w-32 text-base leading-tight text-stone-700 flex items-center">
                      Rs {perUnit} per {option.label}
                    </p>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={r.price}
                      placeholder="₹"
                      onChange={(e) =>
                        updateRow(r.id, {
                          price: digitsOnly(e.target.value),
                        })
                      }
                      className="min-h-12 w-24 rounded-xl border border-stone-300 px-3 text-lg text-stone-900 focus:border-green-700 focus:outline-none"
                    />
                  )}

                </div>
              </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="min-h-12 w-full rounded-xl border-2 border-dashed border-stone-300 text-lg font-semibold text-green-700"
            >
              + Aur saman
            </button>

            <p className="text-center text-lg text-stone-700">
              Kul: {formatRupees(total)}
            </p>
          </div>
        )}
      </section>

      {/* Bill date */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <label htmlFor="bill-date" className="text-sm font-semibold text-stone-800">
          Bill date (Bill ki tarikh)
        </label>
        <input
          id="bill-date"
          type="date"
          max={todayInput}
          value={billDateStr}
          onChange={(e) => setBillDateStr(e.target.value)}
          className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </section>

      {/* Due date */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-stone-800">
          Due Date (Kab Tak Dena Hai)
        </h2>

        <div className="flex flex-wrap gap-2">
          {DUE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDueChoice(opt.value)}
              aria-pressed={dueChoice === opt.value}
              className={chipClass(dueChoice === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {dueChoice === "custom" && (
          <input
            type="date"
            min={todayInput}
            value={customStr}
            onChange={(e) => setCustomStr(e.target.value)}
            className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        )}

        {dueDate && (
          <p className="text-sm font-medium text-emerald-700">
            Due: {formatShortDate(dueDate)}
          </p>
        )}
      </section>


      {/* Payment details */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <label
          htmlFor="paid-now"
          className="text-sm font-semibold text-stone-800"
        >
          Paid Now (Abhi Mile) - Optional
        </label>

        <input
          id="paid-now"
          type="text"
          inputMode="numeric"
          value={paidStr}
          onChange={(e) =>
            setPaidStr(digitsOnly(e.target.value))
          }
          placeholder="₹ 0"
          className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />

        {paidNow > 0 && (
          <p className="text-sm text-stone-600">
            Balance (Bacha Hua):{" "}
            {formatRupees(Math.max(0, total - paidNow))}
          </p>
        )}

        {paidNow > total && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors duration-200"
          >
            Paid amount cannot exceed total amount. (Bhugtaan kul rashi se zyada nahi ho sakta.)
          </p>
        )}

        {total > 0 && paidNow === total && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Paid in full (Poora bhugtaan)
          </p>
        )}

        {paidNow > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMethod(opt.value)}
                className={chipClass(method === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </section>


      {/* Add customer sheet */}
      <AddCustomerSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onCreated={handleCreated}
      />
      </div>

      {/* Right column: summary and actions */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-6">
        {/* Error message */}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {/* Live summary */}
        <section
          aria-label="Bill summary (Bill ka saar)"
          className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600">Customer (Grahak)</span>
            <span className="truncate text-sm font-medium text-stone-900">
              {selectedCustomer ? selectedCustomer.name : "Not selected"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600">Total (Kul)</span>
            <span className="text-sm font-medium text-stone-900">{formatRupees(total)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600">Paid now (Abhi mile)</span>
            <span className="text-sm font-medium text-stone-900">{formatRupees(paidNow)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600">Balance due (Baaki)</span>
            <span className="text-lg font-bold text-stone-900">
              {formatRupees(Math.max(0, total - paidNow))}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600">Bill date (Bill ki tarikh)</span>
            <span className="text-sm font-medium text-stone-900">
              {billDateStr ? formatShortDate(parseInputDate(billDateStr)) : "Not set"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600">Due date (Kab tak)</span>
            <span className="text-sm font-medium text-stone-900">
              {dueDate ? formatShortDate(dueDate) : "Not set"}
            </span>
          </div>
        </section>

        {/* Save buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => save(true)}
            disabled={isSaving || !isValid}
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {isSaving
              ? "Saving..."
              : "Save & Send on WhatsApp"}
          </button>

          <button
            type="button"
            onClick={() => save(false)}
            disabled={isSaving || !isValid}
            className="h-12 w-full rounded-xl border border-stone-300 bg-white font-semibold text-stone-800 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : "Save Only (Sirf Save)"}
          </button>

          {!isValid && (
            <p className="text-center text-sm text-stone-500">
              {!selectedCustomer
                ? "Customer chuniye (Select a customer to continue)"
                : total <= 0
                  ? "Amount likhiye (Enter an amount)"
                  : "Select both customer and amount (Customer aur amount chuniye)"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

