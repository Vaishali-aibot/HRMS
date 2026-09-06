import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AddLeaveTypeForm } from "./add-leave-type-form";
import { LeaveTypeRow } from "./leave-type-row";

export default async function LeaveTypesPage() {
  await requireRoleForPage(...HR_WRITE_ROLES);

  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leave types</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changing a type&apos;s days or carry-forward limit only affects balances
          not created yet — it never rewrites an employee&apos;s existing balance
          for a year already in progress. Deactivating stops new balances/
          applications for it without touching anything that already exists.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Settings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.map((lt) => (
              // Keyed on accrualMethod/isActive too — LeaveTypeRow's
              // accrualMethod <select> and isActive checkbox are
              // uncontrolled (defaultValue/defaultChecked), which React
              // doesn't re-sync on a revalidatePath re-render unless
              // remounted. Same fix as CycleRow/GoalRow/AssetRow.
              <LeaveTypeRow
                key={`${lt.id}:${lt.accrualMethod}:${lt.isActive}:${lt.monthlyCap}`}
                leaveType={lt}
              />
            ))}
            {leaveTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  No leave types yet — the defaults are seeded the moment the first
                  employee is created.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Add a leave type</h2>
        <div className="mt-2">
          <AddLeaveTypeForm />
        </div>
      </div>
    </div>
  );
}
