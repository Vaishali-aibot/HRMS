import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  /** Optional extra line below the label — e.g. accrual schedule details. */
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
          {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
