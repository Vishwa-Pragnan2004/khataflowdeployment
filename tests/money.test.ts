import { describe, it, expect } from "vitest";
import { formatRupees } from "../lib/money";

describe("formatRupees", () => {
  it("formats an Indian-grouped rupee amount", () => {
    expect(formatRupees(123456)).toBe("₹1,23,456");
  });

  it("formats zero as ₹0", () => {
    expect(formatRupees(0)).toBe("₹0");
  });
});
