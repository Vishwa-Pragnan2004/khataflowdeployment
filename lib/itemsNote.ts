export type BillItem = { name: string; qty: number; price: number };

export function itemLineTotal(item: BillItem): number {
  return Math.round(item.qty * item.price);
}

export function itemsTotal(items: BillItem[]): number {
  return items.reduce((total, item) => total + itemLineTotal(item), 0);
}

export function buildItemsNote(items: BillItem[]): string {
  return items
    .map((item) => `${item.name} ${item.qty} x ${item.price} = ${itemLineTotal(item)}`)
    .join("\n");
}
