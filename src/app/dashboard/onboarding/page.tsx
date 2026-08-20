import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, requireRoleForPage } from "@/lib/rbac";

export default async function OnboardingOverviewPage() {
  await requireRoleForPage(...HR_VIEW_ROLES);

  const employees = await prisma.employee.findMany({
    where: { status: { in: ["PRE_BOARDING", "ONBOARDING"] } },
    orderBy: { dateOfJoining: "asc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      department: true,
      dateOfJoining: true,
      status: true,
      onboardingDocuments: { select: { status: true } },
      itTasks: { select: { status: true } },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Onboarding</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Employees currently pre-boarding or onboarding, with document and IT
        setup checklist progress. Open an employee to update individual
        items.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Joining</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Documents</th>
              <th className="px-4 py-2">IT setup</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const docsDone = e.onboardingDocuments.filter(
                (d) => d.status === "APPROVED"
              ).length;
              const tasksDone = e.itTasks.filter((t) => t.status === "COMPLETED").length;
              return (
                <tr key={e.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/employees/${e.id}`}
                      className="hover:underline"
                    >
                      {e.fullName}
                    </Link>
                    <div className="font-mono text-xs text-black/50 dark:text-white/50">
                      {e.employeeCode}
                    </div>
                  </td>
                  <td className="px-4 py-2">{e.department}</td>
                  <td className="px-4 py-2">
                    {e.dateOfJoining.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                      {e.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {docsDone} / {e.onboardingDocuments.length}
                  </td>
                  <td className="px-4 py-2">
                    {tasksDone} / {e.itTasks.length}
                  </td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                  No one is currently onboarding.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
