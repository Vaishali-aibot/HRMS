"use client";

// A tiny client component so this renders in the viewer's own browser
// timezone via toLocaleTimeString's default behavior — a Server Component
// would instead format using the server's runtime timezone (UTC on
// Vercel), which would show a wall-clock time that's wrong for anyone
// not in that zone. Every other date display in this app is a
// timezone-agnostic calendar date (hence the DATE_ONLY convention
// elsewhere) — this is the one place an actual time-of-day is shown, so
// it needs real timezone handling instead of that same UTC-anchored
// pattern.
export function CheckedInAtLabel({ checkedInAt }: { checkedInAt: string }) {
  const time = new Date(checkedInAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return <p className="text-xs text-muted-foreground">Checked in today at {time}</p>;
}
