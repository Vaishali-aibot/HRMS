import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Date-only, like Employee.dateOfJoining — no viewer-timezone concern (see
// CheckedInAtLabel for the one place that actually needs that), so this
// renders fine straight from a Server Component with a fixed locale, giving
// every viewer the same "Fri, 2 Oct 2026" format regardless of their own.
function fmtHolidayDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UpcomingHolidaysCard({
  holidays,
}: {
  holidays: { id: string; date: Date; name: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming holidays</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{h.name}</span>
              <span className="whitespace-nowrap text-muted-foreground">
                {fmtHolidayDate(h.date)}
              </span>
            </li>
          ))}
          {holidays.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
