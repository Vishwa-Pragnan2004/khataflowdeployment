import { listCustomers } from "@/app/actions";
import { prisma } from "@/lib/db";
import QuickBillForm from "@/components/QuickBillForm";

export const dynamic = "force-dynamic";

export default async function NewBillPage() {
  const customers = await listCustomers();
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      nameHi: true,
      unit: true,
      pricePerUnit: true,
    },
  });

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 pb-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/mascot.png" alt="KhataFlow mascot" className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 object-contain" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">New Credit Bill (Naya Udhaar Bill)</h1>
        </div>
        <a href="/" className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">
          Back (Wapas)
        </a>
      </div>
      <QuickBillForm initialCustomers={customers} products={products} />
    </div>
  );
}
