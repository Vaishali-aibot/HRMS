import { describe, expect, it } from "vitest";
import {
  CalendarOff,
  CheckCircle2,
  Clock,
  Clock3,
  HelpCircle,
  Home as HomeIcon,
  PartyPopper,
  XCircle,
} from "lucide-react";

import { iconForAttendanceStatus } from "./attendance-status-icon";

describe("iconForAttendanceStatus", () => {
  it.each([
    ["PRESENT", CheckCircle2],
    ["ABSENT", XCircle],
    ["LATE", Clock],
    ["HALF_DAY", Clock3],
    ["WORK_FROM_HOME", HomeIcon],
    ["HOLIDAY", PartyPopper],
    ["ON_LEAVE", CalendarOff],
  ])("maps %s to its icon", (status, icon) => {
    expect(iconForAttendanceStatus(status)).toBe(icon);
  });

  it("falls back to HelpCircle for an unrecognized status", () => {
    // AttendanceStatus also has MISSING, which this file's switch doesn't
    // list explicitly — confirms that (and any future new status) still
    // renders something instead of throwing.
    expect(iconForAttendanceStatus("MISSING")).toBe(HelpCircle);
    expect(iconForAttendanceStatus("something-unexpected")).toBe(HelpCircle);
  });
});
