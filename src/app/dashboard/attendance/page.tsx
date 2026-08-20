import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";

import { AttendanceRow } from "./attendance-row";

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const canView = HR_VIEW_ROLES.includes(session.user.role);
  const canEdit = HR_WRITE_ROLES.includes(session.user.role);

  if (canView) {
    const { date } = await searchParams;
    // `date` is an attacker-controllable query param — a malformed value
    // fed straight into `new Date()` would produce an Invalid Date that
    // crashes the Prisma query with no error boundary to catch it, so fall
    // back to today rather than trust it blindly.
    const selectedDateStr =
      date && DATE_ONLY_PATTERN.test(date) ? date : formatDateInput(new Date());
    // Same UTC-midnight convention as Employee.dateOfJoining — see the
    // comment on AttendanceRecord in prisma/schema.prisma.
    const selectedDate = new Date(selectedDateStr);

    const [employees, records] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { fullName: "asc" },
        select: { id: true, employeeCode: true, fullName: true },
      }),
      prisma.attendanceRecord.findMany({ where: { date: selectedDate } }),
    ]);
    const statusByEmployee = new Map(records.map((r) => [r.employeeId, r.status]));

    return (
      <div>
        <h1 className="text-xl font-semibold">Attendance</h1>
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

        {!canEdit && (
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Read-only — only HR Admin/HR Executive can mark attendance.
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
                  editable={canEdit}
                />
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                    No employees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Self-service: read-only summary for the signed-in person's own record.
  // No self-marking or correction-request flow yet — see README.
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: employee.id, date: { gte: monthStart, lte: monthEnd } },
    orderBy: { date: "asc" },
  });

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-xl font-semibold">My attendance</h1>
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
  );
}
