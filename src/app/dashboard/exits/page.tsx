import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, requireRoleForPage } from "@/lib/rbac";

export default async function ExitsPage() {
  await requireRoleForPage(...HR_VIEW_ROLES);

  const employees = await prisma.employee.findMany({
    where: { status: "NOTICE_PERIOD" },
    orderBy: { lastWorkingDay: "asc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      department: true,
      resignationDate: true,
      lastWorkingDay: true,
      exitChecklistItems: { select: { status: true } },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Exits</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Everyone currently in their notice period, with exit checklist
        progress. Open an employee to update individual items.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Last working day</th>
              <th className="px-4 py-2">Checklist</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const done = e.exitChecklistItems.filter((i) => i.status === "COMPLETED").length;
              return (
                <tr key={e.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/employees/${e.id}`} className="hover:underline">
                      {e.fullName}
                    </Link>
                    <div className="font-mono text-xs text-black/50 dark:text-white/50">
                      {e.employeeCode}
                    </div>
                  </td>
                  <td className="px-4 py-2">{e.department}</td>
                  <td className="px-4 py-2">
                    {e.lastWorkingDay?.toLocaleDateString(undefined, { timeZone: "UTC" }) ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {done} / {e.exitChecklistItems.length}
                  </td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                  No one is currently exiting.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
