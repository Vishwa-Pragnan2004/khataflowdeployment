"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function updateProductPrice(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const idRaw = String(formData.get("id") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();

  const id = Number(idRaw);
  if (!idRaw || !Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Invalid product (Galat saman)" };
  }

  const price = Number(priceRaw);
  if (!priceRaw || !Number.isInteger(price) || price < 1 || price > 100000) {
    return {
      ok: false,
      error: "Enter a whole-number price between 1 and 100000 (Daam 1 se 100000 ke beech likhiye)",
    };
  }

  try {
    const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { ok: false, error: "Product not found (Saman nahi mila)" };

    await prisma.product.update({ where: { id }, data: { pricePerUnit: price } });
  } catch {
    return { ok: false, error: "Could not save price (Daam save nahi ho paya, dobara try kijiye)" };
  }

  revalidatePath("/products");
  revalidatePath("/bill/new");
  return { ok: true };
}

export async function saveProductPrice(formData: FormData): Promise<void> {
  await updateProductPrice(formData);
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const idRaw = String(formData.get("id") ?? "").trim();

  const id = Number(idRaw);
  if (!idRaw || !Number.isInteger(id) || id <= 0) {
    return;
  }

  try {
    const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return;

    await prisma.product.delete({ where: { id } });
  } catch {
    return;
  }

  revalidatePath("/products");
  revalidatePath("/bill/new");
}

const PRODUCT_UNITS = ["KG", "L", "PIECE"] as const;

export async function createProduct(
  _prevState: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const nameHi = String(formData.get("nameHi") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const priceRaw = String(formData.get("pricePerUnit") ?? "").trim();

  if (!name || name.length > 80) {
    return { ok: false, error: "Name is required, up to 80 characters (Naam zaroori hai, 80 akshar tak)" };
  }

  if (!category || category.length > 60) {
    return { ok: false, error: "Category is required, up to 60 characters (Shreni zaroori hai, 60 akshar tak)" };
  }

  if (!(PRODUCT_UNITS as readonly string[]).includes(unit)) {
    return { ok: false, error: "Choose a valid unit (Sahi unit chuniye)" };
  }

  const price = Number(priceRaw);
  if (!priceRaw || !Number.isInteger(price) || price < 1 || price > 100000) {
    return {
      ok: false,
      error: "Enter a whole-number price between 1 and 100000 (Daam 1 se 100000 ke beech likhiye)",
    };
  }

  try {
    const existing = await prisma.product.findMany({ select: { name: true } });
    const lower = name.toLowerCase();
    if (existing.some((p) => p.name.trim().toLowerCase() === lower)) {
      return { ok: false, error: "A product with this name already exists (Yeh saman pehle se maujood hai)" };
    }

    await prisma.product.create({
      data: {
        name,
        nameHi: nameHi || null,
        category,
        unit,
        pricePerUnit: price,
      },
    });
  } catch {
    return { ok: false, error: "Could not add item (Saman add nahi ho paya, dobara try kijiye)" };
  }

  revalidatePath("/products");
  revalidatePath("/bill/new");
  return { ok: true };
}

