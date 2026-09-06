import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ChecklistProgress } from "@/components/checklist-progress";
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Employees currently pre-boarding or onboarding, with document and IT
          setup checklist progress. Open an employee to update individual
          items.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Joining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>IT setup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => {
              const docsDone = e.onboardingDocuments.filter(
                (d) => d.status === "APPROVED"
              ).length;
              const tasksDone = e.itTasks.filter((t) => t.status === "COMPLETED").length;
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
                    {e.dateOfJoining.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell>
                    <ChecklistProgress done={docsDone} total={e.onboardingDocuments.length} />
                  </TableCell>
                  <TableCell>
                    <ChecklistProgress done={tasksDone} total={e.itTasks.length} />
                  </TableCell>
                </TableRow>
              );
            })}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No one is currently onboarding.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
