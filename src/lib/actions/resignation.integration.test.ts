import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTestEmployee, resetDb } from "@/lib/test-helpers/db";

import {
  cancelResignationRequest,
  decideResignationRequest,
  submitResignationRequest,
} from "./resignation";

const mockedAuth = vi.mocked(auth);

/** `requireSession`/`requireRole` (src/lib/rbac.ts) call `auth()` — this
 * makes the next call see `session` as if that person were signed in. */
function signInAs(session: { user: { id: string; role: string } }) {
  mockedAuth.mockResolvedValue(session as never);
}

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

/** submitResignationRequest reads `formData.get("reason")` with no
 * null-to-undefined fallback (unlike decideResignationRequest's
 * equivalent field) — never an issue from a real <form>, since a named
 * form control always submits (as an empty string if untouched, never
 * absent), but a manually-built FormData in a test has to reproduce
 * that explicitly or zod's `.optional()` rejects the resulting `null`. */
function submitFormData(fields: { resignationDate: string; noticePeriodDays: string; reason?: string }) {
  return formData({ reason: "", ...fields });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("submitResignationRequest", () => {
  it("creates a PENDING request for the signed-in employee", async () => {
    const { employee, session } = await createTestEmployee();
    signInAs(session);

    const result = await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30", reason: "moving on" })
    );

    expect(result).toEqual({});
    const requests = await prisma.resignationRequest.findMany({
      where: { employeeId: employee.id },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ status: "PENDING", noticePeriodDays: 30, reason: "moving on" });
  });

  it("rejects a second submission while one is already pending", async () => {
    const { session } = await createTestEmployee();
    signInAs(session);
    await submitResignationRequest({}, submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" }));

    const result = await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-15", noticePeriodDays: "15" })
    );

    expect(result.error).toMatch(/already have a pending resignation request/i);
  });

  it("rejects submission once the employee is already in notice period", async () => {
    const { session } = await createTestEmployee({ status: "NOTICE_PERIOD" });
    signInAs(session);

    const result = await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );

    expect(result.error).toMatch(/already been initiated/i);
  });

  it("rejects an account with no linked employee record", async () => {
    signInAs({ user: { id: "no-such-user", role: "EMPLOYEE" } });

    const result = await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );

    expect(result.error).toMatch(/isn't linked to an employee record/i);
  });
});

describe("decideResignationRequest", () => {
  it("HR approving moves the employee to NOTICE_PERIOD and seeds the exit checklist", async () => {
    const { employee, session: employeeSession } = await createTestEmployee();
    const { session: hrSession } = await createTestEmployee({ role: "HR_ADMIN" });
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    signInAs(hrSession);
    const result = await decideResignationRequest(
      {},
      formData({ requestId: request.id, decision: "APPROVED" })
    );

    expect(result).toEqual({});
    const updated = await prisma.resignationRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe("APPROVED");
    const updatedEmployee = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(updatedEmployee.status).toBe("NOTICE_PERIOD");
    const checklist = await prisma.exitChecklistItem.findMany({ where: { employeeId: employee.id } });
    expect(checklist.length).toBeGreaterThan(0);
  });

  it("HR rejecting leaves the employee's status unchanged", async () => {
    const { employee, session: employeeSession } = await createTestEmployee();
    const { session: hrSession } = await createTestEmployee({ role: "HR_ADMIN" });
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    signInAs(hrSession);
    const result = await decideResignationRequest(
      {},
      formData({ requestId: request.id, decision: "REJECTED" })
    );

    expect(result).toEqual({});
    const updated = await prisma.resignationRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe("REJECTED");
    const updatedEmployee = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(updatedEmployee.status).toBe("CONFIRMED");
  });

  it("a manager can decide their own direct report's request", async () => {
    const { session: managerSession, employee: managerEmployee } = await createTestEmployee({
      role: "MANAGER",
    });
    const { employee, session: employeeSession } = await createTestEmployee({
      reportingManagerId: managerEmployee.id,
    });
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    signInAs(managerSession);
    const result = await decideResignationRequest(
      {},
      formData({ requestId: request.id, decision: "APPROVED" })
    );

    expect(result).toEqual({});
  });

  it("a manager cannot decide a request from someone who isn't their direct report", async () => {
    const { session: managerSession } = await createTestEmployee({ role: "MANAGER" });
    const { employee, session: employeeSession } = await createTestEmployee(); // no reportingManagerId
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    signInAs(managerSession);
    const result = await decideResignationRequest(
      {},
      formData({ requestId: request.id, decision: "APPROVED" })
    );

    expect(result.error).toMatch(/do not have permission/i);
    const unchanged = await prisma.resignationRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe("PENDING");
  });

  it("a plain employee cannot decide anyone's request", async () => {
    const { employee, session: employeeSession } = await createTestEmployee();
    const { session: bystanderSession } = await createTestEmployee();
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    signInAs(bystanderSession);
    const result = await decideResignationRequest(
      {},
      formData({ requestId: request.id, decision: "APPROVED" })
    );

    expect(result.error).toMatch(/do not have permission/i);
  });

  it("refuses to decide a request that's already been decided", async () => {
    const { employee, session: employeeSession } = await createTestEmployee();
    const { session: hrSession } = await createTestEmployee({ role: "HR_ADMIN" });
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });
    signInAs(hrSession);
    await decideResignationRequest({}, formData({ requestId: request.id, decision: "APPROVED" }));

    const result = await decideResignationRequest(
      {},
      formData({ requestId: request.id, decision: "REJECTED" })
    );

    expect(result.error).toMatch(/already been decided/i);
  });
});

describe("cancelResignationRequest", () => {
  it("lets the submitter cancel their own pending request", async () => {
    const { employee, session } = await createTestEmployee();
    signInAs(session);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    const result = await cancelResignationRequest({}, formData({ requestId: request.id }));

    expect(result).toEqual({});
    const updated = await prisma.resignationRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("refuses to cancel someone else's request", async () => {
    const { employee, session: employeeSession } = await createTestEmployee();
    const { session: bystanderSession } = await createTestEmployee();
    signInAs(employeeSession);
    await submitResignationRequest(
      {},
      submitFormData({ resignationDate: "2026-12-01", noticePeriodDays: "30" })
    );
    const request = await prisma.resignationRequest.findFirstOrThrow({
      where: { employeeId: employee.id },
    });

    signInAs(bystanderSession);
    const result = await cancelResignationRequest({}, formData({ requestId: request.id }));

    expect(result.error).toMatch(/not found/i);
    const unchanged = await prisma.resignationRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe("PENDING");
  });
});
