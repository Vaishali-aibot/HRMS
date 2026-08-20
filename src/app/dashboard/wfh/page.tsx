import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";

import { ApplyWFHForm } from "./apply-wfh-form";
import { WFHPolicyForm } from "./wfh-policy-form";
import { WFHRequestRow } from "./wfh-request-row";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function WFHPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const canViewOrgWide = HR_VIEW_ROLES.includes(session.user.role);
  const canDecideAnyRequest = HR_WRITE_ROLES.includes(session.user.role);
  const isHRWrite = HR_WRITE_ROLES.includes(session.user.role);
  const isManager = session.user.role === "MANAGER";

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: { wfhRequests: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  const [teamRequests, orgRequests, policy] = await Promise.all([
    isManager && employee
      ? prisma.wFHRequest.findMany({
          where: { status: "PENDING", employee: { reportingManagerId: employee.id } },
          orderBy: { createdAt: "asc" },
          include: { employee: true },
        })
      : Promise.resolve([]),
    canViewOrgWide
      ? prisma.wFHRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          include: { employee: true },
        })
      : Promise.resolve([]),
    isHRWrite ? prisma.wFHPolicy.findUnique({ where: { id: "default" } }) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Work from home</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Approving a request marks those dates as Work From Home on the
          employee&apos;s attendance record automatically.
        </p>
      </div>

      {isHRWrite && (
        <div>
          <h2 className="text-sm font-semibold">WFH policy</h2>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Applies to every new or newly-decided request. Doesn&apos;t
            retroactively affect requests already approved.
          </p>
          <div className="mt-2">
            <WFHPolicyForm
              // Keyed on the policy's content — see the CycleRow/GoalRow/
              // AssetRow/LeaveTypeRow comments on why an uncontrolled
              // form's inputs need this to reflect a just-saved value.
              key={JSON.stringify(policy)}
              policy={{
                maxDaysPerMonth: policy?.maxDaysPerMonth ?? null,
                maxDaysPerYear: policy?.maxDaysPerYear ?? null,
                eligibleEmploymentTypes: policy?.eligibleEmploymentTypes ?? [],
                allowedLocations: policy?.allowedLocations ?? [],
              }}
            />
          </div>
        </div>
      )}

      {employee ? (
        <>
          <div>
            <h2 className="text-sm font-semibold">Request WFH</h2>
            <div className="mt-2">
              <ApplyWFHForm />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">My requests</h2>
            <ul className="mt-2 space-y-2">
              {employee.wfhRequests.map((r) => (
                <WFHRequestRow
                  key={r.id}
                  request={{
                    id: r.id,
                    startDate: fmt(r.startDate),
                    endDate: fmt(r.endDate),
                    reason: r.reason,
                    status: r.status,
                  }}
                  canCancel
                />
              ))}
              {employee.wfhRequests.length === 0 && (
                <li className="text-sm text-black/50 dark:text-white/50">No requests yet.</li>
              )}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      )}

      {isManager && (
        <div>
          <h2 className="text-sm font-semibold">Team requests awaiting your decision</h2>
          <ul className="mt-2 space-y-2">
            {teamRequests.map((r) => (
              <WFHRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  employeeName: r.employee.fullName,
                  startDate: fmt(r.startDate),
                  endDate: fmt(r.endDate),
                  reason: r.reason,
                  status: r.status,
                }}
                showEmployeeName
                canDecide
              />
            ))}
            {teamRequests.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing pending.</li>
            )}
          </ul>
        </div>
      )}

      {canViewOrgWide && (
        <div>
          <h2 className="text-sm font-semibold">All pending requests</h2>
          <ul className="mt-2 space-y-2">
            {orgRequests.map((r) => (
              <WFHRequestRow
                key={r.id}
                request={{
                  id: r.id,
                  employeeName: r.employee.fullName,
                  startDate: fmt(r.startDate),
                  endDate: fmt(r.endDate),
                  reason: r.reason,
                  status: r.status,
                }}
                showEmployeeName
                canDecide={canDecideAnyRequest}
              />
            ))}
            {orgRequests.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">Nothing pending.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
