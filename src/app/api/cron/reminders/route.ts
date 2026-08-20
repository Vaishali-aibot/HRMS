import {
  sendHRDigest,
  sendOnboardingDocumentReminders,
  sendPendingLeaveReminders,
  sendProbationEndingReminders,
} from "@/lib/reminders";

/**
 * Triggered by Vercel Cron (see vercel.json) — daily, since cron jobs run
 * at most once/day on Vercel's Hobby plan.
 *
 * Auth follows Vercel's own documented pattern exactly: CRON_SECRET must be
 * set AND match the Authorization header Vercel sends automatically when
 * that env var exists. Unlike some checks in this app, this one refuses
 * the request if CRON_SECRET is simply unset — this endpoint runs
 * unattended and touches every employee's email, so "unconfigured" should
 * fail closed, not open.
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Cron delivery is best-effort and can duplicate-invoke (see Vercel's
  // docs on cron idempotency) — this isn't deduped against a "last sent"
  // timestamp, so a double-fire sends duplicate reminder emails. Low
  // stakes for a reminder email; disclosed in the README.
  const [documents, leave, probation, digest] = await Promise.all([
    sendOnboardingDocumentReminders(),
    sendPendingLeaveReminders(),
    sendProbationEndingReminders(),
    sendHRDigest(),
  ]);

  return Response.json({ documents, leave, probation, digest });
}
