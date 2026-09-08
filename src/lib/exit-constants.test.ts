import { describe, expect, it } from "vitest";

import { NOT_EXITABLE_STATUSES } from "./exit-constants";

describe("NOT_EXITABLE_STATUSES", () => {
  it("includes exactly the statuses that mean an exit is already underway or done", () => {
    // A regression here has real consequences: it's the guard both
    // submitResignationRequest and decideResignationRequest use to block a
    // second resignation on someone already exiting (see
    // src/lib/actions/resignation.ts).
    expect(NOT_EXITABLE_STATUSES).toEqual(["NOTICE_PERIOD", "EXITED", "ALUMNI"]);
  });

  it("does not include active/pre-exit statuses", () => {
    for (const status of ["PRE_BOARDING", "ONBOARDING", "PROBATION", "CONFIRMED", "ACTIVE"]) {
      expect(NOT_EXITABLE_STATUSES).not.toContain(status);
    }
  });
});
