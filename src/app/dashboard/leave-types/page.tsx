import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { AddLeaveTypeForm } from "./add-leave-type-form";
import { LeaveTypeRow } from "./leave-type-row";

export default async function LeaveTypesPage() {
  await requireRoleForPage(...HR_WRITE_ROLES);

  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Leave types</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Changing a type&apos;s days or carry-forward limit only affects balances
        not created yet — it never rewrites an employee&apos;s existing balance
        for a year already in progress. Deactivating stops new balances/
        applications for it without touching anything that already exists.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Settings</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.map((lt) => (
              <LeaveTypeRow key={lt.id} leaveType={lt} />
            ))}
            {leaveTypes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                  No leave types yet — the 3 defaults are seeded the moment the
                  first employee is created.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Add a leave type</h2>
        <div className="mt-2">
          <AddLeaveTypeForm />
        </div>
      </div>
    </div>
  );
}
