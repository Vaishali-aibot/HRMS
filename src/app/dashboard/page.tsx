import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  Hourglass,
  Plus,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { ResignationRequestRow } from "@/components/resignation-request-row";
import { UpcomingHolidaysCard } from "@/components/upcoming-holidays-card";
import { BirthdaysThisMonthCard } from "@/components/birthdays-this-month-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES } from "@/lib/rbac";
import { getRemainingForLeaveType } from "@/lib/leave-balance";
import { todayUTC } from "@/lib/date-only";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground">{children}</li>;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    // dashboard/layout.tsx already checked this, but session-strategy
    // sessions are re-fetched from the DB on every auth() call (not cached
    // between the layout and this page render), so re-check here rather
    // than asserting non-null.
    redirect("/sign-in");
  }
  const role = session.user.role;

  // Shown to everyone regardless of role, so fetched once here rather than
  // duplicated in both branches below.
  const upcomingHolidays = await prisma.holiday.findMany({
    where: { date: { gte: todayUTC() } },
    orderBy: { date: "asc" },
    take: 10,
  });

  if (!HR_VIEW_ROLES.includes(role)) {
    const [employee, leaveTypes] = await Promise.all([
      prisma.employee.findUnique({ where: { userId: session.user.id } }),
      prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);

    // Same pattern as the Leave page's applyLeaveTypes: go through
    // getRemainingForLeaveType (ensureLeaveBalance under the hood) instead
    // of reading employee.leaveBalances rows directly, so this stays
    // ratcheted up to date and actually includes monthlyCap types (WFH),
    // which have no LeaveBalance row at all.
    const leaveBalanceCards = employee
      ? await Promise.all(
          leaveTypes.map(async (lt) => {
            const remaining = await prisma.$transaction((tx) =>
              getRemainingForLeaveType(tx, employee.id, lt, todayUTC())
            );
            return {
              id: lt.id,
              label: `${lt.name} remaining${lt.monthlyCap != null ? " (this month)" : ""}`,
              remaining,
            };
          })
        )
      : [];

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {session.user.name}
          </h1>
          {employee && (
            <p className="mt-1 text-sm text-muted-foreground">
              {employee.employeeCode} · {employee.designation} · {employee.department}
            </p>
          )}
        </div>

        {employee ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {leaveBalanceCards.map((c) => (
                <StatCard key={c.id} icon={CalendarDays} label={c.label} value={c.remaining} />
              ))}
            </div>
            <div className="flex gap-3">
              <Button nativeButton={false} render={<Link href="/dashboard/leave" />}>
                <CalendarDays />
                Apply for leave
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/attendance" />}
              >
                <Clock />
                My attendance
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your account isn&apos;t linked to an employee record yet — contact
            HR to enable leave and attendance self-service.
          </p>
        )}

        <UpcomingHolidaysCard holidays={upcomingHolidays} />
      </div>
    );
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  // Same UTC-midnight month-bounds convention as the Attendance page.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const [
    total,
    active,
    newJoiners,
    onProbation,
    onNotice,
    pendingOnboarding,
    pendingResignations,
    onLeaveThisMonth,
    employeesWithBirthday,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.count({
      // Upper-bounded so pre-boarding employees with a future joining
      // date (a normal state per PRD §8) aren't counted as "new" yet.
      where: { dateOfJoining: { gte: thirtyDaysAgo, lte: now } },
    }),
    prisma.employee.count({ where: { status: "PROBATION" } }),
    prisma.employee.count({ where: { status: "NOTICE_PERIOD" } }),
    prisma.employee.count({
      where: { status: { in: ["PRE_BOARDING", "ONBOARDING"] } },
    }),
    prisma.resignationRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { employee: true },
    }),
    // Approved leave that overlaps this calendar month at all — not just
    // requests starting in it, so a leave spanning a month boundary still
    // shows up (e.g. started 3 days ago, still running today).
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      orderBy: { startDate: "asc" },
      include: {
        employee: { select: { id: true, employeeCode: true, fullName: true } },
        leaveType: { select: { name: true } },
      },
    }),
    // Prisma has no portable "match this month regardless of year" filter,
    // so fetch everyone with a DOB on file and filter/sort by month+day in
    // JS below — fine at HR-system scale, and avoids a raw SQL query for
    // one date-part comparison.
    prisma.employee.findMany({
      where: { dateOfBirth: { not: null } },
      select: { id: true, employeeCode: true, fullName: true, dateOfBirth: true },
    }),
  ]);

  // The `where` above already excludes nulls at the DB level, but Prisma's
  // return type doesn't narrow on that — filter with a type guard instead
  // of a non-null assertion so this stays sound if that ever changes.
  const birthdaysThisMonth = employeesWithBirthday
    .filter((e): e is typeof e & { dateOfBirth: Date } => e.dateOfBirth !== null)
    .filter((e) => e.dateOfBirth.getUTCMonth() === now.getUTCMonth())
    .sort((a, b) => a.dateOfBirth.getUTCDate() - b.dateOfBirth.getUTCDate());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HR Dashboard</h1>
          <p className="text-sm text-muted-foreground">Org-wide snapshot</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/employees/new" />}>
          <Plus />
          Add employee
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Users} label="Total employees" value={total} />
        <StatCard icon={UserCheck} label="Active" value={active} />
        <StatCard icon={UserPlus} label="New joiners (30d)" value={newJoiners} />
        <StatCard icon={Hourglass} label="On probation" value={onProbation} />
        <StatCard icon={CalendarClock} label="Notice period" value={onNotice} />
        <StatCard icon={ClipboardList} label="Pending onboarding" value={pendingOnboarding} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pending resignation requests</CardTitle>
            <CardDescription>Awaiting HR decision</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {pendingResignations.map((r) => (
                <ResignationRequestRow
                  key={r.id}
                  request={{
                    id: r.id,
                    employeeName: r.employee.fullName,
                    resignationDate: fmt(r.resignationDate),
                    noticePeriodDays: r.noticePeriodDays,
                    reason: r.reason,
                    status: r.status,
                  }}
                  showEmployeeName
                  canDecide
                />
              ))}
              {pendingResignations.length === 0 && <EmptyRow>Nothing pending.</EmptyRow>}
            </ul>
          </CardContent>
        </Card>

        <UpcomingHolidaysCard holidays={upcomingHolidays} />
        <BirthdaysThisMonthCard employees={birthdaysThisMonth} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>On leave this month</CardTitle>
          <CardDescription>
            {now.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
            {" · "}approved leave overlapping this month
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onLeaveThisMonth.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="font-medium">{r.employee.fullName}</span>
                      <div className="font-mono text-xs text-muted-foreground">
                        {r.employee.employeeCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.leaveType.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.startDate.getTime() === r.endDate.getTime()
                        ? fmt(r.startDate)
                        : `${fmt(r.startDate)} – ${fmt(r.endDate)}`}
                    </TableCell>
                  </TableRow>
                ))}
                {onLeaveThisMonth.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      No one is on approved leave this month.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
