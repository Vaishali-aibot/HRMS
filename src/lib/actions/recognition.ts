"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";

export type RecognitionActionState = { error?: string };

const CATEGORIES = [
  "TEAMWORK",
  "INNOVATION",
  "CUSTOMER_FOCUS",
  "LEADERSHIP",
  "GOING_ABOVE_AND_BEYOND",
  "OTHER",
] as const;

const giveSchema = z.object({
  toEmployeeId: z.string().min(1, "Recipient is required"),
  category: z.enum(CATEGORIES),
  points: z.coerce.number().int().min(1).max(100),
  message: z.string().min(1, "Message is required"),
});

export async function giveRecognition(
  _prevState: RecognitionActionState,
  formData: FormData
): Promise<RecognitionActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = giveSchema.safeParse({
    toEmployeeId: formData.get("toEmployeeId"),
    category: formData.get("category"),
    points: formData.get("points"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { toEmployeeId, category, points, message } = parsed.data;

  try {
    const fromEmployee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!fromEmployee) {
      return { error: "Your account isn't linked to an employee record yet — contact HR." };
    }
    if (fromEmployee.id === toEmployeeId) {
      return { error: "You can't recognize yourself." };
    }
    const toEmployee = await prisma.employee.findUnique({ where: { id: toEmployeeId } });
    if (!toEmployee) {
      return { error: "Recipient not found." };
    }

    await prisma.recognition.create({
      data: { fromEmployeeId: fromEmployee.id, toEmployeeId, category, points, message },
    });
  } catch (err) {
    console.error("giveRecognition failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/recognition");
  return {};
}

const deleteSchema = z.object({ recognitionId: z.string().min(1) });

/** The giver can retract their own post, or HR can moderate anyone's. */
export async function deleteRecognition(
  _prevState: RecognitionActionState,
  formData: FormData
): Promise<RecognitionActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = deleteSchema.safeParse({ recognitionId: formData.get("recognitionId") });
  if (!parsed.success) {
    return { error: "Invalid request." };
  }

  try {
    const recognition = await prisma.recognition.findUnique({
      where: { id: parsed.data.recognitionId },
      include: { fromEmployee: true },
    });
    if (!recognition) {
      return { error: "Not found." };
    }
    const isHR = HR_WRITE_ROLES.includes(session.user.role);
    const isGiver = recognition.fromEmployee.userId === session.user.id;
    if (!isHR && !isGiver) {
      return { error: "You do not have permission to remove this." };
    }
    await prisma.recognition.delete({ where: { id: recognition.id } });
  } catch (err) {
    console.error("deleteRecognition failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/recognition");
  return {};
}
