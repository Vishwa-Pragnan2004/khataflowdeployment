export function formatBillNumber(n: number): string {
  return "BILL-" + String(n).padStart(4, "0");
}

export function nextBillNumber(lastBillNumber: string | null): string {
  if (lastBillNumber === null) {
    return "BILL-0001";
  }

  const match = /(\d+)$/.exec(lastBillNumber);
  if (!match) {
    throw new Error("Invalid bill number");
  }

  const parsed = Number(match[1]);
  return formatBillNumber(parsed + 1);
}
