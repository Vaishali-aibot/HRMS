import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Compact "N/total" + progress bar, for a checklist-style column in a table. */
export function ChecklistProgress({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const complete = total > 0 && done === total;

  return (
    <div className={cn("flex w-24 flex-col gap-1", className)}>
      <span
        className={cn(
          "text-xs tabular-nums",
          complete ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
        )}
      >
        {done}/{total}
      </span>
      <Progress value={pct} />
    </div>
  );
}
