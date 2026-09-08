import { describe, expect, it, vi, afterEach } from "vitest";

import { computeAccruedBase, quarterLabel, remainingFromBalance } from "./leave-balance";

afterEach(() => {
  vi.useRealTimers();
});

describe("remainingFromBalance", () => {
  it("subtracts both used and encashed from allocated", () => {
    expect(remainingFromBalance({ allocated: 10, used: 3, encashed: 2 })).toBe(5);
  });

  it("is the full allocation when nothing's been used or encashed", () => {
    expect(remainingFromBalance({ allocated: 7.5, used: 0, encashed: 0 })).toBe(7.5);
  });

  it("can go negative if more was used/encashed than allocated", () => {
    // Not clamped to zero — a real scenario this needs to reflect
    // correctly is a leave type whose annualDays HR reduced after some was
    // already used.
    expect(remainingFromBalance({ allocated: 5, used: 6, encashed: 0 })).toBe(-1);
  });
});

describe("computeAccruedBase", () => {
  describe("ANNUAL accrual (the default — accrualMethod isn't MONTHLY or QUARTERLY)", () => {
    it("is always the full annualDays, regardless of the current date", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      expect(computeAccruedBase({ annualDays: 12, accrualMethod: "ANNUAL" }, 2026)).toBe(12);
    });
  });

  describe("QUARTERLY accrual", () => {
    it.each([
      ["2026-01-15", 1], // Q1
      ["2026-04-15", 2], // Q2
      ["2026-07-15", 3], // Q3
      ["2026-10-15", 4], // Q4
      ["2026-12-31", 4], // still Q4
    ])("with 'now' in %s, counts %i quarter(s) elapsed for the current year", (now, quarters) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${now}T00:00:00Z`));
      // annualDays: 20 -> 5/quarter, so accrued = 5 * quarters elapsed
      expect(computeAccruedBase({ annualDays: 20, accrualMethod: "QUARTERLY" }, 2026)).toBe(
        5 * quarters
      );
    });

    it("is the full amount for a year already in the past", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
      expect(computeAccruedBase({ annualDays: 20, accrualMethod: "QUARTERLY" }, 2026)).toBe(20);
    });

    it("is zero for a year still in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      expect(computeAccruedBase({ annualDays: 20, accrualMethod: "QUARTERLY" }, 2026)).toBe(0);
    });
  });

  describe("MONTHLY accrual", () => {
    it.each([
      ["2026-01-05", 1],
      ["2026-06-30", 6],
      ["2026-12-01", 12],
    ])("with 'now' in %s, counts %i month(s) elapsed for the current year", (now, months) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${now}T00:00:00Z`));
      // annualDays: 12 -> 1/month, so accrued = 1 * months elapsed
      expect(computeAccruedBase({ annualDays: 12, accrualMethod: "MONTHLY" }, 2026)).toBe(months);
    });
  });
});

describe("quarterLabel", () => {
  it.each([
    ["2026-01-01", "Jan–Mar 2026"],
    ["2026-03-31", "Jan–Mar 2026"],
    ["2026-04-01", "Apr–Jun 2026"],
    ["2026-06-30", "Apr–Jun 2026"],
    ["2026-07-01", "Jul–Sep 2026"],
    ["2026-09-30", "Jul–Sep 2026"],
    ["2026-10-01", "Oct–Dec 2026"],
    ["2026-12-31", "Oct–Dec 2026"],
  ])("labels %s as %s", (date, label) => {
    expect(quarterLabel(new Date(`${date}T00:00:00Z`))).toBe(label);
  });
});
