export type AmountCheck = { ok: true; warning: string | null } | { ok: false; error: string };

export function checkPaymentAmount(amount: number, balance: number): AmountCheck {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Amount 0 se zyada likhiye" };
  }
  if (amount > balance) {
    return {
      ok: true,
      warning: "Amount is more than the balance (Balance se zyada hai)",
    };
  }
  return { ok: true, warning: null };
}

export function progressPercent(paid: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const raw = Math.round((paid / total) * 100);
  return Math.min(100, Math.max(0, raw));
}
