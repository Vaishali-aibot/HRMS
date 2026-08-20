"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole, requireSession } from "@/lib/rbac";

export type HRRequestActionState = { error?: string };

const CATEGORIES = [
  "LEAVE",
  "ATTENDANCE",
  "SALARY_DOCUMENTS",
  "EMPLOYMENT_LETTERS",
  "PERSONAL_INFO_UPDATE",
  "POLICY_CLARIFICATION",
  "BENEFITS",
  "PAYROLL_QUERY",
  "OTHER",
] as const;

const submitSchema = z.object({
  category: z.enum(CATEGORIES),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(1, "Please describe your request"),
});

export async function submitHRRequest(
  _prevState: HRRequestActionState,
  formData: FormData
): Promise<HRRequestActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return { error: "Your account isn't linked to an employee record yet — contact HR." };
  }

  const parsed = submitSchema.safeParse({
    category: formData.get("category"),
    subject: formData.get("subject"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.hRRequest.create({
      data: {
        employeeId: employee.id,
        category: parsed.data.category,
        subject: parsed.data.subject,
        description: parsed.data.description,
        status: "SUBMITTED",
      },
    });
  } catch (err) {
    console.error("submitHRRequest failed:", err);
    return { error: "Something went wrong while submitting your request. Please try again." };
  }

  revalidatePath("/dashboard/requests");
  return {};
}

const updateSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  resolutionNote: z.string().optional().or(z.literal("")),
});

export async function updateHRRequestStatus(
  _prevState: HRRequestActionState,
  formData: FormData
): Promise<HRRequestActionState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = updateSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    resolutionNote: formData.get("resolutionNote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { requestId, status, resolutionNote } = parsed.data;

  try {
    const existing = await prisma.hRRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return { error: "Request not found." };
    }

    await prisma.hRRequest.update({
      where: { id: requestId },
      data: {
        status,
        assignedToId: status === "SUBMITTED" ? null : existing.assignedToId ?? session.user.id,
        resolutionNote: resolutionNote || existing.resolutionNote,
        resolvedAt: status === "RESOLVED" ? new Date() : existing.resolvedAt,
        closedAt: status === "CLOSED" ? new Date() : existing.closedAt,
      },
    });
  } catch (err) {
    console.error("updateHRRequestStatus failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/requests");
  return {};
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelHRRequest(
  _prevState: HRRequestActionState,
  formData: FormData
): Promise<HRRequestActionState> {
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
    const request = await prisma.hRRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!request || request.employeeId !== employee.id) {
      return { error: "Request not found." };
    }
    if (request.status === "CLOSED") {
      return { error: "This request is already closed." };
    }
    await prisma.hRRequest.update({
      where: { id: request.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  } catch (err) {
    console.error("cancelHRRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/requests");
  return {};
}
