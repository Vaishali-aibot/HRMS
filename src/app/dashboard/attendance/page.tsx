import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";
import { DATE_ONLY_PATTERN, todayUTC, todayUTCString } from "@/lib/date-only";
import { iconForAttendanceStatus } from "@/lib/attendance-status-icon";

import { AttendanceRow } from "./attendance-row";
import { CheckedInAtLabel } from "./checked-in-at-label";
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
    const checkedInAtByEmployee = new Map(
      records.map((r) => [r.employeeId, r.checkedInAt?.toISOString() ?? null])
    );
    // Editable for HR_WRITE_ROLES on any row; for a plain MANAGER the
    // table above is already scoped to their own reports, so every row
    // shown to them is one they're allowed to edit.
    const canEditTable = isHRWrite || isManager;

    managementSection = (
      <>
        <Card>
          <CardHeader>
            <CardTitle>{isHRView ? "All employees" : "My team"}</CardTitle>
            {!canEditTable && (
              <CardDescription>
                Read-only — only HR Admin/HR Executive can mark attendance directly.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            <form method="get" className="flex items-center gap-2 px-4">
              <Input
                type="date"
                name="date"
                defaultValue={selectedDateStr}
                className="w-40"
              />
              <Button type="submit" variant="outline" size="sm">
                Go
              </Button>
            </form>

            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checked in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <AttendanceRow
                      key={e.id}
                      employee={e}
                      date={selectedDateStr}
                      currentStatus={statusByEmployee.get(e.id) ?? null}
                      checkedInAt={checkedInAtByEmployee.get(e.id) ?? null}
                      editable={canEditTable}
                    />
                  ))}
                  {employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        {isHRView ? "No employees yet." : "No direct reports yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isHRView ? "Pending correction requests" : "Team corrections awaiting your decision"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
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
                <p className="text-sm text-muted-foreground">Nothing pending.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </>
    );
  }

  let personalSection: React.ReactNode;
  if (!ownEmployee) {
    personalSection = (
      <p className="text-sm text-muted-foreground">
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
    const todayTime = todayUTC().getTime();
    const todayRecord = records.find((r) => r.date.getTime() === todayTime);

    personalSection = (
      <>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            My attendance —{" "}
            {now.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.entries(counts).map(([status, count]) => (
              <StatCard
                key={status}
                icon={iconForAttendanceStatus(status)}
                label={status.replaceAll("_", " ")}
                value={count}
              />
            ))}
            {records.length === 0 && (
              <p className="text-sm text-muted-foreground">No attendance marked yet this month.</p>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Check in for today</CardTitle>
            <CardDescription>
              Only affects today. Won&apos;t override a status HR or your manager already set.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <SelfMarkForm />
            {todayRecord?.checkedInAt && (
              <CheckedInAtLabel checkedInAt={todayRecord.checkedInAt.toISOString()} />
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Request a correction</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            For a past date. Your manager (or HR) will review it.
          </p>
          <div className="mt-2">
            <RequestCorrectionForm />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My correction requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
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
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
      {managementSection}
      {personalSection}
    </div>
  );
}
