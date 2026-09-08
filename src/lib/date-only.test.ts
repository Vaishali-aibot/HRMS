import { describe, expect, it, vi, afterEach } from "vitest";

import {
  DATE_ONLY_PATTERN,
  addMonthsClamped,
  eachDateInRange,
  inclusiveDayCount,
  todayUTC,
  todayUTCString,
} from "./date-only";

afterEach(() => {
  vi.useRealTimers();
});

describe("todayUTC", () => {
  it("returns UTC midnight of the current day, regardless of the time of day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T23:59:00Z"));
    expect(todayUTC().toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("uses the UTC calendar day, not a local-timezone one", () => {
    // Local-timezone-based logic would get this wrong right at midnight in
    // any timezone ahead of UTC — this is exactly the class of bug the
    // DATE_ONLY convention (see the file header comment) exists to avoid.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T00:30:00Z"));
    expect(todayUTC().toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });
});

describe("todayUTCString", () => {
  it("matches todayUTC formatted as YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    expect(todayUTCString()).toBe("2026-01-05");
  });
});

describe("DATE_ONLY_PATTERN", () => {
  it("accepts a plain YYYY-MM-DD string", () => {
    expect(DATE_ONLY_PATTERN.test("2026-09-08")).toBe(true);
  });

  it.each([
    "2026-9-8", // not zero-padded
    "09-08-2026", // wrong order
    "2026-09-08T00:00:00Z", // has a time component
    "not-a-date",
    "",
  ])("rejects %s", (input) => {
    expect(DATE_ONLY_PATTERN.test(input)).toBe(false);
  });
});

describe("inclusiveDayCount", () => {
  it("is 1 for the same start and end date", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    expect(inclusiveDayCount(d, d)).toBe(1);
  });

  it("counts both endpoints", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    const end = new Date("2026-06-05T00:00:00Z");
    expect(inclusiveDayCount(start, end)).toBe(5);
  });

  it("counts correctly across a month boundary", () => {
    const start = new Date("2026-01-30T00:00:00Z");
    const end = new Date("2026-02-02T00:00:00Z");
    expect(inclusiveDayCount(start, end)).toBe(4);
  });
});

describe("eachDateInRange", () => {
  it("returns a single-element array for a one-day range", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    const result = eachDateInRange(d, d);
    expect(result.map((x) => x.toISOString())).toEqual(["2026-06-01T00:00:00.000Z"]);
  });

  it("returns every date inclusive of both ends", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    const end = new Date("2026-06-03T00:00:00Z");
    const result = eachDateInRange(start, end);
    expect(result.map((x) => x.toISOString())).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-06-02T00:00:00.000Z",
      "2026-06-03T00:00:00.000Z",
    ]);
  });
});

describe("addMonthsClamped", () => {
  it("adds months with no clamping needed", () => {
    const result = addMonthsClamped(new Date("2026-01-15T00:00:00Z"), 3);
    expect(result.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    // The exact real-world case this function exists for — see
    // 20260826090000_recompute_probation_end_dates and its commit message.
    const result = addMonthsClamped(new Date("2026-01-31T00:00:00Z"), 1);
    expect(result.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    const result = addMonthsClamped(new Date("2028-01-31T00:00:00Z"), 1);
    expect(result.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("clamps Jan 31 + 3 months to Apr 30, not May 1", () => {
    const result = addMonthsClamped(new Date("2026-01-31T00:00:00Z"), 3);
    expect(result.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("carries across a year boundary", () => {
    const result = addMonthsClamped(new Date("2026-11-30T00:00:00Z"), 3);
    expect(result.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("supports negative months (going backwards)", () => {
    const result = addMonthsClamped(new Date("2026-03-31T00:00:00Z"), -1);
    expect(result.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});
