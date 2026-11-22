import { describe, it, expect } from "vitest";
import { checkPaymentAmount, progressPercent } from "../lib/paymentRules";

describe("checkPaymentAmount", () => {
  it("rejects zero amount", () => {
    const result = checkPaymentAmount(0, 5000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Amount 0 se zyada likhiye");
    }
  });

  it("rejects negative amount", () => {
    const result = checkPaymentAmount(-100, 5000);
    expect(result.ok).toBe(false);
  });

  it("rejects non-integer amount", () => {
    const result = checkPaymentAmount(2.5, 5000);
    expect(result.ok).toBe(false);
  });

  it("accepts amount within balance with no warning", () => {
    const result = checkPaymentAmount(3000, 5000);
    expect(result).toEqual({ ok: true, warning: null });
  });

  it("accepts amount above balance with a warning", () => {
    const result = checkPaymentAmount(6000, 5000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toContain("more than the balance");
    }
  });

  it("accepts payment when balance is zero, with a warning", () => {
    const result = checkPaymentAmount(1, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).not.toBeNull();
    }
  });
});

describe("progressPercent", () => {
  it("computes partial progress", () => {
    expect(progressPercent(2000, 5500)).toBe(36);
  });

  it("returns 0 when nothing is paid", () => {
    expect(progressPercent(0, 5000)).toBe(0);
  });

  it("returns 100 when fully paid", () => {
    expect(progressPercent(5500, 5500)).toBe(100);
  });

  it("clamps overpayment to 100", () => {
    expect(progressPercent(7000, 5000)).toBe(100);
  });

  it("returns 0 when total is zero", () => {
    expect(progressPercent(100, 0)).toBe(0);
  });
});
