import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";

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
        <h1 className="text-xl font-semibold">My documents</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">My documents</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Upload each required document below. HR reviews and approves them.
      </p>
      <ul className="mt-4 space-y-3">
        {employee.onboardingDocuments.map((d) => (
          <li key={d.id} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <div className="flex items-center justify-between">
              <span className="font-medium">{d.type.replaceAll("_", " ")}</span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                {d.status.replaceAll("_", " ")}
              </span>
            </div>
            {d.fileName && (
              <p className="mt-1 text-sm">
                <a
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {d.fileName}
                </a>
              </p>
            )}
            <div className="mt-2">
              <UploadDocumentForm documentId={d.id} />
            </div>
          </li>
        ))}
        {employee.onboardingDocuments.length === 0 && (
          <li className="text-sm text-black/50 dark:text-white/50">Nothing to upload yet.</li>
        )}
      </ul>
    </div>
  );
}
