import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Shared status → color mapping so every module (resignations, leave, WFH,
// onboarding, PIP, exits...) renders statuses consistently instead of each
// page inventing its own badge colors. Add new statuses here as modules
// adopt this component — unknown values fall back to a neutral badge
// rather than erroring, since the underlying Prisma enums vary per model.
const STATUS_STYLES: Record<string, string> = {
  // Generic approval flow (resignation requests, leave, WFH, exits...)
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400",
  CANCELLED: "bg-muted text-muted-foreground",
  WITHDRAWN: "bg-muted text-muted-foreground",

  // Employee lifecycle status (EmploymentStatus enum)
  CANDIDATE: "bg-muted text-muted-foreground",
  OFFER_ACCEPTED: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  PRE_BOARDING: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  ONBOARDING: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  PROBATION: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CONFIRMED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ACTIVE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  NOTICE_PERIOD: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  EXITED: "bg-muted text-muted-foreground",
  ALUMNI: "bg-muted text-muted-foreground",
  RELIEVED: "bg-muted text-muted-foreground",
  TERMINATED: "bg-red-500/10 text-red-700 dark:text-red-400",

  // Onboarding document review (DocumentStatus enum)
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RESUBMISSION_REQUIRED: "bg-orange-500/10 text-orange-700 dark:text-orange-400",

  // IT setup / exit checklist tasks
  IN_PROGRESS: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",

  // Attendance (AttendanceStatus enum)
  PRESENT: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ABSENT: "bg-red-500/10 text-red-700 dark:text-red-400",
  LATE: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  HALF_DAY: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  WORK_FROM_HOME: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  HOLIDAY: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  ON_LEAVE: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  MISSING: "bg-muted text-muted-foreground",

  // Performance cycles / goals / reviews / PIPs
  DRAFT: "bg-muted text-muted-foreground",
  NOT_STARTED: "bg-muted text-muted-foreground",
  SELF_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  MANAGER_REVIEW: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  COMPLETED_SUCCESS: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED_FAILURE: "bg-red-500/10 text-red-700 dark:text-red-400",

  // Assets (AssetStatus enum)
  AVAILABLE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ASSIGNED: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  UNDER_REPAIR: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RETURNED: "bg-muted text-muted-foreground",
  LOST: "bg-red-500/10 text-red-700 dark:text-red-400",
  RETIRED: "bg-muted text-muted-foreground",
};

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const style = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", style, className)}>
      {formatStatusLabel(status)}
    </Badge>
  );
}
