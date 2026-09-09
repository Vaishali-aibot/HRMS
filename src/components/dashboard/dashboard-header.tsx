import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import type { Notifications } from "@/lib/notifications";

export function DashboardHeader({
  signOut,
  notifications,
}: {
  signOut: () => Promise<void>;
  notifications: Notifications;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-muted-foreground">
          dotkonnekt HRMS
        </span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell actionable={notifications.actionable} own={notifications.own} />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
