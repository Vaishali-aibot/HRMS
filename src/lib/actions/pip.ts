"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";

export type PIPActionState = { error?: string };

/** HR, or the employee's own reporting manager — same pattern used across
 * every other "decide for this employee" action in this codebase. */
async function canActOnPip(sessionUserId: string, role: string, employeeId: string) {
  if (HR_WRITE_ROLES.includes(role as (typeof HR_WRITE_ROLES)[number])) {
    return true;
  }
  if (role !== "MANAGER") return false;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee?.reportingManagerId) return false;
  const managerEmployee = await prisma.employee.findUnique({ where: { userId: sessionUserId } });
  return !!managerEmployee && employee.reportingManagerId === managerEmployee.id;
}

const createSchema = z.object({
  employeeId: z.string().min(1),
  reason: z.string().min(1, "Reason is required"),
  goals: z.string().min(1, "Improvement goals are required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export async function createPIP(
  _prevState: PIPActionState,
  formData: FormData
): Promise<PIPActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = createSchema.safeParse({
    employeeId: formData.get("employeeId"),
    reason: formData.get("reason"),
    goals: formData.get("goals"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { employeeId, reason, goals, startDate: startDateStr, endDate: endDateStr } = parsed.data;
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (endDate < startDate) {
    return { error: "End date can't be before the start date." };
  }

  try {
    const allowed = await canActOnPip(session.user.id, session.user.role, employeeId);
    if (!allowed) {
      return { error: "You do not have permission to start a PIP for this employee." };
    }

    const existingActive = await prisma.performanceImprovementPlan.findFirst({
      where: { employeeId, status: "ACTIVE" },
    });
    if (existingActive) {
      return { error: "This employee already has an active PIP." };
    }

    await prisma.performanceImprovementPlan.create({
      data: {
        employeeId,
        initiatedById: session.user.id,
        reason,
        goals,
        startDate,
        endDate,
      },
    });
  } catch (err) {
    console.error("createPIP failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance/pip");
  return {};
}

const checkInSchema = z.object({
  pipId: z.string().min(1),
  note: z.string().min(1, "Note is required"),
});

export async function addPIPCheckIn(
  _prevState: PIPActionState,
  formData: FormData
): Promise<PIPActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = checkInSchema.safeParse({
    pipId: formData.get("pipId"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const pip = await prisma.performanceImprovementPlan.findUnique({
      where: { id: parsed.data.pipId },
    });
    if (!pip) {
      return { error: "PIP not found." };
    }
    if (pip.status !== "ACTIVE") {
      return { error: "This PIP is no longer active." };
    }
    const allowed = await canActOnPip(session.user.id, session.user.role, pip.employeeId);
    if (!allowed) {
      return { error: "You do not have permission to update this PIP." };
    }
    await prisma.pIPCheckIn.create({
      data: { pipId: pip.id, note: parsed.data.note, createdById: session.user.id },
    });
  } catch (err) {
    console.error("addPIPCheckIn failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance/pip");
  return {};
}

const closeSchema = z.object({
  pipId: z.string().min(1),
  status: z.enum(["COMPLETED_SUCCESS", "COMPLETED_FAILURE", "CANCELLED"]),
  outcomeNotes: z.string().optional().or(z.literal("")),
});

export async function closePIP(
  _prevState: PIPActionState,
  formData: FormData
): Promise<PIPActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = closeSchema.safeParse({
    pipId: formData.get("pipId"),
    status: formData.get("status"),
    outcomeNotes: formData.get("outcomeNotes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const pip = await prisma.performanceImprovementPlan.findUnique({
      where: { id: parsed.data.pipId },
    });
    if (!pip) {
      return { error: "PIP not found." };
    }
    if (pip.status !== "ACTIVE") {
      return { error: "This PIP has already been closed." };
    }
    const allowed = await canActOnPip(session.user.id, session.user.role, pip.employeeId);
    if (!allowed) {
      return { error: "You do not have permission to close this PIP." };
    }
    await prisma.performanceImprovementPlan.update({
      where: { id: pip.id },
      data: {
        status: parsed.data.status,
        outcomeNotes: parsed.data.outcomeNotes || undefined,
        closedById: session.user.id,
        closedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("closePIP failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance/pip");
  return {};
}
