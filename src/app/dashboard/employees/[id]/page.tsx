import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { DocumentRow } from "./document-row";
import { EditEmployeeForm } from "./edit-employee-form";
import { ExitChecklistRow } from "./exit-checklist-row";
import { ExtendProbationForm } from "./extend-probation-form";
import { InitiateExitForm } from "./initiate-exit-form";
import { ITTaskRow } from "./it-task-row";
import { StatusChangeForm } from "./status-change-form";

const ALREADY_EXITING_STATUSES = ["NOTICE_PERIOD", "EXITED", "ALUMNI"];

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Viewing the roster is HR/management-only, same as the list page;
  // editing (below) is further restricted to HR_WRITE_ROLES.
  const session = await requireRoleForPage(...HR_VIEW_ROLES);
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      reportingManager: { select: { id: true, employeeCode: true, fullName: true } },
      statusHistory: { orderBy: { changedAt: "desc" } },
      onboardingDocuments: { orderBy: { type: "asc" } },
      itTasks: { orderBy: { type: "asc" } },
      exitChecklistItems: { orderBy: { type: "asc" } },
    },
  });

  if (!employee) {
    notFound();
  }

  const canEdit = HR_WRITE_ROLES.includes(session.user.role);

  const [potentialManagers, recentChanges] = await Promise.all([
    canEdit
      ? prisma.employee.findMany({
          where: { id: { not: employee.id } },
          orderBy: { fullName: "asc" },
          select: { id: true, employeeCode: true, fullName: true },
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: { entityType: "Employee", entityId: employee.id },
      orderBy: { changedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to employees
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
          <StatusBadge status={employee.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {employee.employeeCode} · {employee.designation} · {employee.department}
        </p>
      </div>

      {canEdit ? (
        <EditEmployeeForm
          employee={{
            id: employee.id,
            fullName: employee.fullName,
            personalEmail: employee.personalEmail,
            department: employee.department,
            designation: employee.designation,
            location: employee.location,
            employmentType: employee.employmentType,
            workMode: employee.workMode,
            reportingManagerId: employee.reportingManagerId,
          }}
          potentialManagers={potentialManagers}
        />
      ) : (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyRow label="Personal email" value={employee.personalEmail ?? "—"} />
            <ReadOnlyRow label="Location" value={employee.location ?? "—"} />
            <ReadOnlyRow
              label="Employment type"
              value={employee.employmentType.replaceAll("_", " ")}
            />
            <ReadOnlyRow label="Work mode" value={employee.workMode.replaceAll("_", " ")} />
            <ReadOnlyRow
              label="Reporting manager"
              value={
                employee.reportingManager
                  ? `${employee.reportingManager.employeeCode} — ${employee.reportingManager.fullName}`
                  : "—"
              }
            />
            <ReadOnlyRow
              label="Date of joining"
              value={employee.dateOfJoining.toLocaleDateString(undefined, { timeZone: "UTC" })}
            />
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <StatusChangeForm employeeId={employee.id} currentStatus={employee.status} />
      )}

      {employee.status === "PROBATION" && employee.probationEndDate && (
        <Card>
          <CardHeader>
            <CardTitle>Probation (PRD §16)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Ends {employee.probationEndDate.toLocaleDateString(undefined, { timeZone: "UTC" })} —
              confirm or exit via the status field above, or extend below.
            </p>
            {canEdit && (
              <ExtendProbationForm
                employeeId={employee.id}
                currentEndDate={employee.probationEndDate.toLocaleDateString(undefined, {
                  timeZone: "UTC",
                })}
              />
            )}
          </CardContent>
        </Card>
      )}

      {canEdit && !ALREADY_EXITING_STATUSES.includes(employee.status) && (
        <InitiateExitForm employeeId={employee.id} />
      )}

      {employee.status === "NOTICE_PERIOD" && (
        <Card>
          <CardHeader>
            <CardTitle>Exit checklist (PRD §24)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Resigned {employee.resignationDate?.toLocaleDateString(undefined, { timeZone: "UTC" })}
              {" · "}
              last working day{" "}
              {employee.lastWorkingDay?.toLocaleDateString(undefined, { timeZone: "UTC" })}
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <ul>
              {employee.exitChecklistItems.map((item) => (
                <ExitChecklistRow
                  key={item.id}
                  item={item}
                  employeeId={employee.id}
                  editable={canEdit}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding documents</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul>
              {employee.onboardingDocuments.map((d) => (
                <DocumentRow
                  key={d.id}
                  document={d}
                  employeeId={employee.id}
                  editable={canEdit}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>IT setup</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul>
              {employee.itTasks.map((t) => (
                <ITTaskRow key={t.id} task={t} employeeId={employee.id} editable={canEdit} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {employee.statusHistory.map((h) => (
            <div key={h.id} className="rounded-lg border p-3 text-sm">
              <div>
                {h.previousStatus ? `${h.previousStatus.replaceAll("_", " ")} → ` : "Created at "}
                {h.newStatus.replaceAll("_", " ")}
              </div>
              {h.reason && <div className="text-muted-foreground">{h.reason}</div>}
              <div className="text-xs text-muted-foreground/70">
                {h.changedAt.toLocaleString(undefined, { timeZone: "UTC" })} UTC
              </div>
            </div>
          ))}
          {employee.statusHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Recent field changes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {recentChanges.map((c) => (
              <p key={c.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.field}</span>: {c.oldValue ?? "—"}{" "}
                → {c.newValue ?? "—"} (
                {c.changedAt.toLocaleString(undefined, { timeZone: "UTC" })} UTC)
              </p>
            ))}
            {recentChanges.length === 0 && (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
