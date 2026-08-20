"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";

export type UpdateChecklistState = { error?: string };

const documentStatusSchema = z.object({
  documentId: z.string().min(1),
  employeeId: z.string().min(1),
  status: z.enum([
    "NOT_SUBMITTED",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "RESUBMISSION_REQUIRED",
  ]),
});

export async function updateDocumentStatus(
  _prevState: UpdateChecklistState,
  formData: FormData
): Promise<UpdateChecklistState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = documentStatusSchema.safeParse({
    documentId: formData.get("documentId"),
    employeeId: formData.get("employeeId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.onboardingDocument.update({
      where: { id: parsed.data.documentId },
      data: { status: parsed.data.status },
    });
  } catch (err) {
    console.error("updateDocumentStatus failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  // No redirect — this is an inline edit on the employee detail page, and
  // Next re-renders the current route with fresh data after the action.
  revalidatePath(`/dashboard/employees/${parsed.data.employeeId}`);
  revalidatePath("/dashboard/onboarding");
  return {};
}

const itTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  employeeId: z.string().min(1),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
});

export async function updateITTaskStatus(
  _prevState: UpdateChecklistState,
  formData: FormData
): Promise<UpdateChecklistState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = itTaskStatusSchema.safeParse({
    taskId: formData.get("taskId"),
    employeeId: formData.get("employeeId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.iTOnboardingTask.update({
      where: { id: parsed.data.taskId },
      data: { status: parsed.data.status },
    });
  } catch (err) {
    console.error("updateITTaskStatus failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/dashboard/employees/${parsed.data.employeeId}`);
  revalidatePath("/dashboard/onboarding");
  return {};
}
