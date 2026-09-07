"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  Boxes,
  CalendarDays,
  Clock,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ShieldCheck,
  Sparkles,
  Target,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/types/next-auth";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const SELF_SERVICE: NavItem[] = [
  { href: "/dashboard/leave", label: "Leave", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/performance", label: "Performance", icon: Target },
  { href: "/dashboard/performance/pip", label: "PIP", icon: ListChecks },
  { href: "/dashboard/recognition", label: "Recognition", icon: Award },
  { href: "/dashboard/exit", label: "Exit", icon: LogOut },
  { href: "/dashboard/requests", label: "Requests", icon: Inbox },
  { href: "/dashboard/assistant", label: "Assistant", icon: Sparkles },
];

const HR_MANAGEMENT: NavItem[] = [
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/dashboard/offboarding", label: "Offboarding", icon: UserMinus },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
];

const HR_ADMIN_ITEMS: NavItem[] = [
  { href: "/dashboard/assets", label: "Assets", icon: Boxes },
  { href: "/dashboard/leave-types", label: "Leave types", icon: ListChecks },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/dashboard/users", label: "Users", icon: ShieldCheck },
];

export function AppSidebar({
  user,
  canViewRoster,
  isHRWrite,
  isAdmin,
}: {
  user: { name?: string | null; email?: string | null; role: AppRole };
  canViewRoster: boolean;
  isHRWrite: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const groups: NavGroup[] = [
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    { label: "Self-service", items: SELF_SERVICE },
    ...(canViewRoster ? [{ label: "HR management", items: HR_MANAGEMENT }] : []),
    ...(isHRWrite ? [{ label: "Configuration", items: HR_ADMIN_ITEMS }] : []),
    ...(isAdmin ? [{ label: "Administration", items: ADMIN_ITEMS }] : []),
  ];

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
            HR
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            HRMS
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm group-data-[collapsible=icon]:justify-center">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium leading-tight">
              {user.name ?? user.email}
            </span>
            <span className="truncate text-xs text-muted-foreground leading-tight">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
