import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, requireRoleForPage } from "@/lib/rbac";

export default async function EmployeesPage() {
  // Full roster is HR/management-only (PRD §30) — redirects non-HR roles
  // rather than letting them view every employee's status/department/join
  // date, which the proxy alone does not prevent.
  await requireRoleForPage(...HR_VIEW_ROLES);

  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      department: true,
      designation: true,
      status: true,
      dateOfJoining: true,
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <Link
          href="/dashboard/employees/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          + Add employee
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Employee ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Designation</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2 font-mono text-xs">{e.employeeCode}</td>
                <td className="px-4 py-2">{e.fullName}</td>
                <td className="px-4 py-2">{e.department}</td>
                <td className="px-4 py-2">{e.designation}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    {e.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {/* dateOfJoining is stored as UTC midnight of the entered
                      calendar date (an <input type="date"> value parsed by
                      `new Date()`) — format in UTC too, or a server running
                      in a timezone behind UTC would display one day early. */}
                  {e.dateOfJoining.toLocaleDateString(undefined, { timeZone: "UTC" })}
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                  No employees yet. Add your first employee to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
