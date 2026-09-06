import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { HorizontalBarList } from "@/components/horizontal-bar-list";
import { ExitsTrendChart } from "@/components/exits-trend-chart";
import { iconForAttendanceStatus } from "@/lib/attendance-status-icon";

import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, requireRoleForPage } from "@/lib/rbac";
import { computeAccruedBase } from "@/lib/leave-balance";

// Pure reporting — every number here is a read-only aggregate over
// existing models. No new schema, no Server Actions; PRD §27–§28's "report
// views" and "management analytics dashboard" collapsed into one page
// since nothing here needs its own workflow.

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export default async function ReportsPage() {
  await requireRoleForPage(...HR_VIEW_ROLES);

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const twelveMonthsAgoStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [
    headcountByDept,
    headcountByStatus,
    exitedEmployees,
    leaveGroups,
    leaveTypes,
    attendanceGroups,
    reviewGroups,
    cycles,
    recognitionGroups,
    resolvedRequests,
    requestsByCategory,
  ] = await Promise.all([
    prisma.employee.groupBy({ by: ["department"], _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.employee.findMany({
      where: { status: { in: ["EXITED", "ALUMNI"] }, lastWorkingDay: { not: null } },
      select: { dateOfJoining: true, lastWorkingDay: true },
    }),
    prisma.leaveBalance.groupBy({
      by: ["leaveTypeId"],
      where: { year: currentYear },
      _sum: { used: true, encashed: true },
      _count: { _all: true },
    }),
    prisma.leaveType.findMany({
      select: { id: true, name: true, annualDays: true, accrualMethod: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { date: { gte: startOfMonth, lt: startOfNextMonth } },
      _count: { _all: true },
    }),
    prisma.performanceReview.groupBy({
      by: ["cycleId"],
      where: { status: "COMPLETED" },
      _avg: { managerOverallRating: true },
      _count: { _all: true },
    }),
    prisma.performanceCycle.findMany({ select: { id: true, name: true } }),
    prisma.recognition.groupBy({ by: ["category"], _count: { _all: true }, _sum: { points: true } }),
    prisma.hRRequest.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.hRRequest.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);

  const totalHeadcount = headcountByDept.reduce((sum, g) => sum + g._count._all, 0);

  // Exit trend, last 12 months — Prisma's groupBy can't truncate a date to
  // a month, so this buckets the (small) exited-employee set in JS.
  const exitBuckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(twelveMonthsAgoStart.getUTCFullYear(), twelveMonthsAgoStart.getUTCMonth() + i, 1));
    exitBuckets.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, 0);
  }
  for (const e of exitedEmployees) {
    const lwd = e.lastWorkingDay!;
    if (lwd >= twelveMonthsAgoStart) {
      const key = `${lwd.getUTCFullYear()}-${lwd.getUTCMonth()}`;
      if (exitBuckets.has(key)) {
        exitBuckets.set(key, (exitBuckets.get(key) ?? 0) + 1);
      }
    }
  }
  const exitTrend = Array.from(exitBuckets.entries()).map(([key, count]) => {
    const [year, month] = key.split("-").map(Number);
    return { label: monthLabel(year, month).split(" ")[0], count };
  });
  const avgTenureDays =
    exitedEmployees.length > 0
      ? Math.round(
          exitedEmployees.reduce((sum, e) => sum + daysBetween(e.dateOfJoining, e.lastWorkingDay!), 0) /
            exitedEmployees.length
        )
      : null;

  const leaveTypeById = new Map(leaveTypes.map((t) => [t.id, t]));
  // `allocated` here is recomputed from each leave type's accrual formula
  // times its LeaveBalance-row headcount, not summed from the (potentially
  // stale) LeaveBalance.allocated column — a row only gets ratcheted up
  // by ensureLeaveBalance when someone actually reads/applies for that
  // balance, so a straight SUM(allocated) can lag behind what every row
  // "should" be as of today. This is accurate for every leave type
  // currently in this app because carryForwardLimit is 0 everywhere (see
  // computeAccruedBase's docstring in src/lib/leave-balance.ts) — it would
  // understate accrual for a type with actual carried-forward days, since
  // that requires a per-employee lookup this aggregate deliberately avoids
  // (an N+1 query across every employee, once per report view).
  const leaveUtilization = leaveGroups.map((g) => {
    const leaveType = leaveTypeById.get(g.leaveTypeId);
    const allocated = leaveType ? g._count._all * computeAccruedBase(leaveType, currentYear) : 0;
    const used = g._sum.used ?? 0;
    const encashed = g._sum.encashed ?? 0;
    return {
      name: leaveType?.name ?? "Unknown",
      allocated,
      used,
      encashed,
      utilizationPct: allocated > 0 ? Math.round(((used + encashed) / allocated) * 100) : 0,
    };
  });

  const cycleNameById = new Map(cycles.map((c) => [c.id, c.name]));
  const performanceByCycle = reviewGroups.map((g) => ({
    cycleName: cycleNameById.get(g.cycleId) ?? "Unknown",
    avgRating: g._avg.managerOverallRating,
    count: g._count._all,
  }));

  const recognitionSummary = recognitionGroups
    .map((g) => ({
      category: g.category,
      count: g._count._all,
      points: g._sum.points ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
  const totalRecognitions = recognitionSummary.reduce((sum, r) => sum + r.count, 0);

  const avgResolutionDays =
    resolvedRequests.length > 0
      ? Math.round(
          (resolvedRequests.reduce((sum, r) => sum + daysBetween(r.createdAt, r.resolvedAt!), 0) /
            resolvedRequests.length) *
            10
        ) / 10
      : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports &amp; analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PRD §27–§28. Read-only aggregates across every module — nothing
          here is editable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Headcount by department</CardTitle>
            <CardDescription>Total: {totalHeadcount}</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarList
              items={headcountByDept.map((g) => ({ label: g.department, value: g._count._all }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Headcount by lifecycle status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {headcountByStatus.map((g) => (
              <div key={g.status} className="flex items-center justify-between text-sm">
                <StatusBadge status={g.status} />
                <span className="tabular-nums text-muted-foreground">{g._count._all}</span>
              </div>
            ))}
            {headcountByStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No employees yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exits, last 12 months</CardTitle>
          <CardDescription>
            Average tenure at exit (all-time):{" "}
            {avgTenureDays !== null
              ? `${avgTenureDays} days (~${Math.round(avgTenureDays / 30)} months)`
              : "no exits yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExitsTrendChart data={exitTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave utilization ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Encashed</TableHead>
                <TableHead>Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveUtilization.map((l) => (
                <TableRow key={l.name}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.allocated}</TableCell>
                  <TableCell className="text-muted-foreground">{l.used}</TableCell>
                  <TableCell className="text-muted-foreground">{l.encashed}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={l.utilizationPct} className="w-20" />
                      <span className="w-9 tabular-nums text-muted-foreground">
                        {l.utilizationPct}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {leaveUtilization.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No leave balances for {currentYear} yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance this month</CardTitle>
          <CardDescription>{monthLabel(now.getUTCFullYear(), now.getUTCMonth())}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {attendanceGroups.map((g) => (
              <StatCard
                key={g.status}
                icon={iconForAttendanceStatus(g.status)}
                label={g.status.replaceAll("_", " ")}
                value={g._count._all}
              />
            ))}
            {attendanceGroups.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No attendance marked yet this month.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance ratings by cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarList
              max={5}
              items={performanceByCycle.map((p) => ({
                label: p.cycleName,
                value: p.avgRating ?? 0,
                displayValue: `${p.avgRating?.toFixed(1) ?? "—"}/5`,
              }))}
            />
            {performanceByCycle.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {performanceByCycle.reduce((sum, p) => sum + p.count, 0)} completed review(s)
                total.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recognition by category</CardTitle>
            <CardDescription>Total recognitions: {totalRecognitions}</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarList
              items={recognitionSummary.map((r) => ({
                label: r.category.replaceAll("_", " "),
                value: r.count,
                displayValue: `${r.count} (${r.points} pts)`,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HR helpdesk</CardTitle>
          <CardDescription>
            Average time to resolution:{" "}
            {avgResolutionDays !== null ? `${avgResolutionDays} days` : "no resolved requests yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HorizontalBarList
            items={requestsByCategory.map((r) => ({
              label: r.category.replaceAll("_", " "),
              value: r._count._all,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
