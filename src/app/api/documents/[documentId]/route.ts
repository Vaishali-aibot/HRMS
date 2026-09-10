import { get } from "@vercel/blob";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES } from "@/lib/rbac";

/**
 * Streams an onboarding document's file back to an authorized viewer.
 *
 * This is the ONLY way to read an uploaded document — files are stored in
 * Vercel Blob with `access: "private"` (see uploadOnboardingDocument),
 * specifically because these can be PAN/Aadhaar/bank proof (PRD §7/§30
 * restricted fields). Never expose blobPathname/url to the client directly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { documentId } = await params;
  const document = await prisma.onboardingDocument.findUnique({
    where: { id: documentId },
    include: { employee: { select: { userId: true } } },
  });

  if (!document || !document.blobPathname) {
    return new Response("Not found", { status: 404 });
  }

  // Same rule as uploading: the document's own employee, or HR. Deliberately
  // NOT MANAGEMENT/MANAGER — these can be restricted identity/bank documents.
  const isOwnDocument = document.employee.userId === session.user.id;
  const isHR = HR_WRITE_ROLES.includes(session.user.role);
  if (!isOwnDocument && !isHR) {
    return new Response("Forbidden", { status: 403 });
  }

  const blob = await get(document.blobPathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return new Response("File not found in storage", { status: 404 });
  }

  // Best-effort: a logging failure shouldn't block an otherwise-authorized
  // view of the document.
  try {
    await prisma.documentAccessLog.create({
      data: { documentId: document.id, action: "VIEWED", actorId: session.user.id },
    });
  } catch (err) {
    console.error("Failed to record document access log:", err);
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType,
      "Content-Disposition": `inline; filename="${(document.fileName ?? "document").replaceAll('"', "")}"`,
      "Content-Length": String(blob.blob.size),
      // These can be PAN/Aadhaar/bank proof — never let a browser or
      // intermediary cache them to disk.
      "Cache-Control": "no-store, private",
    },
  });
}
