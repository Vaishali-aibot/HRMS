"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";
import { commenceNoticePeriod } from "@/lib/actions/exit";
import { NOT_EXITABLE_STATUSES } from "@/lib/exit-constants";

export type ResignationActionState = { error?: string };

const submitSchema = z.object({
  resignationDate: z.string().min(1, "Resignation date is required"),
  noticePeriodDays: z.coerce.number().int().nonnegative("Must be zero or more"),
  reason: z.string().optional().or(z.literal("")),
});

/**
 * The employee-submits half of the PRD §24 gate — HR/a manager decides via
 * decideResignationRequest below. (initiateExit in exit.ts remains the
 * direct-HR-records-it alternative to this whole flow.)
 */
export async function submitResignationRequest(
  _prevState: ResignationActionState,
  formData: FormData
): Promise<ResignationActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = submitSchema.safeParse({
    resignationDate: formData.get("resignationDate"),
    noticePeriodDays: formData.get("noticePeriodDays"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { noticePeriodDays, reason } = parsed.data;
  const resignationDate = new Date(parsed.data.resignationDate);

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!employee) {
      return { error: "Your account isn't linked to an employee record yet — contact HR." };
    }
    if (NOT_EXITABLE_STATUSES.includes(employee.status as (typeof NOT_EXITABLE_STATUSES)[number])) {
      return { error: "Your exit has already been initiated (or completed)." };
    }
    const existingPending = await prisma.resignationRequest.findFirst({
      where: { employeeId: employee.id, status: "PENDING" },
    });
    if (existingPending) {
      return { error: "You already have a pending resignation request." };
    }

    await prisma.resignationRequest.create({
      data: { employeeId: employee.id, resignationDate, noticePeriodDays, reason: reason || undefined },
    });
  } catch (err) {
    console.error("submitResignationRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return {};
}

const decideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().optional().or(z.literal("")),
});

export async function decideResignationRequest(
  _prevState: ResignationActionState,
  formData: FormData
): Promise<ResignationActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = decideSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionReason: formData.get("decisionReason") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { requestId, decision, decisionReason } = parsed.data;

  try {
    const request = await prisma.resignationRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });
    if (!request) {
      return { error: "Resignation request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "This request has already been decided." };
    }

    const isHR = HR_WRITE_ROLES.includes(session.user.role);
    let isManager = false;
    if (!isHR && session.user.role === "MANAGER") {
      const managerEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
      });
      isManager = !!managerEmployee && request.employee.reportingManagerId === managerEmployee.id;
    }
    if (!isHR && !isManager) {
      return { error: "You do not have permission to decide this request." };
    }

    if (decision === "APPROVED") {
      if (
        NOT_EXITABLE_STATUSES.includes(
          request.employee.status as (typeof NOT_EXITABLE_STATUSES)[number]
        )
      ) {
        return { error: "This employee's exit has already been initiated (or completed)." };
      }
      await prisma.$transaction(async (tx) => {
        await commenceNoticePeriod(
          tx,
          request.employeeId,
          request.employee.status,
          request.resignationDate,
          request.noticePeriodDays,
          request.reason ?? undefined,
          session.user.id
        );
        await tx.resignationRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            approverId: session.user.id,
            decidedAt: new Date(),
            decisionReason: decisionReason || undefined,
          },
        });
      });
    } else {
      await prisma.resignationRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          approverId: session.user.id,
          decidedAt: new Date(),
          decisionReason: decisionReason || undefined,
        },
      });
    }
  } catch (err) {
    console.error("decideResignationRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/exits");
  return {};
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelResignationRequest(
  _prevState: ResignationActionState,
  formData: FormData
): Promise<ResignationActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = cancelSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) {
    return { error: "Invalid request." };
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!employee) {
      return { error: "Your account isn't linked to an employee record." };
    }
    const request = await prisma.resignationRequest.findUnique({
      where: { id: parsed.data.requestId },
    });
    if (!request || request.employeeId !== employee.id) {
      return { error: "Resignation request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "Only pending requests can be cancelled." };
    }
    await prisma.resignationRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    console.error("cancelResignationRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return {};
}
