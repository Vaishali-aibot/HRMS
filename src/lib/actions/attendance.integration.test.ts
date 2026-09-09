import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTestEmployee, resetDb } from "@/lib/test-helpers/db";

import { markOwnAttendanceToday } from "./attendance";

const mockedAuth = vi.mocked(auth);

function signInAs(session: { user: { id: string; role: string } }) {
  mockedAuth.mockResolvedValue(session as never);
}

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("markOwnAttendanceToday", () => {
  it("creates today's record with checkedInAt set", async () => {
    const { employee, session } = await createTestEmployee();
    signInAs(session);

    const result = await markOwnAttendanceToday({}, formData({ status: "PRESENT" }));

    expect(result).toEqual({});
    const records = await prisma.attendanceRecord.findMany({ where: { employeeId: employee.id } });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("PRESENT");
    expect(records[0].checkedInAt).not.toBeNull();
  });

  // Regression test for a real bug: the no-op early-return for an
  // unchanged status used to skip the whole database write, including
  // checkedInAt — so clicking "Check in for today" again later with the
  // same status silently did nothing (see the commit that added
  // checkedInAt for the full story).
  it("updates checkedInAt to a later time on a same-status re-check-in", async () => {
    const { employee, session } = await createTestEmployee();
    signInAs(session);
    await markOwnAttendanceToday({}, formData({ status: "PRESENT" }));
    const first = await prisma.attendanceRecord.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    // Force a later clock reading than the first insert without a real
    // sleep — checkedInAt only needs to strictly increase, not represent
    // a "realistic" gap.
    await new Promise((r) => setTimeout(r, 5));
    const result = await markOwnAttendanceToday({}, formData({ status: "PRESENT" }));

    expect(result).toEqual({});
    const second = await prisma.attendanceRecord.findFirstOrThrow({
      where: { employeeId: employee.id },
    });
    expect(second.checkedInAt!.getTime()).toBeGreaterThan(first.checkedInAt!.getTime());
    // Still exactly one record for today — an update, not a duplicate.
    const all = await prisma.attendanceRecord.findMany({ where: { employeeId: employee.id } });
    expect(all).toHaveLength(1);
  });

  it("refuses to overwrite a record HR/a manager already set today", async () => {
    const { employee, session } = await createTestEmployee();
    const today = new Date(new Date().toISOString().slice(0, 10));
    await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        date: today,
        status: "ABSENT",
        markedById: "some-other-user-id",
      },
    });
    signInAs(session);

    const result = await markOwnAttendanceToday({}, formData({ status: "PRESENT" }));

    expect(result.error).toMatch(/already been recorded by HR/i);
    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { employeeId: employee.id },
    });
    expect(record.status).toBe("ABSENT");
  });

  it("rejects an account with no linked employee record", async () => {
    signInAs({ user: { id: "no-such-user", role: "EMPLOYEE" } });

    const result = await markOwnAttendanceToday({}, formData({ status: "PRESENT" }));

    expect(result.error).toMatch(/isn't linked to an employee record/i);
  });
});
