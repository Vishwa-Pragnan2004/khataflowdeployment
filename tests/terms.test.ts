import { describe, it, expect } from "vitest";
import { computeTermsDueDate, termsDaysFromDue } from "../lib/terms";

const jan15 = new Date(2024, 0, 15);

describe("computeTermsDueDate", () => {
  it("D7 from Jan 15 2024 gives Jan 22", () => {
    expect(computeTermsDueDate("D7", jan15).getTime()).toBe(new Date(2024, 0, 22).getTime());
  });

  it("D15 from Jan 15 2024 gives Jan 30", () => {
    expect(computeTermsDueDate("D15", jan15).getTime()).toBe(new Date(2024, 0, 30).getTime());
  });

  it("D30 from Jan 15 2024 gives Feb 14", () => {
    expect(computeTermsDueDate("D30", jan15).getTime()).toBe(new Date(2024, 1, 14).getTime());
  });

  it("ON_RECEIPT from Jan 15 2024 gives Jan 15", () => {
    expect(computeTermsDueDate("ON_RECEIPT", jan15).getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it("EOM for Feb 10 2024 gives Feb 29", () => {
    expect(computeTermsDueDate("EOM", new Date(2024, 1, 10)).getTime()).toBe(new Date(2024, 1, 29).getTime());
  });

  it("EOM for Apr 10 2024 gives Apr 30", () => {
    expect(computeTermsDueDate("EOM", new Date(2024, 3, 10)).getTime()).toBe(new Date(2024, 3, 30).getTime());
  });

  it("EOM for Dec 10 2024 gives Dec 31", () => {
    expect(computeTermsDueDate("EOM", new Date(2024, 11, 10)).getTime()).toBe(new Date(2024, 11, 31).getTime());
  });

  it("EOM for Jan 5 2025 gives Jan 31", () => {
    expect(computeTermsDueDate("EOM", new Date(2025, 0, 5)).getTime()).toBe(new Date(2025, 0, 31).getTime());
  });

  it("D15 from Dec 20 2024 gives Jan 4 2025", () => {
    expect(computeTermsDueDate("D15", new Date(2024, 11, 20)).getTime()).toBe(new Date(2025, 0, 4).getTime());
  });

  it("D30 from Dec 15 2024 gives Jan 14 2025", () => {
    expect(computeTermsDueDate("D30", new Date(2024, 11, 15)).getTime()).toBe(new Date(2025, 0, 14).getTime());
  });

  it("CUSTOM with no date throws 'Custom date required'", () => {
    expect(() => computeTermsDueDate("CUSTOM", jan15)).toThrow("Custom date required");
  });

  it("CUSTOM with a date returns the start of that day", () => {
    const custom = new Date(2024, 2, 9, 14, 30);
    expect(computeTermsDueDate("CUSTOM", jan15, custom).getTime()).toBe(new Date(2024, 2, 9).getTime());
  });
});

describe("termsDaysFromDue", () => {
  it("Jan 15 to Jan 30 is 15 days", () => {
    expect(termsDaysFromDue(new Date(2024, 0, 15), new Date(2024, 0, 30))).toBe(15);
  });

  it("Jan 15 to Jan 10 is 0 days", () => {
    expect(termsDaysFromDue(new Date(2024, 0, 15), new Date(2024, 0, 10))).toBe(0);
  });
});
