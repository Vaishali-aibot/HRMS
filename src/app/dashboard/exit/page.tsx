import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResignationRequestRow } from "@/components/resignation-request-row";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NOT_EXITABLE_STATUSES } from "@/lib/exit-constants";

import { ResignForm } from "./resign-form";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground">{children}</li>;
}

export default async function ExitPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const isManager = session.user.role === "MANAGER";

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: { resignationRequests: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  // Needs the manager's own employee id, which isn't known until the query
  // above resolves — can't run this in parallel with it.
  const teamRequests =
    isManager && employee
      ? await prisma.resignationRequest.findMany({
          where: { status: "PENDING", employee: { reportingManagerId: employee.id } },
          orderBy: { createdAt: "asc" },
          include: { employee: true },
        })
      : [];

  const canResign =
    employee &&
    !NOT_EXITABLE_STATUSES.includes(employee.status as (typeof NOT_EXITABLE_STATUSES)[number]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit and track your own resignation, and — if you manage people —
          decide on your team&apos;s requests.
        </p>
      </div>

      {!employee && (
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet — contact HR
          to enable self-service.
        </p>
      )}

      {employee && (
        <Card>
          <CardHeader>
            <CardTitle>Your resignation</CardTitle>
            <CardDescription>
              Submits a request for your manager or HR to approve — it doesn&apos;t
              start your notice period until they do.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canResign ? (
              <ResignForm />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your current status doesn&apos;t allow submitting a new
                resignation request.
              </p>
            )}
            {employee.resignationRequests.length > 0 && (
              <ul className="flex flex-col gap-2">
                {employee.resignationRequests.map((r) => (
                  <ResignationRequestRow
                    key={r.id}
                    request={{
                      id: r.id,
                      resignationDate: fmt(r.resignationDate),
                      noticePeriodDays: r.noticePeriodDays,
                      reason: r.reason,
                      status: r.status,
                    }}
                    canCancel
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Team resignation requests</CardTitle>
            <CardDescription>Awaiting your decision</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {teamRequests.map((r) => (
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
              {teamRequests.length === 0 && <EmptyRow>Nothing pending.</EmptyRow>}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
