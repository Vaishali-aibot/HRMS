import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { HR_VIEW_ROLES, ROLE_LABELS } from "@/lib/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const canViewRoster = HR_VIEW_ROLES.includes(session.user.role);
  const isAdmin = session.user.role === "HR_ADMIN";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/15">
        <div className="flex items-center gap-6">
          <span className="font-semibold">HRMS</span>
          <nav className="flex gap-4 text-sm text-black/70 dark:text-white/70">
            <Link href="/dashboard">Dashboard</Link>
            {/* Employees list is HR/management-only (also enforced with a
                redirect inside the page itself) — don't link non-HR users
                into a dead end. */}
            {canViewRoster && <Link href="/dashboard/employees">Employees</Link>}
            {canViewRoster && <Link href="/dashboard/onboarding">Onboarding</Link>}
            {/* Leave/Attendance serve everyone — self-service if you're an
                EMPLOYEE/MANAGER, org-wide management if you're HR/MANAGEMENT.
                See src/app/dashboard/leave/page.tsx and .../attendance/page.tsx. */}
            <Link href="/dashboard/leave">Leave</Link>
            <Link href="/dashboard/attendance">Attendance</Link>
            {/* Role assignment is HR_ADMIN-only — see src/lib/actions/user-role.ts */}
            {isAdmin && <Link href="/dashboard/users">Users</Link>}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-black/60 dark:text-white/60">
            {session.user.name ?? session.user.email} ·{" "}
            {ROLE_LABELS[session.user.role]}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
