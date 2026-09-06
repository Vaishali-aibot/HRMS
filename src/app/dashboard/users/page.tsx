import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRoleForPage } from "@/lib/rbac";

import { UserRoleRow } from "./user-role-row";

export default async function UsersPage() {
  // HR_ADMIN-only — see the note in src/lib/actions/user-role.ts on why
  // this is stricter than most other HR-facing pages.
  await requireRoleForPage("HR_ADMIN");

  const [users, allEmployees] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        employee: { select: { id: true, employeeCode: true, fullName: true } },
      },
    }),
    prisma.employee.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, employeeCode: true, fullName: true, userId: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles control what each person can see and do. Linking a user to an
          employee record is what makes leave/attendance self-service work for
          them. Only people who have signed in at least once via Microsoft
          appear here — everyone starts as{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">EMPLOYEE</code>{" "}
          on first sign-in.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Linked employee record</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <UserRoleRow
                key={u.id}
                user={u}
                // Employees not linked to anyone, plus whichever one this
                // user is currently linked to (so it still shows selected).
                availableEmployees={allEmployees.filter(
                  (e) => e.userId === null || e.userId === u.id
                )}
              />
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nobody has signed in yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
