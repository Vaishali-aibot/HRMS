import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendTeamsMessage } from "@/lib/teams";
import { todayUTC } from "@/lib/date-only";

// Used to build links inside reminder emails. Set this to your real deployed
// URL once you have one (a Vercel env var, or NEXT_PUBLIC_APP_URL below) —
// without it, links in emails point at localhost.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PENDING_DOCUMENT_STATUSES = ["NOT_SUBMITTED", "RESUBMISSION_REQUIRED"] as const;

/**
 * One email per employee still onboarding with outstanding documents.
 * Fires on every cron run for anything still outstanding — there's no
 * backoff/throttling, so a document pending for a week gets ~7 daily
 * emails, not one. Simple and honest about it (see README).
 */
export async function sendOnboardingDocumentReminders() {
  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ["PRE_BOARDING", "ONBOARDING"] },
      onboardingDocuments: { some: { status: { in: [...PENDING_DOCUMENT_STATUSES] } } },
    },
    include: {
      user: { select: { email: true } },
      onboardingDocuments: { where: { status: { in: [...PENDING_DOCUMENT_STATUSES] } } },
    },
  });

  let notified = 0;
  let skippedNoEmail = 0;

  for (const employee of employees) {
    const to = employee.user?.email ?? employee.personalEmail;
    if (!to) {
      skippedNoEmail++;
      continue;
    }

    const items = employee.onboardingDocuments
      .map((d) => `<li>${d.type.replaceAll("_", " ")} (${d.status.replaceAll("_", " ")})</li>`)
      .join("");

    const ok = await sendEmail({
      to,
      subject: "Action needed: pending onboarding documents",
      html: `<p>Hi ${employee.fullName},</p>
        <p>You still need to submit the following document(s):</p>
        <ul>${items}</ul>
        <p><a href="${APP_URL}/dashboard/documents">Upload them here</a>.</p>`,
    });
    if (ok) notified++;
  }

  return { employeesChecked: employees.length, employeesNotified: notified, skippedNoEmail };
}

/**
 * One email per manager summarizing their team's pending leave requests.
 * Managers without a linked employee record, or whose linked record has no
 * User (no email to send to), are silently skipped — counted so it's
 * visible in the response rather than invisible.
 */
export async function sendPendingLeaveReminders() {
  const pending = await prisma.leaveRequest.findMany({
    where: { status: "PENDING" },
    include: {
      employee: { include: { reportingManager: { include: { user: true } } } },
      leaveType: true,
    },
  });

  const byManagerEmail = new Map<
    string,
    { managerName: string; items: { employeeName: string; leaveType: string; days: number }[] }
  >();
  let skippedNoManagerEmail = 0;

  for (const request of pending) {
    const manager = request.employee.reportingManager;
    const email = manager?.user?.email;
    if (!manager || !email) {
      skippedNoManagerEmail++;
      continue;
    }
    const bucket = byManagerEmail.get(email) ?? { managerName: manager.fullName, items: [] };
    bucket.items.push({
      employeeName: request.employee.fullName,
      leaveType: request.leaveType.name,
      days: request.days,
    });
    byManagerEmail.set(email, bucket);
  }

  let managersNotified = 0;
  for (const [email, { managerName, items }] of byManagerEmail) {
    const list = items
      .map((i) => `<li>${i.employeeName}: ${i.leaveType}, ${i.days} day(s)</li>`)
      .join("");
    const ok = await sendEmail({
      to: email,
      subject: `${items.length} leave request${items.length === 1 ? "" : "s"} awaiting your decision`,
      html: `<p>Hi ${managerName},</p>
        <ul>${list}</ul>
        <p><a href="${APP_URL}/dashboard/leave">Review them here</a>.</p>`,
    });
    if (ok) managersNotified++;
  }

  return { pendingCount: pending.length, managersNotified, skippedNoManagerEmail };
}

// PRD §16's exact cadence — reminders fire only on these three milestones,
// not every day probation happens to be outstanding (unlike the document/
// leave reminders above, which do re-fire daily).
const PROBATION_REMINDER_DAYS = [30, 15, 7] as const;

/**
 * One email per manager listing which direct reports hit a 30/15/7-day
 * probation-ending milestone today. Managers without a linked employee
 * record/User email are silently skipped (counted, same as the leave
 * reminder above).
 */
export async function sendProbationEndingReminders() {
  const today = todayUTC();
  const targetDates = PROBATION_REMINDER_DAYS.map((days) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  });

  const employees = await prisma.employee.findMany({
    where: { status: "PROBATION", probationEndDate: { in: targetDates } },
    include: { reportingManager: { include: { user: true } } },
  });

  const byManagerEmail = new Map<
    string,
    { managerName: string; items: { employeeName: string; endDate: Date }[] }
  >();
  let skippedNoManagerEmail = 0;

  for (const employee of employees) {
    const manager = employee.reportingManager;
    const email = manager?.user?.email;
    if (!manager || !email || !employee.probationEndDate) {
      skippedNoManagerEmail++;
      continue;
    }
    const bucket = byManagerEmail.get(email) ?? { managerName: manager.fullName, items: [] };
    bucket.items.push({ employeeName: employee.fullName, endDate: employee.probationEndDate });
    byManagerEmail.set(email, bucket);
  }

  let managersNotified = 0;
  for (const [email, { managerName, items }] of byManagerEmail) {
    const list = items
      .map(
        (i) =>
          `<li>${i.employeeName}: probation ends ${i.endDate.toLocaleDateString(undefined, { timeZone: "UTC" })}</li>`
      )
      .join("");
    const ok = await sendEmail({
      to: email,
      subject: `Probation ending soon for ${items.length} team member${items.length === 1 ? "" : "s"}`,
      html: `<p>Hi ${managerName},</p>
        <ul>${list}</ul>
        <p>Time for a performance review and a confirm / extend / exit decision.</p>
        <p><a href="${APP_URL}/dashboard/employees">View employees</a>.</p>`,
    });
    if (ok) managersNotified++;
  }

  return { employeesFlagged: employees.length, managersNotified, skippedNoManagerEmail };
}

// Matches the "overdue" cue on /dashboard/requests — not a configurable
// SLA policy, just a fixed visibility threshold.
const HR_REQUEST_OVERDUE_DAYS = 3;

/** One daily summary email per HR_ADMIN, skipped entirely if nothing's pending. */
export async function sendHRDigest() {
  const today = todayUTC();
  const probationTargetDates = PROBATION_REMINDER_DAYS.map((days) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  });
  const overdueThreshold = new Date(today);
  overdueThreshold.setUTCDate(overdueThreshold.getUTCDate() - HR_REQUEST_OVERDUE_DAYS);

  const [
    pendingDocs,
    pendingITTasks,
    pendingLeave,
    probationMilestones,
    overdueHRRequests,
    hrAdmins,
  ] = await Promise.all([
    prisma.onboardingDocument.count({
      where: { status: { in: ["NOT_SUBMITTED", "RESUBMISSION_REQUIRED", "SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.iTOnboardingTask.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.employee.count({
      where: { status: "PROBATION", probationEndDate: { in: probationTargetDates } },
    }),
    prisma.hRRequest.count({
      where: {
        status: { notIn: ["RESOLVED", "CLOSED"] },
        createdAt: { lte: overdueThreshold },
      },
    }),
    prisma.user.findMany({ where: { role: "HR_ADMIN" }, select: { email: true } }),
  ]);

  if (
    pendingDocs + pendingITTasks + pendingLeave + probationMilestones + overdueHRRequests ===
    0
  ) {
    return {
      sent: 0,
      teamsPosted: false,
      pendingDocs: 0,
      pendingITTasks: 0,
      pendingLeave: 0,
      probationMilestones: 0,
      overdueHRRequests: 0,
    };
  }

  const html = `
    <p>Daily HR summary:</p>
    <ul>
      <li>${pendingDocs} onboarding document(s) awaiting submission/review</li>
      <li>${pendingITTasks} IT setup task(s) not yet completed</li>
      <li>${pendingLeave} leave request(s) pending a decision</li>
      <li>${probationMilestones} employee(s) hitting a 30/15/7-day probation-ending milestone today</li>
      <li>${overdueHRRequests} HR request(s) open ${HR_REQUEST_OVERDUE_DAYS}+ days</li>
    </ul>
    <p><a href="${APP_URL}/dashboard/onboarding">Onboarding</a> ·
       <a href="${APP_URL}/dashboard/leave">Leave</a> ·
       <a href="${APP_URL}/dashboard/employees">Employees</a> ·
       <a href="${APP_URL}/dashboard/requests">Requests</a></p>
  `;

  let sent = 0;
  for (const admin of hrAdmins) {
    const ok = await sendEmail({ to: admin.email, subject: "HRMS daily summary", html });
    if (ok) sent++;
  }

  // One post to the shared HR Teams channel (if configured), not one per
  // admin — a Teams webhook posts to a channel, not a person (PRD §32).
  const teamsPosted = await sendTeamsMessage({
    title: "HRMS daily summary",
    text: [
      `${pendingDocs} onboarding document(s) awaiting submission/review`,
      `${pendingITTasks} IT setup task(s) not yet completed`,
      `${pendingLeave} leave request(s) pending a decision`,
      `${probationMilestones} employee(s) hitting a 30/15/7-day probation-ending milestone today`,
      `${overdueHRRequests} HR request(s) open ${HR_REQUEST_OVERDUE_DAYS}+ days`,
      "",
      `${APP_URL}/dashboard/requests`,
    ].join("\n"),
  });

  return {
    sent,
    teamsPosted,
    pendingDocs,
    pendingITTasks,
    pendingLeave,
    probationMilestones,
    overdueHRRequests,
  };
}
