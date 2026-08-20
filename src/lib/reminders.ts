import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

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

/** One daily summary email per HR_ADMIN, skipped entirely if nothing's pending. */
export async function sendHRDigest() {
  const [pendingDocs, pendingITTasks, pendingLeave, hrAdmins] = await Promise.all([
    prisma.onboardingDocument.count({
      where: { status: { in: ["NOT_SUBMITTED", "RESUBMISSION_REQUIRED", "SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.iTOnboardingTask.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({ where: { role: "HR_ADMIN" }, select: { email: true } }),
  ]);

  if (pendingDocs + pendingITTasks + pendingLeave === 0) {
    return { sent: 0, pendingDocs: 0, pendingITTasks: 0, pendingLeave: 0 };
  }

  const html = `
    <p>Daily HR summary:</p>
    <ul>
      <li>${pendingDocs} onboarding document(s) awaiting submission/review</li>
      <li>${pendingITTasks} IT setup task(s) not yet completed</li>
      <li>${pendingLeave} leave request(s) pending a decision</li>
    </ul>
    <p><a href="${APP_URL}/dashboard/onboarding">Onboarding</a> ·
       <a href="${APP_URL}/dashboard/leave">Leave</a></p>
  `;

  let sent = 0;
  for (const admin of hrAdmins) {
    const ok = await sendEmail({ to: admin.email, subject: "HRMS daily summary", html });
    if (ok) sent++;
  }
  return { sent, pendingDocs, pendingITTasks, pendingLeave };
}
