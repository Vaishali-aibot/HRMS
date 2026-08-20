import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES } from "@/lib/rbac";

import { CreatePIPForm } from "./create-pip-form";
import { PIPRow } from "./pip-row";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function PIPPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const isHRWrite = HR_WRITE_ROLES.includes(session.user.role);
  const isManager = session.user.role === "MANAGER";

  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });

  const [managedPips, myPips, employeesForPicker] = await Promise.all([
    isHRWrite
      ? prisma.performanceImprovementPlan.findMany({
          include: { employee: true, checkIns: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "desc" },
        })
      : isManager && employee
        ? prisma.performanceImprovementPlan.findMany({
            where: { employee: { reportingManagerId: employee.id } },
            include: { employee: true, checkIns: { orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    employee
      ? prisma.performanceImprovementPlan.findMany({
          where: { employeeId: employee.id },
          include: { checkIns: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    isHRWrite
      ? prisma.employee.findMany({ orderBy: { fullName: "asc" }, select: { id: true, employeeCode: true, fullName: true } })
      : isManager && employee
        ? prisma.employee.findMany({
            where: { reportingManagerId: employee.id },
            orderBy: { fullName: "asc" },
            select: { id: true, employeeCode: true, fullName: true },
          })
        : Promise.resolve([]),
  ]);

  const canManage = isHRWrite || isManager;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Performance improvement plans</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Independent of review cycles — a PIP can be started at any time by
          HR or an employee&apos;s reporting manager.
        </p>
      </div>

      {canManage && (
        <>
          <div>
            <h2 className="text-sm font-semibold">Start a PIP</h2>
            <div className="mt-2">
              <CreatePIPForm employees={employeesForPicker} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">
              {isHRWrite ? "All PIPs" : "Your reports' PIPs"}
            </h2>
            <ul className="mt-2 space-y-3">
              {managedPips.map((p) => (
                <PIPRow
                  key={p.id}
                  pip={{
                    id: p.id,
                    employeeName: p.employee.fullName,
                    reason: p.reason,
                    goals: p.goals,
                    startDate: fmt(p.startDate),
                    endDate: fmt(p.endDate),
                    status: p.status,
                    outcomeNotes: p.outcomeNotes,
                    checkIns: p.checkIns.map((c) => ({
                      id: c.id,
                      note: c.note,
                      createdAt: fmt(c.createdAt),
                    })),
                  }}
                  canManage
                />
              ))}
              {managedPips.length === 0 && (
                <li className="text-sm text-black/50 dark:text-white/50">None yet.</li>
              )}
            </ul>
          </div>
        </>
      )}

      {employee && (
        <div>
          <h2 className="text-sm font-semibold">My PIPs</h2>
          <ul className="mt-2 space-y-3">
            {myPips.map((p) => (
              <PIPRow
                key={p.id}
                pip={{
                  id: p.id,
                  reason: p.reason,
                  goals: p.goals,
                  startDate: fmt(p.startDate),
                  endDate: fmt(p.endDate),
                  status: p.status,
                  outcomeNotes: p.outcomeNotes,
                  checkIns: p.checkIns.map((c) => ({
                    id: c.id,
                    note: c.note,
                    createdAt: fmt(c.createdAt),
                  })),
                }}
                canManage={false}
              />
            ))}
            {myPips.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">None — good news.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
