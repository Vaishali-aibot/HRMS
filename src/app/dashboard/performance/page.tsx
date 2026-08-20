import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";

import { AddGoalForm } from "./add-goal-form";
import { CreateCycleForm } from "./create-cycle-form";
import { CycleRow } from "./cycle-row";
import { GoalRow } from "./goal-row";
import { ManagerReviewRow } from "./manager-review-row";
import { SelfReviewForm } from "./self-review-form";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function PerformancePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const isHRWrite = HR_WRITE_ROLES.includes(session.user.role);
  const canViewOrgWide = HR_VIEW_ROLES.includes(session.user.role);
  const isManager = session.user.role === "MANAGER";

  const [cycles, employee] = await Promise.all([
    prisma.performanceCycle.findMany({ orderBy: { startDate: "desc" } }),
    prisma.employee.findUnique({ where: { userId: session.user.id } }),
  ]);
  const activeCycles = cycles.filter((c) => c.status === "ACTIVE");
  const activeCycleIds = activeCycles.map((c) => c.id);

  const [myGoals, myReviews] = employee
    ? await Promise.all([
        prisma.goal.findMany({
          where: { employeeId: employee.id, cycleId: { in: activeCycleIds } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.performanceReview.findMany({
          where: { employeeId: employee.id, cycleId: { in: activeCycleIds } },
        }),
      ])
    : [[], []];

  // HR can submit a manager review for anyone too (submitManagerReview's
  // isHR||isManager backend check), same "HR can act as a backup" pattern
  // as decideLeaveRequest — so HR sees every pending review here, not just
  // a manager's own direct reports.
  const teamReviews =
    isHRWrite || (isManager && employee)
      ? await prisma.performanceReview.findMany({
          where: {
            status: "SELF_REVIEW",
            ...(isHRWrite ? {} : { employee: { reportingManagerId: employee!.id } }),
          },
          include: { employee: true, cycle: true },
          orderBy: { selfSubmittedAt: "asc" },
        })
      : [];
  const teamReviewGoals = teamReviews.length
    ? await prisma.goal.findMany({
        where: {
          employeeId: { in: teamReviews.map((r) => r.employeeId) },
          cycleId: { in: teamReviews.map((r) => r.cycleId) },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const orgReviews = canViewOrgWide
    ? await prisma.performanceReview.findMany({
        include: { employee: true, cycle: true },
        orderBy: [{ cycle: { startDate: "desc" } }, { employee: { fullName: "asc" } }],
        take: 100,
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Performance</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Set goals within an active review cycle, submit a self-review, and
          your manager rates and closes it out.
        </p>
      </div>

      {isHRWrite && (
        <div>
          <h2 className="text-sm font-semibold">Review cycles</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-black/50 dark:text-white/50">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Dates</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => (
                  <CycleRow
                    // Keyed on status too: CycleRow's status <select> is an
                    // uncontrolled input via defaultValue, which React only
                    // applies at mount — without the status in the key, the
                    // dropdown would keep showing the pre-save value after
                    // a successful status change (looks like Save silently
                    // failed, inviting an accidental re-submit that reverts
                    // it). Forcing a remount keeps it in sync.
                    key={`${c.id}:${c.status}`}
                    cycle={{
                      id: c.id,
                      name: c.name,
                      startDate: fmt(c.startDate),
                      endDate: fmt(c.endDate),
                      status: c.status,
                    }}
                  />
                ))}
                {cycles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-black/50 dark:text-white/50">
                      No cycles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <CreateCycleForm />
          </div>
        </div>
      )}

      {employee ? (
        activeCycles.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            No active review cycle right now.
          </p>
        ) : (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold">My goals & self-review</h2>
            {activeCycles.map((cycle) => {
              const goals = myGoals.filter((g) => g.cycleId === cycle.id);
              const review = myReviews.find((r) => r.cycleId === cycle.id);
              const locked = review && review.status !== "NOT_STARTED";

              return (
                <div key={cycle.id} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
                  <div className="font-medium">{cycle.name}</div>
                  <ul className="mt-2 space-y-2">
                    {goals.map((g) => (
                      <GoalRow
                        // Same remount-on-change reasoning as CycleRow above
                        // — status is another uncontrolled <select>.
                        key={`${g.id}:${g.status}`}
                        goal={{
                          id: g.id,
                          title: g.title,
                          description: g.description,
                          weight: g.weight,
                          status: g.status,
                          selfRating: g.selfRating,
                          managerRating: g.managerRating,
                        }}
                        canUpdateStatus={cycle.status === "ACTIVE"}
                        canDelete={!locked}
                      />
                    ))}
                    {goals.length === 0 && (
                      <li className="text-sm text-black/50 dark:text-white/50">
                        No goals set yet.
                      </li>
                    )}
                  </ul>
                  {!locked && (
                    <div className="mt-3">
                      <AddGoalForm employeeId={employee.id} cycleId={cycle.id} />
                    </div>
                  )}
                  {!locked && goals.length > 0 && (
                    <SelfReviewForm
                      cycleId={cycle.id}
                      goals={goals.map((g) => ({ id: g.id, title: g.title }))}
                    />
                  )}
                  {review && review.status !== "NOT_STARTED" && (
                    <div className="mt-3 rounded-lg bg-black/5 p-3 text-sm dark:bg-white/10">
                      <p>
                        Self-review submitted{" "}
                        {review.selfSubmittedAt && fmt(review.selfSubmittedAt)}.{" "}
                        {review.status === "COMPLETED"
                          ? `Manager review complete — overall rating ${review.managerOverallRating}/5.`
                          : "Waiting on your manager's review."}
                      </p>
                      {review.selfComments && (
                        <p className="mt-1 text-black/60 dark:text-white/60">
                          <span className="font-medium">Your comments:</span>{" "}
                          {review.selfComments}
                        </p>
                      )}
                      {review.managerComments && (
                        <p className="mt-1 text-black/60 dark:text-white/60">
                          <span className="font-medium">Manager comments:</span>{" "}
                          {review.managerComments}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      {(isManager || isHRWrite) && (
        <div>
          <h2 className="text-sm font-semibold">Reviews awaiting your input</h2>
          <ul className="mt-2 space-y-3">
            {teamReviews.map((r) => (
              <ManagerReviewRow
                key={r.id}
                employeeId={r.employeeId}
                employeeName={r.employee.fullName}
                cycleId={r.cycleId}
                cycleName={r.cycle.name}
                selfComments={r.selfComments}
                goals={teamReviewGoals
                  .filter((g) => g.employeeId === r.employeeId && g.cycleId === r.cycleId)
                  .map((g) => ({ id: g.id, title: g.title, selfRating: g.selfRating }))}
              />
            ))}
            {teamReviews.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing pending.</li>
            )}
          </ul>
        </div>
      )}

      {canViewOrgWide && (
        <div>
          <h2 className="text-sm font-semibold">All reviews</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-black/50 dark:text-white/50">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Cycle</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Overall rating</th>
                </tr>
              </thead>
              <tbody>
                {orgReviews.map((r) => (
                  <tr key={r.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="px-4 py-2">{r.employee.fullName}</td>
                    <td className="px-4 py-2">{r.cycle.name}</td>
                    <td className="px-4 py-2">{r.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-2">{r.managerOverallRating ?? "—"}</td>
                  </tr>
                ))}
                {orgReviews.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-black/50 dark:text-white/50">
                      No reviews yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
