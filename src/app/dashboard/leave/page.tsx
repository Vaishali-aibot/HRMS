import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";

import { ApplyLeaveForm } from "./apply-leave-form";
import { LeaveRequestRow } from "./leave-request-row";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function LeavePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const currentYear = new Date().getFullYear();

  const [employee, leaveTypes] = await Promise.all([
    prisma.employee.findUnique({
      where: { userId: session.user.id },
      include: {
        leaveBalances: { where: { year: currentYear }, include: { leaveType: true } },
        leaveRequests: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { leaveType: true },
        },
      },
    }),
    prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const canViewOrgWide = HR_VIEW_ROLES.includes(session.user.role);
  const canDecideAnyRequest = HR_WRITE_ROLES.includes(session.user.role);
  const isManager = session.user.role === "MANAGER";

  const [teamRequests, orgRequests] = await Promise.all([
    isManager && employee
      ? prisma.leaveRequest.findMany({
          where: { status: "PENDING", employee: { reportingManagerId: employee.id } },
          orderBy: { createdAt: "asc" },
          include: { employee: true, leaveType: true },
        })
      : Promise.resolve([]),
    canViewOrgWide
      ? prisma.leaveRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          include: { employee: true, leaveType: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Leave</h1>

      {employee ? (
        <>
          <div>
            <h2 className="text-sm font-semibold">My balance ({currentYear})</h2>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {employee.leaveBalances.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-black/10 p-3 dark:border-white/15"
                >
                  <div className="text-lg font-semibold">{b.allocated - b.used}</div>
                  <div className="text-xs text-black/60 dark:text-white/60">
                    {b.leaveType.name} remaining
                  </div>
                </div>
              ))}
              {employee.leaveBalances.length === 0 && (
                <p className="text-sm text-black/50 dark:text-white/50">
                  No balance yet for this year.
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Apply for leave</h2>
            <div className="mt-2">
              <ApplyLeaveForm leaveTypes={leaveTypes} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">My requests</h2>
            <ul className="mt-2 space-y-2">
              {employee.leaveRequests.map((r) => (
                <LeaveRequestRow
                  key={r.id}
                  request={{
                    id: r.id,
                    leaveTypeName: r.leaveType.name,
                    startDate: fmt(r.startDate),
                    endDate: fmt(r.endDate),
                    days: r.days,
                    reason: r.reason,
                    status: r.status,
                  }}
                  canCancel
                />
              ))}
              {employee.leaveRequests.length === 0 && (
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

      {isManager && (
        <div>
          <h2 className="text-sm font-semibold">Team requests awaiting your decision</h2>
          <ul className="mt-2 space-y-2">
            {teamRequests.map((r) => (
              <LeaveRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  employeeName: r.employee.fullName,
                  leaveTypeName: r.leaveType.name,
                  startDate: fmt(r.startDate),
                  endDate: fmt(r.endDate),
                  days: r.days,
                  reason: r.reason,
                  status: r.status,
                }}
                showEmployeeName
                canDecide
              />
            ))}
            {teamRequests.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing pending.</li>
            )}
          </ul>
        </div>
      )}

      {canViewOrgWide && (
        <div>
          <h2 className="text-sm font-semibold">All pending requests</h2>
          <ul className="mt-2 space-y-2">
            {orgRequests.map((r) => (
              <LeaveRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  employeeName: r.employee.fullName,
                  leaveTypeName: r.leaveType.name,
                  startDate: fmt(r.startDate),
                  endDate: fmt(r.endDate),
                  days: r.days,
                  reason: r.reason,
                  status: r.status,
                }}
                showEmployeeName
                // Management can see org-wide pending requests (PRD §4.5 —
                // dashboard-level visibility) but only HR_ADMIN/HR_EXECUTIVE
                // can actually decide them.
                canDecide={canDecideAnyRequest}
              />
            ))}
            {orgRequests.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing pending.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
