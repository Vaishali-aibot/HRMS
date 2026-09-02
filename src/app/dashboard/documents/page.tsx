import { redirect } from "next/navigation";
import { Paperclip } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: { onboardingDocuments: { orderBy: { type: "asc" } } },
  });

  if (!employee) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">My documents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload each required document below. HR reviews and approves them.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {employee.onboardingDocuments.map((d) => (
          <Card key={d.id} size="sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{d.type.replaceAll("_", " ")}</span>
                <StatusBadge status={d.status} />
              </div>
              {d.fileName && (
                <a
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Paperclip className="size-3.5" />
                  {d.fileName}
                </a>
              )}
              <UploadDocumentForm documentId={d.id} />
            </CardContent>
          </Card>
        ))}
        {employee.onboardingDocuments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing to upload yet.</p>
        )}
      </div>
    </div>
  );
}
