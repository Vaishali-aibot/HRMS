import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {employees.length} {employees.length === 1 ? "employee" : "employees"}
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/employees/new" />}>
          <Plus />
          Add employee
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/dashboard/employees/${e.id}`} className="hover:underline">
                    {e.employeeCode}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/dashboard/employees/${e.id}`} className="hover:underline">
                    {e.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{e.department}</TableCell>
                <TableCell className="text-muted-foreground">{e.designation}</TableCell>
                <TableCell>
                  <StatusBadge status={e.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {/* dateOfJoining is stored as UTC midnight of the entered
                      calendar date (an <input type="date"> value parsed by
                      `new Date()`) — format in UTC too, or a server running
                      in a timezone behind UTC would display one day early. */}
                  {e.dateOfJoining.toLocaleDateString(undefined, { timeZone: "UTC" })}
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No employees yet. Add your first employee to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
