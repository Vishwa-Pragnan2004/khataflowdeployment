import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRupees } from "@/lib/money";
import { saveProductPrice, deleteProduct } from "./actions";
import AddProductForm from "@/components/AddProductForm";
import RemoveProductButton from "@/components/RemoveProductButton";

export const dynamic = "force-dynamic";

const UNIT_LABEL: Record<string, string> = {
  KG: "per kg",
  L: "per litre",
  PIECE: "per piece",
};

function categorySlug(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameHi: true, category: true, unit: true, pricePerUnit: true },
  });

  const byCategory = new Map<string, typeof products>();
  for (const product of products) {
    const group = byCategory.get(product.category) ?? [];
    group.push(product);
    byCategory.set(product.category, group);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src="/mascot.png" alt="KhataFlow mascot" className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 object-contain" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">Products &amp; Prices (Saman aur Daam)</h1>
        </div>
      </header>

      <div className="grid w-full gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
          <Link
            href="/"
            className="flex items-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 transition-colors duration-200"
          >
            Back to Udhaar list
          </Link>
          <Link
            href="/bill/new"
            className="flex items-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 transition-colors duration-200"
          >
            New Bill
          </Link>
          <Link
            href="#add-item"
            className="flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            + Add new grocery item (Naya saman)
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mt-2">Categories (Shreni)</p>
          <nav className="flex flex-col gap-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-18rem)]">
            {Array.from(byCategory.keys()).map((category) => (
              <Link
                key={category}
                href={`#${categorySlug(category)}`}
                className="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200"
              >
                {category}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <p className="text-sm text-stone-500">
            Price changes apply to new bills only. Existing bills keep their stored amounts.
          </p>

          <section id="add-item" className="scroll-mt-6">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">Add new grocery item (Naya saman jodiye)</h2>
            <AddProductForm categories={Array.from(byCategory.keys())} />
          </section>

          {products.length === 0 ? (
            <p className="rounded-xl border bg-white p-6 text-center text-stone-700">No products yet.</p>
          ) : (
            Array.from(byCategory.entries()).map(([category, items]) => (
              <section key={category} id={categorySlug(category)} className="scroll-mt-6 flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-stone-800 mt-2">{category}</h2>
                <ul className="flex flex-col gap-4">
                  {items.map((product) => (
                    <li key={product.id} className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-stone-900">{product.name}</span>
                        {product.nameHi && <span className="text-sm text-stone-500">{product.nameHi}</span>}
                        <span className="text-sm font-medium text-emerald-700">
                          {formatRupees(product.pricePerUnit)} {UNIT_LABEL[product.unit] ?? product.unit}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={saveProductPrice} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                          <input type="hidden" name="id" value={product.id} />
                          <input
                            type="number"
                            name="price"
                            defaultValue={product.pricePerUnit}
                            min={1}
                            max={100000}
                            step={1}
                            required
                            className="h-11 w-36 rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <button
                            type="submit"
                            className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-700 active:scale-95"
                          >
                            Save
                          </button>
                        </form>
                        <RemoveProductButton id={product.id} name={product.name} action={deleteProduct} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
