import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES } from "@/lib/rbac";
import type { AppRole } from "@/types/next-auth";

export type NotificationItem = {
  id: string;
  label: string;
  href: string;
  /** Sort key only — created-at for a pending item, decided-at for a
   * recently-decided one. Never rendered directly. */
  timestamp: Date;
};

export type Notifications = {
  /** Pending requests from OTHER employees the current user can decide on
   * right now — org-wide for HR, direct-reports-only for a manager. Empty
   * for a plain EMPLOYEE (no decision power over anyone). */
  actionable: NotificationItem[];
  /** The current user's own pending requests — a status view, not
   * actionable here (same restriction the Leave/Attendance/Exit pages
   * already enforce: you can request a correction/apply/resign, but you
   * decide someone else's, never your own, via these dropdown links). */
  own: NotificationItem[];
  /** The current user's own requests decided (approved/rejected) in the
   * last 7 days — otherwise an approval would silently vanish from `own`
   * (no longer PENDING) with nothing ever telling the employee what
   * happened to it. There's no "seen/unseen" tracking (would need a
   * schema change), so this is purely recency-based and will resurface
   * the same item on every visit within the window — acceptable for a
   * first pass, worth revisiting if that proves annoying in practice. */
  recentUpdates: NotificationItem[];
};

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

function decisionWord(status: string) {
  return status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : status;
}

/**
 * Aggregates the three approval-style "pending request" workflows (Leave —
 * which includes WFH since the WFH merge, Attendance corrections,
 * Resignation) into one feed for the header's notification bell. Each
 * already has its own "pending" section on its own page (Leave/Attendance/
 * Exit) and on the HR/manager Dashboard card for resignations — this
 * doesn't replace those, it's a cross-cutting summary that links back to
 * them, same relationship a notification bell has to the pages it
 * summarizes in any app.
 *
 * Deliberately NOT included: HRRequest (helpdesk tickets) — those are
 * resolved by HR support rather than approved/rejected by a
 * manager/employee, a different enough workflow to leave for later rather
 * than force into this shape.
 */
export async function getNotifications(session: {
  user: { id: string; role: AppRole };
}): Promise<Notifications> {
  const isHR = HR_WRITE_ROLES.includes(session.user.role);
  const isManager = session.user.role === "MANAGER";
  const recentSince = new Date(Date.now() - RECENT_WINDOW_MS);

  // Everything below runs inside one interactive $transaction — pinned to
  // a single connection for its whole duration — rather than as separate
  // prisma.X calls. Firing this many separate sequential queries against
  // the local dev proxy from inside the root layout (so on *every*
  // navigation) reliably corrupted a *different* query each time with a
  // Postgres wire-protocol error ("bind message supplies N parameters,
  // but prepared statement requires 0", code 08P01) — a connection-pool
  // race across concurrent requests hitting the proxy, not a bug in any
  // one query's shape (confirmed: reproduced with both a relation filter
  // and a plain scalar `in` filter, in every order). Pinning to one
  // connection for the whole batch sidesteps that race entirely.
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { userId: session.user.id } });

    const canDecide = isHR || (isManager && !!employee);
    const directReportIds =
      isManager && employee
        ? (
            await tx.employee.findMany({
              where: { reportingManagerId: employee.id },
              select: { id: true },
            })
          ).map((e) => e.id)
        : [];
    // Scope for "requests I can decide": org-wide for HR, direct-reports-
    // only for a manager (mirrors decideLeaveRequest/
    // decideAttendanceCorrection/decideResignationRequest's own
    // authorization checks, so the bell never shows something those
    // actions would then refuse). Always excludes the viewer's own
    // employeeId — shows up in `own` instead, never duplicated into
    // `actionable` even though HR deciding their own request isn't
    // blocked at the action layer (see decideLeaveRequest) — the two
    // sections are meant to stay mutually exclusive here regardless.
    const decideScope: { employeeId?: { not: string } | { in: string[] } } = isHR
      ? employee
        ? { employeeId: { not: employee.id } }
        : {}
      : { employeeId: { in: directReportIds } };

    const actionableLeave = canDecide
      ? await tx.leaveRequest.findMany({
          where: { status: "PENDING", ...decideScope },
          include: { employee: true, leaveType: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    const actionableAttendance = canDecide
      ? await tx.attendanceCorrectionRequest.findMany({
          where: { status: "PENDING", ...decideScope },
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    const actionableResignation = canDecide
      ? await tx.resignationRequest.findMany({
          where: { status: "PENDING", ...decideScope },
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const ownLeave = employee
      ? await tx.leaveRequest.findMany({
          where: { status: "PENDING", employeeId: employee.id },
          include: { leaveType: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    const ownAttendance = employee
      ? await tx.attendanceCorrectionRequest.findMany({
          where: { status: "PENDING", employeeId: employee.id },
          orderBy: { createdAt: "asc" },
        })
      : [];
    const ownResignation = employee
      ? await tx.resignationRequest.findMany({
          where: { status: "PENDING", employeeId: employee.id },
          orderBy: { createdAt: "asc" },
        })
      : [];

    // Not factored into a shared object: each model's `status.in` wants
    // its own distinct enum type, and one plain object typed loosely
    // enough to satisfy all three no longer satisfies any of them.
    const decidedLeave = employee
      ? await tx.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            status: { in: ["APPROVED", "REJECTED"] },
            decidedAt: { gte: recentSince },
          },
          include: { leaveType: true },
          orderBy: { decidedAt: "desc" },
        })
      : [];
    const decidedAttendance = employee
      ? await tx.attendanceCorrectionRequest.findMany({
          where: {
            employeeId: employee.id,
            status: { in: ["APPROVED", "REJECTED"] },
            decidedAt: { gte: recentSince },
          },
          orderBy: { decidedAt: "desc" },
        })
      : [];
    const decidedResignation = employee
      ? await tx.resignationRequest.findMany({
          where: {
            employeeId: employee.id,
            status: { in: ["APPROVED", "REJECTED"] },
            decidedAt: { gte: recentSince },
          },
          orderBy: { decidedAt: "desc" },
        })
      : [];

    const actionable: NotificationItem[] = [
      ...actionableLeave.map((r) => ({
        id: `leave-${r.id}`,
        label: `${r.employee.fullName} — ${r.leaveType.name}: ${r.days} day(s)`,
        href: "/dashboard/leave",
        timestamp: r.createdAt,
      })),
      ...actionableAttendance.map((r) => ({
        id: `attendance-${r.id}`,
        label: `${r.employee.fullName} — Attendance correction: ${fmtDate(r.date)} → ${r.requestedStatus}`,
        href: "/dashboard/attendance",
        timestamp: r.createdAt,
      })),
      ...actionableResignation.map((r) => ({
        id: `resignation-${r.id}`,
        label: `${r.employee.fullName} — Resignation: ${fmtDate(r.resignationDate)}`,
        href: "/dashboard/exit",
        timestamp: r.createdAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const own: NotificationItem[] = [
      ...ownLeave.map((r) => ({
        id: `leave-${r.id}`,
        label: `${r.leaveType.name}: ${r.days} day(s) — awaiting decision`,
        href: "/dashboard/leave",
        timestamp: r.createdAt,
      })),
      ...ownAttendance.map((r) => ({
        id: `attendance-${r.id}`,
        label: `Attendance correction (${fmtDate(r.date)}) — awaiting decision`,
        href: "/dashboard/attendance",
        timestamp: r.createdAt,
      })),
      ...ownResignation.map((r) => ({
        id: `resignation-${r.id}`,
        label: `Resignation (${fmtDate(r.resignationDate)}) — awaiting decision`,
        href: "/dashboard/exit",
        timestamp: r.createdAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const recentUpdates: NotificationItem[] = [
      ...decidedLeave.map((r) => ({
        id: `leave-decided-${r.id}`,
        label: `${r.leaveType.name}: ${r.days} day(s) — ${decisionWord(r.status)}`,
        href: "/dashboard/leave",
        timestamp: r.decidedAt!,
      })),
      ...decidedAttendance.map((r) => ({
        id: `attendance-decided-${r.id}`,
        label: `Attendance correction (${fmtDate(r.date)}) — ${decisionWord(r.status)}`,
        href: "/dashboard/attendance",
        timestamp: r.decidedAt!,
      })),
      ...decidedResignation.map((r) => ({
        id: `resignation-decided-${r.id}`,
        label: `Resignation (${fmtDate(r.resignationDate)}) — ${decisionWord(r.status)}`,
        href: "/dashboard/exit",
        timestamp: r.decidedAt!,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { actionable, own, recentUpdates };
  });
}
