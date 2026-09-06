import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";

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
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set goals within an active review cycle, submit a self-review, and
          your manager rates and closes it out.
        </p>
      </div>

      {isHRWrite && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No cycles yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <CreateCycleForm />
        </div>
      )}

      {employee ? (
        activeCycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active review cycle right now.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              My goals & self-review
            </h2>
            {activeCycles.map((cycle) => {
              const goals = myGoals.filter((g) => g.cycleId === cycle.id);
              const review = myReviews.find((r) => r.cycleId === cycle.id);
              const locked = review && review.status !== "NOT_STARTED";

              return (
                <Card key={cycle.id}>
                  <CardHeader>
                    <CardTitle>{cycle.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <ul className="flex flex-col gap-2">
                      {goals.map((g) => (
                        // Same remount-on-change reasoning as CycleRow above
                        // — status is another uncontrolled <select>.
                        <GoalRow
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
                        <p className="text-sm text-muted-foreground">No goals set yet.</p>
                      )}
                    </ul>
                    {!locked && <AddGoalForm employeeId={employee.id} cycleId={cycle.id} />}
                    {!locked && goals.length > 0 && (
                      <SelfReviewForm
                        cycleId={cycle.id}
                        goals={goals.map((g) => ({ id: g.id, title: g.title }))}
                      />
                    )}
                    {review && review.status !== "NOT_STARTED" && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <p>
                          Self-review submitted{" "}
                          {review.selfSubmittedAt && fmt(review.selfSubmittedAt)}.{" "}
                          {review.status === "COMPLETED"
                            ? `Manager review complete — overall rating ${review.managerOverallRating}/5.`
                            : "Waiting on your manager's review."}
                        </p>
                        {review.selfComments && (
                          <p className="mt-1 text-muted-foreground">
                            <span className="font-medium text-foreground">Your comments:</span>{" "}
                            {review.selfComments}
                          </p>
                        )}
                        {review.managerComments && (
                          <p className="mt-1 text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Manager comments:
                            </span>{" "}
                            {review.managerComments}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      {(isManager || isHRWrite) && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            Reviews awaiting your input
          </h2>
          <div className="mt-2 flex flex-col gap-3">
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
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            )}
          </div>
        </div>
      )}

      {canViewOrgWide && (
        <Card>
          <CardHeader>
            <CardTitle>All reviews</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Overall rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgReviews.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.cycle.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.managerOverallRating ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {orgReviews.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No reviews yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
