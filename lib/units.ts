export type UnitOption = {
  code: "kg" | "g" | "L" | "ml" | "piece";
  label: string;
  toBase: number;
};

const KG: UnitOption = { code: "kg", label: "kg (kilo)", toBase: 1 };
const GRAM: UnitOption = { code: "g", label: "g (gram)", toBase: 0.001 };
const LITRE: UnitOption = { code: "L", label: "L (litre)", toBase: 1 };
const ML: UnitOption = { code: "ml", label: "ml", toBase: 0.001 };
const PIECE: UnitOption = { code: "piece", label: "piece (nag)", toBase: 1 };

// Units offered for a product, based on the product's base unit.
export function unitsFor(productUnit: string): UnitOption[] {
  switch (productUnit) {
    case "KG":
      return [KG, GRAM];
    case "L":
      return [LITRE, ML];
    case "PIECE":
      return [PIECE];
    default:
      return [KG];
  }
}

// Rupee amount for a quantity in the given unit at a price per base unit.
export function lineAmount(
  qty: number,
  option: UnitOption,
  pricePerBaseUnit: number
): number {
  return Math.round(qty * option.toBase * pricePerBaseUnit);
}
