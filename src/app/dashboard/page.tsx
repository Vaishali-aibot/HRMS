import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES } from "@/lib/rbac";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-black/60 dark:text-white/60">{label}</div>
    </div>
  );
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
    const currentYear = new Date().getFullYear();
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      include: {
        leaveBalances: { where: { year: currentYear }, include: { leaveType: true } },
      },
    });

    return (
      <div>
        <h1 className="text-xl font-semibold">Welcome, {session.user.name}</h1>

        {employee ? (
          <>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {employee.employeeCode} · {employee.designation} · {employee.department}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {employee.leaveBalances.map((b) => (
                <StatCard
                  key={b.id}
                  label={`${b.leaveType.name} remaining`}
                  value={b.allocated - b.used}
                />
              ))}
            </div>
            <div className="mt-6 flex gap-3 text-sm">
              <Link
                href="/dashboard/leave"
                className="rounded-md bg-black px-3 py-1.5 font-medium text-white dark:bg-white dark:text-black"
              >
                Apply for leave
              </Link>
              <Link
                href="/dashboard/attendance"
                className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                My attendance
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Your account isn&apos;t linked to an employee record yet — contact
            HR to enable leave and attendance self-service.
          </p>
        )}

        <p className="mt-6 text-sm text-black/60 dark:text-white/60">
          Documents and HR requests self-service land in a later phase — see
          the MVP roadmap.
        </p>
      </div>
    );
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, active, newJoiners, onProbation, onNotice, pendingOnboarding] =
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
    ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">HR Dashboard</h1>
        <Link
          href="/dashboard/employees/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          + Add employee
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total employees" value={total} />
        <StatCard label="Active" value={active} />
        <StatCard label="New joiners (30d)" value={newJoiners} />
        <StatCard label="On probation" value={onProbation} />
        <StatCard label="Notice period" value={onNotice} />
        <StatCard label="Pending onboarding" value={pendingOnboarding} />
      </div>
    </div>
  );
}
