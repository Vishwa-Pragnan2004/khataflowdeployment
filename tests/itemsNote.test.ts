import { describe, it, expect } from "vitest";
import { itemsTotal, buildItemsNote } from "../lib/itemsNote";

describe("itemsTotal", () => {
  it("sums qty times price across items", () => {
    expect(
      itemsTotal([
        { name: "Atta", qty: 2, price: 60 },
        { name: "Dal", qty: 1, price: 120 },
      ]),
    ).toBe(240);
  });
});

describe("buildItemsNote", () => {
  it("renders a single item line", () => {
    expect(buildItemsNote([{ name: "Atta", qty: 2, price: 60 }])).toBe("Atta 2 x 60 = 120");
  });

  it("returns an empty string for no items", () => {
    expect(buildItemsNote([])).toBe("");
  });
});
