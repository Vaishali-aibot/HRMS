import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";

import { HRRequestRow } from "./hr-request-row";
import { SubmitRequestForm } from "./submit-request-form";

function daysOpen(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
}

export default async function RequestsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  // Computed once, here in the Server Component render — not inside
  // HRRequestRow, where a fresh Date.now() on every re-render would be an
  // impure render (React/ESLint's react-hooks/purity rule).
  const now = new Date();

  const canView = HR_VIEW_ROLES.includes(session.user.role);
  const canManage = HR_WRITE_ROLES.includes(session.user.role);

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: { hrRequests: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  const openOrgRequests = canView
    ? await prisma.hRRequest.findMany({
        where: { status: { notIn: ["CLOSED"] } },
        orderBy: { createdAt: "asc" },
        include: { employee: true },
      })
    : [];

  const statusCounts = canView
    ? openOrgRequests.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">HR requests</h1>

      {canView && (
        <div>
          <h2 className="text-sm font-semibold">Open requests by status</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"].map((s) => (
              <div key={s} className="rounded-xl border border-black/10 p-3 dark:border-white/15">
                <div className="text-lg font-semibold">{statusCounts[s] ?? 0}</div>
                <div className="text-xs text-black/60 dark:text-white/60">{s}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {employee ? (
        <>
          <div>
            <h2 className="text-sm font-semibold">Submit a request</h2>
            <div className="mt-2">
              <SubmitRequestForm />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">My requests</h2>
            <ul className="mt-2 space-y-2">
              {employee.hrRequests.map((r) => (
                <HRRequestRow
                  key={r.id}
                  request={{
                    id: r.id,
                    category: r.category,
                    subject: r.subject,
                    description: r.description,
                    status: r.status,
                    resolutionNote: r.resolutionNote,
                    daysOpen: daysOpen(r.createdAt, now),
                  }}
                  canCancel
                />
              ))}
              {employee.hrRequests.length === 0 && (
                <li className="text-sm text-black/50 dark:text-white/50">No requests yet.</li>
              )}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      {canView && (
        <div>
          <h2 className="text-sm font-semibold">All open requests</h2>
          <ul className="mt-2 space-y-2">
            {openOrgRequests.map((r) => (
              <HRRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  employeeName: r.employee.fullName,
                  category: r.category,
                  subject: r.subject,
                  description: r.description,
                  status: r.status,
                  resolutionNote: r.resolutionNote,
                  daysOpen: daysOpen(r.createdAt, now),
                }}
                showEmployeeName
                canManage={canManage}
              />
            ))}
            {openOrgRequests.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing open.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
