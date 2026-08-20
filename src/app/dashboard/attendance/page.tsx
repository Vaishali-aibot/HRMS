import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";
import { DATE_ONLY_PATTERN, todayUTCString } from "@/lib/date-only";

import { AttendanceRow } from "./attendance-row";
import { CorrectionRequestRow } from "./correction-request-row";
import { RequestCorrectionForm } from "./request-correction-form";
import { SelfMarkForm } from "./self-mark-form";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const role = session.user.role;
  const isHRView = HR_VIEW_ROLES.includes(role);
  const isHRWrite = HR_WRITE_ROLES.includes(role);
  const isManager = role === "MANAGER";
  const showManagementTable = isHRView || isManager;

  const ownEmployee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: { attendanceCorrectionRequests: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  // undefined = no filter (HR sees everyone); a manager only ever sees
  // their own direct reports, enforced here in the query, not just by the
  // UI happening not to show a link to anyone else's data.
  const employeeWhere = isHRView
    ? undefined
    : { reportingManagerId: ownEmployee?.id ?? "__none__" };

  let managementSection: React.ReactNode = null;
  if (showManagementTable) {
    const { date } = await searchParams;
    // `date` is an attacker-controllable query param — a malformed value
    // fed straight into `new Date()` would produce an Invalid Date that
    // crashes the Prisma query with no error boundary to catch it, so fall
    // back to today rather than trust it blindly.
    const selectedDateStr =
      date && DATE_ONLY_PATTERN.test(date) ? date : todayUTCString();
    // Same UTC-midnight convention as Employee.dateOfJoining.
    const selectedDate = new Date(selectedDateStr);

    const [employees, records, pendingCorrections] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        orderBy: { fullName: "asc" },
        select: { id: true, employeeCode: true, fullName: true },
      }),
      prisma.attendanceRecord.findMany({
        where: employeeWhere ? { date: selectedDate, employee: employeeWhere } : { date: selectedDate },
      }),
      prisma.attendanceCorrectionRequest.findMany({
        where: employeeWhere
          ? { status: "PENDING", employee: employeeWhere }
          : { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { employee: true },
      }),
    ]);
    const statusByEmployee = new Map(records.map((r) => [r.employeeId, r.status]));
    // Editable for HR_WRITE_ROLES on any row; for a plain MANAGER the
    // table above is already scoped to their own reports, so every row
    // shown to them is one they're allowed to edit.
    const canEditTable = isHRWrite || isManager;

    managementSection = (
      <>
        <div>
          <h2 className="text-sm font-semibold">
            {isHRView ? "All employees" : "My team"}
          </h2>
          <form method="get" className="mt-3 flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span>Date</span>
              <input
                type="date"
                name="date"
                defaultValue={selectedDateStr}
                className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              />
            </label>
            <button
              type="submit"
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Go
            </button>
          </form>

          {!canEditTable && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              Read-only — only HR Admin/HR Executive can mark attendance directly.
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left dark:bg-white/5">
                <tr>
                  <th className="px-4 py-2">Employee ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <AttendanceRow
                    key={e.id}
                    employee={e}
                    date={selectedDateStr}
                    currentStatus={statusByEmployee.get(e.id) ?? null}
                    editable={canEditTable}
                  />
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-black/50 dark:text-white/50"
                    >
                      {isHRView ? "No employees yet." : "No direct reports yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold">
            {isHRView ? "Pending correction requests" : "Team corrections awaiting your decision"}
          </h2>
          <ul className="mt-2 space-y-2">
            {pendingCorrections.map((r) => (
              <CorrectionRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  employeeName: r.employee.fullName,
                  date: fmt(r.date),
                  currentStatus: r.currentStatus,
                  requestedStatus: r.requestedStatus,
                  reason: r.reason,
                  status: r.status,
                }}
                showEmployeeName
                // Management can see these (dashboard-level visibility, PRD
                // §4.5) but only HR_ADMIN/HR_EXECUTIVE can decide org-wide
                // ones; a manager can always decide their own team's.
                canDecide={isManager || isHRWrite}
              />
            ))}
            {pendingCorrections.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing pending.</li>
            )}
          </ul>
        </div>
      </>
    );
  }

  let personalSection: React.ReactNode;
  if (!ownEmployee) {
    personalSection = (
      <p className="text-sm text-black/60 dark:text-white/60">
        Your account isn&apos;t linked to an employee record yet — contact HR.
      </p>
    );
  } else {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId: ownEmployee.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
    });
    const counts = records.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    personalSection = (
      <>
        <div>
          <h2 className="text-sm font-semibold">My attendance</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {now.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.entries(counts).map(([status, count]) => (
              <div key={status} className="rounded-xl border border-black/10 p-3 dark:border-white/15">
                <div className="text-lg font-semibold">{count}</div>
                <div className="text-xs text-black/60 dark:text-white/60">
                  {status.replaceAll("_", " ")}
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <p className="text-sm text-black/50 dark:text-white/50">
                No attendance marked yet this month.
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Check in for today</h2>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Only affects today. Won&apos;t override a status HR or your manager already set.
          </p>
          <div className="mt-2">
            <SelfMarkForm />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Request a correction</h2>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            For a past date. Your manager (or HR) will review it.
          </p>
          <div className="mt-2">
            <RequestCorrectionForm />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold">My correction requests</h2>
          <ul className="mt-2 space-y-2">
            {ownEmployee.attendanceCorrectionRequests.map((r) => (
              <CorrectionRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  date: fmt(r.date),
                  currentStatus: r.currentStatus,
                  requestedStatus: r.requestedStatus,
                  reason: r.reason,
                  status: r.status,
                }}
                canCancel
              />
            ))}
            {ownEmployee.attendanceCorrectionRequests.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">No requests yet.</li>
            )}
          </ul>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Attendance</h1>
      {managementSection}
      {personalSection}
    </div>
  );
}
