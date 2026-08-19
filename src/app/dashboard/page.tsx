import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["HR_ADMIN", "HR_EXECUTIVE", "MANAGEMENT"] as const;

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
  const role = session!.user.role;

  if (!HR_ROLES.includes(role as (typeof HR_ROLES)[number])) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Welcome, {session!.user.name}</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Employee and manager self-service views (leave, attendance,
          documents, requests) land in a later phase — see the MVP roadmap.
        </p>
      </div>
    );
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, active, newJoiners, onProbation, onNotice, pendingOnboarding] =
    await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.employee.count({ where: { dateOfJoining: { gte: thirtyDaysAgo } } }),
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
