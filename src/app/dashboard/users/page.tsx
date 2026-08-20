import { prisma } from "@/lib/prisma";
import { requireRoleForPage } from "@/lib/rbac";

import { UserRoleRow } from "./user-role-row";

export default async function UsersPage() {
  // HR_ADMIN-only — see the note in src/lib/actions/user-role.ts on why
  // this is stricter than most other HR-facing pages.
  await requireRoleForPage("HR_ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      employee: { select: { employeeCode: true, fullName: true } },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">User access</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Roles control what each person can see and do. Only people who have
        signed in at least once via Microsoft appear here — everyone starts
        as <code>EMPLOYEE</code> on first sign-in.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Linked employee record</th>
              <th className="px-4 py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRoleRow key={u.id} user={u} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                  Nobody has signed in yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
