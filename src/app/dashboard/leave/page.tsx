import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { CalendarDays, Home as HomeIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";
import { getRemainingForLeaveType, quarterLabel } from "@/lib/leave-balance";
import { todayUTC } from "@/lib/date-only";

import { ApplyLeaveForm, type ApplyLeaveType } from "./apply-leave-form";
import { LeaveRequestRow } from "./leave-request-row";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

// Icon per leave type name — falls back to CalendarDays for anything HR
// adds later that isn't Earned/Sick (combined into one tile below) or WFH.
function iconFor(name: string) {
  if (name === "WFH") return HomeIcon;
  return CalendarDays;
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

  // Same lazy-seed-on-read philosophy as ensureLeaveBalance's own docstring
  // describes ("wherever a balance is read/consumed") — this keeps the
  // displayed number ratcheted up to date rather than showing whatever a
  // LeaveBalance row happened to be left at, or 0 for a type an employee
  // has never touched yet. Monthly-capped types (WFH) have no LeaveBalance
  // row at all — "remaining" is computed fresh from approved requests in
  // the current month instead (see getMonthlyCapRemaining).
  const applyLeaveTypes: ApplyLeaveType[] = employee
    ? await Promise.all(
        leaveTypes.map(async (lt): Promise<ApplyLeaveType> => {
          const remaining = await prisma.$transaction((tx) =>
            getRemainingForLeaveType(tx, employee.id, lt, todayUTC())
          );
          return {
            id: lt.id,
            name: lt.name,
            remaining,
            isMonthlyCap: lt.monthlyCap != null,
            reasonRequired: lt.marksAttendanceAsWFH,
          };
        })
      )
    : leaveTypes.map((lt) => ({
        id: lt.id,
        name: lt.name,
        remaining: 0,
        isMonthlyCap: lt.monthlyCap != null,
        reasonRequired: lt.marksAttendanceAsWFH,
      }));

  // Earned Leave + Sick Leave are shown as one combined balance in the UI
  // (they're still separate LeaveTypes underneath — separate application/
  // approval/reporting — this is purely a "My balance" display choice).
  const earnedType = leaveTypes.find((lt) => lt.name === "Earned Leave");
  const sickType = leaveTypes.find((lt) => lt.name === "Sick Leave");
  const combinedQuarterlyRate = ((earnedType?.annualDays ?? 0) + (sickType?.annualDays ?? 0)) / 4;
  const combinedRemaining = applyLeaveTypes
    .filter((lt) => lt.name === "Earned Leave" || lt.name === "Sick Leave")
    .reduce((sum, lt) => sum + lt.remaining, 0);
  const otherLeaveTypes = applyLeaveTypes.filter(
    (lt) => lt.name !== "Earned Leave" && lt.name !== "Sick Leave"
  );

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
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>

      {employee ? (
        <>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">
              My balance ({currentYear})
            </h2>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(earnedType || sickType) && (
                <StatCard
                  icon={CalendarDays}
                  label="Earned + Sick Leave remaining"
                  value={combinedRemaining}
                  hint={`Quarterly · ${combinedQuarterlyRate} days added for ${quarterLabel(todayUTC())}`}
                />
              )}
              {otherLeaveTypes.map((lt) => (
                <StatCard
                  key={lt.id}
                  icon={iconFor(lt.name)}
                  label={`${lt.name} remaining${lt.isMonthlyCap ? " (this month)" : ""}`}
                  value={lt.remaining}
                />
              ))}
              {applyLeaveTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">No balance yet for this year.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Apply for leave</h2>
            <div className="mt-2">
              <ApplyLeaveForm leaveTypes={applyLeaveTypes} />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My requests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
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
                  <p className="text-sm text-muted-foreground">No requests yet.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Team requests awaiting your decision</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
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
                <p className="text-sm text-muted-foreground">Nothing pending.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {canViewOrgWide && (
        <Card>
          <CardHeader>
            <CardTitle>All pending requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
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
                <p className="text-sm text-muted-foreground">Nothing pending.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
