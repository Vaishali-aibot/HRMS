import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, requireRoleForPage } from "@/lib/rbac";

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
      _sum: { allocated: true, used: true },
    }),
    prisma.leaveType.findMany({ select: { id: true, name: true } }),
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
    return { label: monthLabel(year, month), count };
  });
  const avgTenureDays =
    exitedEmployees.length > 0
      ? Math.round(
          exitedEmployees.reduce((sum, e) => sum + daysBetween(e.dateOfJoining, e.lastWorkingDay!), 0) /
            exitedEmployees.length
        )
      : null;

  const leaveTypeNameById = new Map(leaveTypes.map((t) => [t.id, t.name]));
  const leaveUtilization = leaveGroups.map((g) => {
    const allocated = g._sum.allocated ?? 0;
    const used = g._sum.used ?? 0;
    return {
      name: leaveTypeNameById.get(g.leaveTypeId) ?? "Unknown",
      allocated,
      used,
      utilizationPct: allocated > 0 ? Math.round((used / allocated) * 100) : 0,
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
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Reports &amp; analytics</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          PRD §27–§28. Read-only aggregates across every module — nothing
          here is editable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-semibold">Headcount by department</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {headcountByDept.map((g) => (
              <li key={g.department} className="flex justify-between">
                <span>{g.department}</span>
                <span className="text-black/60 dark:text-white/60">{g._count._all}</span>
              </li>
            ))}
            {headcountByDept.length === 0 && (
              <li className="text-black/50 dark:text-white/50">No employees yet.</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Total: {totalHeadcount}
          </p>
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-semibold">Headcount by lifecycle status</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {headcountByStatus.map((g) => (
              <li key={g.status} className="flex justify-between">
                <span>{g.status.replaceAll("_", " ")}</span>
                <span className="text-black/60 dark:text-white/60">{g._count._all}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">Exits, last 12 months</h2>
        <div className="mt-2 flex items-end gap-2 overflow-x-auto pb-2">
          {exitTrend.map((m) => (
            <div key={m.label} className="flex flex-col items-center gap-1">
              <div
                className="w-6 rounded-t bg-black/20 dark:bg-white/25"
                style={{ height: `${8 + m.count * 12}px` }}
                title={`${m.label}: ${m.count}`}
              />
              <span className="text-[10px] text-black/50 dark:text-white/50">
                {m.label.split(" ")[0]}
              </span>
              <span className="text-[10px] font-medium">{m.count}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          Average tenure at exit (all-time):{" "}
          {avgTenureDays !== null ? `${avgTenureDays} days (~${Math.round(avgTenureDays / 30)} months)` : "no exits yet"}
        </p>
      </div>

      <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">Leave utilization ({currentYear})</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-black/50 dark:text-white/50">
              <tr>
                <th className="py-1">Type</th>
                <th className="py-1">Allocated</th>
                <th className="py-1">Used</th>
                <th className="py-1">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {leaveUtilization.map((l) => (
                <tr key={l.name} className="border-t border-black/10 dark:border-white/10">
                  <td className="py-1">{l.name}</td>
                  <td className="py-1">{l.allocated}</td>
                  <td className="py-1">{l.used}</td>
                  <td className="py-1">{l.utilizationPct}%</td>
                </tr>
              ))}
              {leaveUtilization.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-black/50 dark:text-white/50">
                    No leave balances for {currentYear} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">
          Attendance this month ({monthLabel(now.getUTCFullYear(), now.getUTCMonth())})
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {attendanceGroups.map((g) => (
            <li
              key={g.status}
              className="rounded-lg bg-black/5 px-3 py-2 dark:bg-white/10"
            >
              <div className="text-lg font-semibold">{g._count._all}</div>
              <div className="text-xs text-black/60 dark:text-white/60">
                {g.status.replaceAll("_", " ")}
              </div>
            </li>
          ))}
          {attendanceGroups.length === 0 && (
            <li className="col-span-full text-sm text-black/50 dark:text-white/50">
              No attendance marked yet this month.
            </li>
          )}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-semibold">Performance ratings by cycle</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {performanceByCycle.map((p) => (
              <li key={p.cycleName} className="flex justify-between">
                <span>{p.cycleName}</span>
                <span className="text-black/60 dark:text-white/60">
                  {p.avgRating?.toFixed(1) ?? "—"}/5 ({p.count} completed)
                </span>
              </li>
            ))}
            {performanceByCycle.length === 0 && (
              <li className="text-black/50 dark:text-white/50">No completed reviews yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-semibold">Recognition by category</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {recognitionSummary.map((r) => (
              <li key={r.category} className="flex justify-between">
                <span>{r.category.replaceAll("_", " ")}</span>
                <span className="text-black/60 dark:text-white/60">
                  {r.count} ({r.points} pts)
                </span>
              </li>
            ))}
            {recognitionSummary.length === 0 && (
              <li className="text-black/50 dark:text-white/50">None given yet.</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Total recognitions: {totalRecognitions}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">HR helpdesk</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {requestsByCategory.map((r) => (
            <li key={r.category} className="flex justify-between">
              <span>{r.category.replaceAll("_", " ")}</span>
              <span className="text-black/60 dark:text-white/60">{r._count._all}</span>
            </li>
          ))}
          {requestsByCategory.length === 0 && (
            <li className="text-black/50 dark:text-white/50">No requests yet.</li>
          )}
        </ul>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          Average time to resolution:{" "}
          {avgResolutionDays !== null ? `${avgResolutionDays} days` : "no resolved requests yet"}
        </p>
      </div>
    </div>
  );
}
