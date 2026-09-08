import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recognition</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Give a teammate a shout-out. Visible to everyone — that&apos;s the
          point.
        </p>
      </div>

      {employee ? (
        <Card>
          <CardHeader>
            <CardTitle>Give recognition</CardTitle>
          </CardHeader>
          <CardContent>
            <GiveRecognitionForm employees={employeesForPicker} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top recognized (all-time)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-1">
            {leaderboard.map((entry, i) => (
              <li key={entry.employee?.id ?? i} className="text-sm">
                <span className="text-muted-foreground">{i + 1}.</span>{" "}
                {entry.employee
                  ? `${entry.employee.employeeCode} — ${entry.employee.fullName}`
                  : "Unknown"}{" "}
                <span className="text-muted-foreground">— {entry.totalPoints} pts</span>
              </li>
            ))}
            {leaderboard.length === 0 && (
              <li className="text-sm text-muted-foreground">No recognition given yet.</li>
            )}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent recognition</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
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
              <li className="text-sm text-muted-foreground">Nothing yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
