// Magnitude-across-categories, the "not really a chart" case — a labeled
// list with a single-hue bar under each row (track = a lighter step of the
// same ramp, fill = primary) rather than a full chart component. Value
// sits at the tip, per the one label-per-mark convention; there's no
// legend since every row is one color.
export function HorizontalBarList({
  items,
  max,
}: {
  items: { label: string; value: number; displayValue?: string }[];
  /** Override the scale's max — otherwise the largest item sets it. */
  max?: number;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const maxValue = max ?? Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-muted-foreground" title={item.label}>
            {item.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(2, (item.value / maxValue) * 100))}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
            {item.displayValue ?? item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
