import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Day + month only — a birthday recurs every year, and year isn't the
// point here (avoids surfacing age incidentally). Date-only, so no
// viewer-timezone concern, same reasoning as UpcomingHolidaysCard.
function fmtBirthday(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function BirthdaysThisMonthCard({
  employees,
}: {
  employees: { id: string; employeeCode: string; fullName: string; dateOfBirth: Date }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Birthdays this month</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {employees.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="font-medium">{e.fullName}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">{e.employeeCode}</span>
              </div>
              <span className="whitespace-nowrap text-muted-foreground">
                {fmtBirthday(e.dateOfBirth)}
              </span>
            </li>
          ))}
          {employees.length === 0 && (
            <p className="text-sm text-muted-foreground">No birthdays this month.</p>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
