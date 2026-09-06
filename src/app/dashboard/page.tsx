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
import { StatCard } from "@/components/stat-card";
import { ResignationRequestRow } from "@/components/resignation-request-row";
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
      </div>
    );
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, active, newJoiners, onProbation, onNotice, pendingOnboarding, pendingResignations] =
    await Promise.all([
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
    ]);

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
    </div>
  );
}
