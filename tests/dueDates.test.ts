import { describe, it, expect } from "vitest";
import { computeDueDate, DEFAULT_DUE_CHOICE } from "../lib/dueDates";

const today = new Date(2024, 0, 15);

describe("computeDueDate", () => {
  it("adds 7 days for 7d", () => {
    expect(computeDueDate("7d", today)).toEqual(new Date(2024, 0, 22));
  });

  it("adds 15 days for 15d", () => {
    expect(computeDueDate("15d", today)).toEqual(new Date(2024, 0, 30));
  });

  it("returns the last day of the month for EOM", () => {
    expect(computeDueDate("EOM", new Date(2024, 1, 10))).toEqual(new Date(2024, 1, 29));
  });

  it("throws when custom is chosen without a date", () => {
    expect(() => computeDueDate("custom", today)).toThrow("Custom date required");
  });

  it("returns the custom date at local start of day", () => {
    const customDate = new Date(2024, 2, 5, 18, 30);
    const result = computeDueDate("custom", today, customDate);
    expect(result).toEqual(new Date(2024, 2, 5));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("defaults to 15d", () => {
    expect(DEFAULT_DUE_CHOICE).toBe("15d");
  });
});
