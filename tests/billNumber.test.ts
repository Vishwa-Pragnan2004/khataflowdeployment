import { describe, it, expect } from "vitest";
import { nextBillNumber } from "../lib/billNumber";

describe("nextBillNumber", () => {
  it("starts at BILL-0001 when there is no previous bill", () => {
    expect(nextBillNumber(null)).toBe("BILL-0001");
  });

  it("increments the previous bill number", () => {
    expect(nextBillNumber("BILL-0009")).toBe("BILL-0010");
  });

  it("throws on an unparseable bill number", () => {
    expect(() => nextBillNumber("junk")).toThrow("Invalid bill number");
  });
});
