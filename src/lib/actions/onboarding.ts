"use server";

import { revalidatePath } from "next/cache";
import { del, put } from "@vercel/blob";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole, requireSession } from "@/lib/rbac";
import { validateUploadedFile } from "@/lib/document-upload";

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

export type UploadDocumentState = { error?: string };

function extensionFor(fileName: string, contentType: string): string {
  const fromName = fileName.split(".").pop();
  if (fromName && fromName.length <= 5 && fromName !== fileName) {
    return fromName.toLowerCase();
  }
  const byType: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byType[contentType] ?? "bin";
}

export async function uploadOnboardingDocument(
  _prevState: UploadDocumentState,
  formData: FormData
): Promise<UploadDocumentState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const documentId = formData.get("documentId");
  const file = formData.get("file");
  if (typeof documentId !== "string" || !documentId) {
    return { error: "Invalid request." };
  }
  if (!(file instanceof File)) {
    return { error: "Please choose a file." };
  }

  const fileError = validateUploadedFile(file);
  if (fileError) {
    return { error: fileError };
  }

  try {
    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
      include: { employee: { select: { id: true, userId: true } } },
    });
    if (!document) {
      return { error: "Document checklist item not found." };
    }

    // Either the employee uploading their own document, or HR uploading
    // on their behalf.
    const isOwnDocument = document.employee.userId === session.user.id;
    const isHR = HR_WRITE_ROLES.includes(session.user.role);
    if (!isOwnDocument && !isHR) {
      return { error: "You do not have permission to upload this document." };
    }

    const extension = extensionFor(file.name, file.type);
    const pathname = `onboarding-documents/${document.employeeId}/${document.type.toLowerCase()}.${extension}`;

    // Private access — these can be PAN/Aadhaar/bank proof. The returned
    // pathname is only ever readable through our own authenticated route
    // (src/app/api/documents/[documentId]/route.ts), never a public URL.
    const uploaded = await put(pathname, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: true,
    });

    const previousPathname = document.blobPathname;

    // Re-uploading (e.g. after RESUBMISSION_REQUIRED, or just replacing a
    // mistaken upload) always resets to SUBMITTED — an approval against a
    // file that no longer exists shouldn't silently stay valid.
    await prisma.onboardingDocument.update({
      where: { id: documentId },
      data: {
        blobPathname: uploaded.pathname,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        uploadedById: session.user.id,
        uploadedAt: new Date(),
        status: "SUBMITTED",
      },
    });

    if (previousPathname) {
      // Best-effort cleanup of the file this upload replaced — failing to
      // delete it is a storage-cost nit, not worth failing the upload over.
      try {
        await del(previousPathname);
      } catch (cleanupErr) {
        console.error("Failed to delete replaced onboarding document blob:", cleanupErr);
      }
    }
  } catch (err) {
    console.error("uploadOnboardingDocument failed:", err);
    return { error: "Something went wrong while uploading. Please try again." };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/onboarding");
  return {};
}
