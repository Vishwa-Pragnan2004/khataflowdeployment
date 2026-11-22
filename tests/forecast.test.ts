import { describe, it, expect } from "vitest";
import {
  buildForecast,
  compareScenario,
  compareScenarios,
  suggestChaseList,
  type ForecastBill,
  type ForecastExpense,
} from "../lib/forecast";

// Fixed "today" so results never depend on the real clock.
const today = new Date(2026, 0, 10);

function bill(overrides: Partial<ForecastBill> & { id: number }): ForecastBill {
  return {
    customerId: 1,
    customerName: "Customer",
    balance: 1000,
    dueDate: new Date(2026, 0, 25),
    promisedDate: null,
    status: "SENT",
    ...overrides,
  };
}

function expense(overrides: Partial<ForecastExpense> & { id: number }): ForecastExpense {
  return {
    title: "Expense",
    category: "General",
    amount: 1000,
    dueDate: new Date(2026, 0, 20),
    paidOn: null,
    ...overrides,
  };
}

describe("buildForecast", () => {
  it("with no bills or expenses, closing cash equals opening cash and there is no negative date", () => {
    const result = buildForecast({
      today,
      openingCash: 1000,
      bills: [],
      expenses: [],
    });

    expect(result.closingCash90).toEqual(1000);
    expect(result.firstNegativeDate).toBeNull();
  });

  it("counts a single open bill with a future due date in the 30-day inflow", () => {
    const result = buildForecast({
      today,
      openingCash: 0,
      bills: [bill({ id: 1, balance: 5000, dueDate: new Date(2026, 0, 25) })],
      expenses: [],
    });

    expect(result.inflow30).toEqual(5000);
    expect(result.inflowItems[0].expectedDate).toEqual(new Date(2026, 0, 25));
  });

  it("moves an overdue bill to seven days from today", () => {
    const result = buildForecast({
      today,
      openingCash: 0,
      bills: [bill({ id: 1, balance: 4000, dueDate: new Date(2026, 0, 1) })],
      expenses: [],
    });

    expect(result.inflowItems[0].expectedDate).toEqual(new Date(2026, 0, 17));
  });

  it("applies a customer delay scenario to that customer's bill only", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [bill({ id: 1, customerId: 1, balance: 5000, dueDate: new Date(2026, 0, 20) })],
      expenses: [],
    };

    const comparison = compareScenario(input, { customerId: 1, delayDays: 15 });

    expect(comparison.scenario.inflowItems[0].expectedDate).toEqual(new Date(2026, 1, 4));
    expect(comparison.base.inflowItems[0].expectedDate).toEqual(new Date(2026, 0, 20));
    // Cash still arrives inside the 90-day window either way.
    expect(comparison.closingCash90Change).toEqual(0);
  });

  it("counts an overdue unpaid expense on today's date", () => {
    const result = buildForecast({
      today,
      openingCash: 0,
      bills: [],
      expenses: [expense({ id: 1, amount: 12000, dueDate: new Date(2026, 0, 7), paidOn: null })],
    });

    expect(result.outflowItems[0].date).toEqual(new Date(2026, 0, 10));
    expect(result.outflow30).toEqual(12000);
  });

  it("reports negative cash and the lowest balance when an expense exceeds opening cash", () => {
    const result = buildForecast({
      today,
      openingCash: 1000,
      bills: [],
      expenses: [expense({ id: 1, amount: 5000, dueDate: new Date(2026, 0, 15), paidOn: null })],
    });

    expect(result.lowestCash).toEqual(-4000);
    // The engine reports negative cash at the start of the weekly bucket
    // (day 0 = today) that contains the expense, not on the expense date itself.
    expect(result.firstNegativeDate).toEqual(new Date(2026, 0, 10));
  });
});

describe("compareScenarios", () => {
  it("with an empty scenario list, gives zero changes and the scenario equals the baseline", () => {
    const result = compareScenarios(
      {
        today,
        openingCash: 0,
        bills: [bill({ id: 1, customerId: 1, balance: 5000, dueDate: new Date(2026, 0, 20) })],
        expenses: [expense({ id: 2, amount: 3000, dueDate: new Date(2026, 0, 15) })],
      },
      [],
    );

    expect(result.lowestCashChange).toEqual(0);
    expect(result.closingCash90Change).toEqual(0);
    expect(result.scenario).toEqual(result.base);
  });

  it("with one affected customer, matches compareScenario for that delay", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [
        bill({ id: 1, customerId: 1, balance: 5000, dueDate: new Date(2026, 0, 20) }),
        bill({ id: 2, customerId: 2, balance: 2000, dueDate: new Date(2026, 0, 12) }),
      ],
      expenses: [expense({ id: 3, amount: 6000, dueDate: new Date(2026, 0, 25) })],
    };

    // Customer 99 has no open bills, so only customer 1 is actually affected.
    const multi = compareScenarios(input, [
      { customerId: 1, delayDays: 15 },
      { customerId: 99, delayDays: 30 },
    ]);
    const single = compareScenario(input, { customerId: 1, delayDays: 15 });

    expect(multi.scenario).toEqual(single.scenario);
    expect(multi.lowestCashChange).toEqual(single.lowestCashChange);
    expect(multi.closingCash90Change).toEqual(single.closingCash90Change);
  });

  it("with two delayed customers, the combined changes equal the sum of the single-customer changes", () => {
    // Day 0 = Jan 10. Customer 1 pays Jan 12 (day 2), customer 2 pays Jan 13 (day 3),
    // both in week 1. A 6000 expense on Jan 25 (day 15, week 3) is the low point.
    // A 20-day delay moves each receipt to week 4 (day 22 / day 23), still inside 90 days.
    const input = {
      today,
      openingCash: 0,
      bills: [
        bill({ id: 1, customerId: 1, balance: 3000, dueDate: new Date(2026, 0, 12) }),
        bill({ id: 2, customerId: 2, balance: 2000, dueDate: new Date(2026, 0, 13) }),
      ],
      expenses: [expense({ id: 3, amount: 6000, dueDate: new Date(2026, 0, 25) })],
    };

    const onlyC1 = compareScenario(input, { customerId: 1, delayDays: 20 });
    const onlyC2 = compareScenario(input, { customerId: 2, delayDays: 20 });
    const both = compareScenarios(input, [
      { customerId: 1, delayDays: 20 },
      { customerId: 2, delayDays: 20 },
    ]);

    // Sanity: the low point is at week 3 (-1000 base) and both delays move it.
    expect(both.base.lowestCash).toEqual(-1000);
    expect(onlyC1.lowestCashChange).toEqual(-3000);
    expect(onlyC2.lowestCashChange).toEqual(-2000);

    // Closing cash at day 90 is unchanged by moves that stay inside the window,
    // so the additive check holds (0 = 0 + 0).
    expect(both.closingCash90Change).toEqual(onlyC1.closingCash90Change + onlyC2.closingCash90Change);
    // Lowest-cash changes are additive here because both receipts leave week 1
    // before the week 3 low point in this data set.
    expect(both.lowestCashChange).toEqual(onlyC1.lowestCashChange + onlyC2.lowestCashChange);
    expect(both.lowestCashChange).toEqual(-5000);
  });

  it("when two scenarios name the same customer, the last one wins", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [bill({ id: 1, customerId: 1, balance: 5000, dueDate: new Date(2026, 0, 20) })],
      expenses: [],
    };

    const multi = compareScenarios(input, [
      { customerId: 1, delayDays: 5 },
      { customerId: 1, delayDays: 15 },
    ]);
    const single = compareScenario(input, { customerId: 1, delayDays: 15 });

    expect(multi.scenario.inflowItems[0].expectedDate).toEqual(new Date(2026, 1, 4));
    expect(multi.scenario).toEqual(single.scenario);
  });
});

describe("suggestChaseList", () => {
  it("lists only overdue bills, with days overdue and the chase action", () => {
    const items = suggestChaseList(
      [
        bill({ id: 1, customerName: "Late Payer", balance: 3000, dueDate: new Date(2026, 0, 3) }),
        bill({ id: 2, customerName: "Future Payer", balance: 2000, dueDate: new Date(2026, 0, 20) }),
      ],
      today,
    );

    expect(items).toHaveLength(1);
    expect(items[0].daysOverdue).toEqual(7);
    expect(items[0].suggestedAction).toEqual("Chase today");
  });
});

describe("scenario targets", () => {
  // Inflow expected date for one bill, looked up by id.
  function expectedOf(result: { inflowItems: { billId: number; expectedDate: Date }[] }, id: number) {
    return result.inflowItems.find((i) => i.billId === id)!.expectedDate;
  }

  it("overdue target shifts only the earliest overdue bill", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [
        bill({ id: 1, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 1) }),
        bill({ id: 2, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 5) }),
        bill({ id: 3, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 20) }),
      ],
      expenses: [],
    };

    const result = compareScenarios(input, [{ customerId: 1, delayDays: 15, target: "overdue" }]);

    // Overdue bills land on today + 7 (Jan 17) in the base; only bill 1 moves by 15 days.
    expect(expectedOf(result.scenario, 1)).toEqual(new Date(2026, 1, 1));
    expect(expectedOf(result.scenario, 2)).toEqual(new Date(2026, 0, 17));
    expect(expectedOf(result.scenario, 3)).toEqual(new Date(2026, 0, 20));
  });

  it("next target shifts only the earliest bill due today or later", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [
        bill({ id: 1, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 5) }),
        bill({ id: 2, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 10) }),
        bill({ id: 3, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 20) }),
      ],
      expenses: [],
    };

    const result = compareScenarios(input, [{ customerId: 1, delayDays: 5, target: "next" }]);

    // Bill 2 (due today, Jan 10) moves to Jan 15. Bill 1 stays at its overdue landing (Jan 17)
    // and bill 3 stays on Jan 20.
    expect(expectedOf(result.scenario, 2)).toEqual(new Date(2026, 0, 15));
    expect(expectedOf(result.scenario, 1)).toEqual(new Date(2026, 0, 17));
    expect(expectedOf(result.scenario, 3)).toEqual(new Date(2026, 0, 20));
  });

  it("endOfMonth target shifts only bills due in the last 7 days of their month", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [
        bill({ id: 1, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 26) }), // Jan 26: in last 7 days of 31
        bill({ id: 2, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 20) }), // Jan 20: not
        bill({ id: 3, customerId: 1, balance: 1000, dueDate: new Date(2026, 1, 27) }), // Feb 27: in last 7 days of 28
      ],
      expenses: [],
    };

    const result = compareScenarios(input, [{ customerId: 1, delayDays: 3, target: "endOfMonth" }]);

    expect(expectedOf(result.scenario, 1)).toEqual(new Date(2026, 0, 29));
    expect(expectedOf(result.scenario, 2)).toEqual(new Date(2026, 0, 20));
    expect(expectedOf(result.scenario, 3)).toEqual(new Date(2026, 2, 2));
  });

  it("stacked scenarios on different customers with different targets combine", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [
        bill({ id: 1, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 5) }), // overdue
        bill({ id: 4, customerId: 1, balance: 1000, dueDate: new Date(2026, 0, 20) }),
        bill({ id: 2, customerId: 2, balance: 1000, dueDate: new Date(2026, 0, 13) }), // next
        bill({ id: 3, customerId: 2, balance: 1000, dueDate: new Date(2026, 0, 28) }),
      ],
      expenses: [],
    };

    const result = compareScenarios(input, [
      { customerId: 1, delayDays: 10, target: "overdue" },
      { customerId: 2, delayDays: 10, target: "next" },
    ]);

    expect(expectedOf(result.scenario, 1)).toEqual(new Date(2026, 0, 27));
    expect(expectedOf(result.scenario, 4)).toEqual(new Date(2026, 0, 20));
    expect(expectedOf(result.scenario, 2)).toEqual(new Date(2026, 0, 23));
    expect(expectedOf(result.scenario, 3)).toEqual(new Date(2026, 0, 28));
  });
});

describe("daily lowest cash and due-date cash", () => {
  it("(a) a day-0 overdue expense makes lowestCash the daily minimum, not the opening balance", () => {
    const result = buildForecast({
      today,
      openingCash: 10000,
      bills: [bill({ id: 1, balance: 5000, dueDate: new Date(2026, 0, 15) })], // day 5
      expenses: [expense({ id: 2, amount: 12000, dueDate: new Date(2026, 0, 7) })], // overdue -> day 0
    });

    // Day 0: 10000 - 12000 = -2000 (the dip). Day 5: -2000 + 5000 = 3000.
    // A weekly-only low would report 3000; the daily minimum is -2000 on today.
    expect(result.lowestCash).toEqual(-2000);
    expect(result.lowestCashDate).toEqual(new Date(2026, 0, 10));
  });

  it("(b) delaying a receipt that lands on a dip day changes lowestCashChange", () => {
    const input = {
      today,
      openingCash: 1000,
      // Receipt of 4000 lands Jan 15 (day 5), the same day as a 7000 expense.
      bills: [bill({ id: 1, customerId: 1, balance: 4000, dueDate: new Date(2026, 0, 15) })],
      expenses: [expense({ id: 2, amount: 7000, dueDate: new Date(2026, 0, 15) })],
    };

    const comparison = compareScenario(input, { customerId: 1, delayDays: 10 });

    // Base: day 5 = 1000 + 4000 - 7000 = -2000 (the low point).
    // Scenario: receipt moves to day 15, so day 5 = 1000 - 7000 = -6000.
    expect(comparison.base.lowestCash).toEqual(-2000);
    expect(comparison.scenario.lowestCash).toEqual(-6000);
    expect(comparison.lowestCashChange).toEqual(-4000);
  });

  it("(c) delaying a bill inside 90 days gives dueDateCashChange < 0 and closingCash90Change = 0", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [bill({ id: 1, customerId: 1, balance: 5000, dueDate: new Date(2026, 0, 20) })], // day 10
      expenses: [],
    };

    const comparison = compareScenario(input, { customerId: 1, delayDays: 15 });

    // On Jan 20 the base has the 5000 receipt; the scenario has not received it yet.
    expect(comparison.dueDateCashChange).toBeLessThan(0);
    expect(comparison.dueDateCashChange).toEqual(-5000);
    expect(comparison.closingCash90Change).toEqual(0);
  });

  it("(d) with no affected bills, dueDateCashChange is 0", () => {
    const input = {
      today,
      openingCash: 0,
      bills: [bill({ id: 1, customerId: 1, balance: 5000, dueDate: new Date(2026, 0, 20) })],
      expenses: [expense({ id: 2, amount: 3000, dueDate: new Date(2026, 0, 15) })],
    };

    expect(compareScenarios(input, []).dueDateCashChange).toEqual(0);
    // Customer 99 has no open bills, so nothing is moved.
    expect(compareScenarios(input, [{ customerId: 99, delayDays: 30 }]).dueDateCashChange).toEqual(0);
    expect(compareScenario(input, { customerId: 99, delayDays: 30 }).dueDateCashChange).toEqual(0);
  });
});


