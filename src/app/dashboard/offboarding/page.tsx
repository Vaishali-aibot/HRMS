import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChecklistProgress } from "@/components/checklist-progress";
import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, requireRoleForPage } from "@/lib/rbac";

export default async function OffboardingPage() {
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Offboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone currently in their notice period, with exit checklist
          progress. Open an employee to update individual items.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Last working day</TableHead>
              <TableHead>Checklist</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => {
              const done = e.exitChecklistItems.filter((i) => i.status === "COMPLETED").length;
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/employees/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.fullName}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{e.employeeCode}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.department}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.lastWorkingDay?.toLocaleDateString(undefined, { timeZone: "UTC" }) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ChecklistProgress done={done} total={e.exitChecklistItems.length} />
                  </TableCell>
                </TableRow>
              );
            })}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No one is currently exiting.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
