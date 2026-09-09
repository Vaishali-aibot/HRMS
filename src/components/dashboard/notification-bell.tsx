"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationItem } from "@/lib/notifications";

function NotificationList({ items }: { items: NotificationItem[] }) {
  return (
    <>
      {items.map((item) => (
        <DropdownMenuItem key={item.id} render={<Link href={item.href} />}>
          <span className="line-clamp-2 whitespace-normal">{item.label}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function NotificationBell({
  actionable,
  own,
}: {
  actionable: NotificationItem[];
  own: NotificationItem[];
}) {
  const badgeCount = actionable.length;
  const isEmpty = actionable.length === 0 && own.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell />
            {badgeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        {isEmpty && (
          <DropdownMenuItem disabled>Nothing pending right now.</DropdownMenuItem>
        )}
        {actionable.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Awaiting your decision</DropdownMenuLabel>
            <NotificationList items={actionable} />
          </DropdownMenuGroup>
        )}
        {actionable.length > 0 && own.length > 0 && <DropdownMenuSeparator />}
        {own.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Your pending requests</DropdownMenuLabel>
            <NotificationList items={own} />
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
