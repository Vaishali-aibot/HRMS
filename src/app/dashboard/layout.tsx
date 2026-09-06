import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, signOut } from "@/lib/auth";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";

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
  const isHRWrite = HR_WRITE_ROLES.includes(session.user.role);
  const isAdmin = session.user.role === "HR_ADMIN";

  return (
    <SidebarProvider>
      <AppSidebar
        user={session.user}
        canViewRoster={canViewRoster}
        isHRWrite={isHRWrite}
        isAdmin={isAdmin}
      />
      <SidebarInset>
        <DashboardHeader
          signOut={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        />
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
