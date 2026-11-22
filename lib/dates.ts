export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const result = startOfDay(d);
  result.setDate(result.getDate() + days);
  return result;
}

export function endOfMonthDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function toInputDate(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseInputDate(s: string): Date {
  const [y, m, d] = s.split("-").map((part) => Number(part));
  return new Date(y, m - 1, d);
}
