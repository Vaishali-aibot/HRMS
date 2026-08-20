import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES } from "@/lib/rbac";

import { GiveRecognitionForm } from "./give-recognition-form";
import { RecognitionRow } from "./recognition-row";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function RecognitionPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const isHRWrite = HR_WRITE_ROLES.includes(session.user.role);
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });

  const [employeesForPicker, feed, leaderboardGroups] = await Promise.all([
    employee
      ? prisma.employee.findMany({
          where: { id: { not: employee.id } },
          orderBy: { fullName: "asc" },
          select: { id: true, employeeCode: true, fullName: true },
        })
      : prisma.employee.findMany({
          orderBy: { fullName: "asc" },
          select: { id: true, employeeCode: true, fullName: true },
        }),
    prisma.recognition.findMany({
      include: { fromEmployee: true, toEmployee: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.recognition.groupBy({
      by: ["toEmployeeId"],
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 10,
    }),
  ]);

  const leaderboardEmployees = leaderboardGroups.length
    ? await prisma.employee.findMany({
        where: { id: { in: leaderboardGroups.map((g) => g.toEmployeeId) } },
        select: { id: true, employeeCode: true, fullName: true },
      })
    : [];
  const leaderboard = leaderboardGroups.map((g) => ({
    employee: leaderboardEmployees.find((e) => e.id === g.toEmployeeId),
    totalPoints: g._sum.points ?? 0,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Recognition</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Give a teammate a shout-out. Visible to everyone — that&apos;s the
          point.
        </p>
      </div>

      {employee ? (
        <div>
          <h2 className="text-sm font-semibold">Give recognition</h2>
          <div className="mt-2">
            <GiveRecognitionForm employees={employeesForPicker} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      <div>
        <h2 className="text-sm font-semibold">Top recognized (all-time)</h2>
        <ol className="mt-2 space-y-1">
          {leaderboard.map((entry, i) => (
            <li key={entry.employee?.id ?? i} className="text-sm">
              <span className="text-black/50 dark:text-white/50">{i + 1}.</span>{" "}
              {entry.employee
                ? `${entry.employee.employeeCode} — ${entry.employee.fullName}`
                : "Unknown"}{" "}
              <span className="text-black/50 dark:text-white/50">
                — {entry.totalPoints} pts
              </span>
            </li>
          ))}
          {leaderboard.length === 0 && (
            <li className="text-sm text-black/50 dark:text-white/50">
              No recognition given yet.
            </li>
          )}
        </ol>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Recent recognition</h2>
        <ul className="mt-2 space-y-3">
          {feed.map((r) => (
            <RecognitionRow
              key={r.id}
              recognition={{
                id: r.id,
                fromName: r.fromEmployee.fullName,
                toName: r.toEmployee.fullName,
                category: r.category,
                points: r.points,
                message: r.message,
                createdAt: fmt(r.createdAt),
              }}
              canDelete={isHRWrite || r.fromEmployee.userId === session.user.id}
            />
          ))}
          {feed.length === 0 && (
            <li className="text-sm text-black/50 dark:text-white/50">Nothing yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
