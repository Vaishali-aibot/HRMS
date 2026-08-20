import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { EditEmployeeForm } from "./edit-employee-form";
import { StatusChangeForm } from "./status-change-form";

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/employees"
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          ← Back to employees
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{employee.fullName}</h1>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
            {employee.status.replaceAll("_", " ")}
          </span>
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
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
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-black/10 p-4 sm:grid-cols-2 dark:border-white/15">
          <ReadOnlyRow label="Personal email" value={employee.personalEmail ?? "—"} />
          <ReadOnlyRow label="Location" value={employee.location ?? "—"} />
          <ReadOnlyRow label="Employment type" value={employee.employmentType.replaceAll("_", " ")} />
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
        </div>
      )}

      {canEdit && (
        <StatusChangeForm employeeId={employee.id} currentStatus={employee.status} />
      )}

      <div>
        <h2 className="text-sm font-semibold">Lifecycle history</h2>
        <ul className="mt-2 space-y-2">
          {employee.statusHistory.map((h) => (
            <li
              key={h.id}
              className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
            >
              <div>
                {h.previousStatus ? `${h.previousStatus.replaceAll("_", " ")} → ` : "Created at "}
                {h.newStatus.replaceAll("_", " ")}
              </div>
              {h.reason && (
                <div className="text-black/60 dark:text-white/60">{h.reason}</div>
              )}
              <div className="text-xs text-black/40 dark:text-white/40">
                {h.changedAt.toLocaleString(undefined, { timeZone: "UTC" })} UTC
              </div>
            </li>
          ))}
          {employee.statusHistory.length === 0 && (
            <li className="text-sm text-black/50 dark:text-white/50">No history yet.</li>
          )}
        </ul>
      </div>

      {canEdit && (
        <div>
          <h2 className="text-sm font-semibold">Recent field changes</h2>
          <ul className="mt-2 space-y-1">
            {recentChanges.map((c) => (
              <li key={c.id} className="text-xs text-black/60 dark:text-white/60">
                <span className="font-medium">{c.field}</span>: {c.oldValue ?? "—"} →{" "}
                {c.newValue ?? "—"} ({c.changedAt.toLocaleString(undefined, { timeZone: "UTC" })} UTC)
              </li>
            ))}
            {recentChanges.length === 0 && (
              <li className="text-sm text-black/50 dark:text-white/50">No changes recorded yet.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
