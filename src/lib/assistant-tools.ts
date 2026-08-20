import type { Tool } from "@anthropic-ai/sdk/resources/messages";

import { prisma } from "@/lib/prisma";
import { HR_VIEW_ROLES, HR_WRITE_ROLES } from "@/lib/rbac";
import type { AppRole } from "@/types/next-auth";

// ---------------------------------------------------------------------------
// AI assistant tools (PRD §40). Every tool here is READ-ONLY and checks the
// caller's role itself before returning anything — the model never gets a
// raw database/SQL escape hatch, only these fixed, vetted functions, same
// defense-in-depth principle as every Server Action in this app checking
// its own permissions rather than trusting the UI to have already checked.
//
// Deliberately never returned, regardless of role: compensation
// (ctcAnnual) or statutory/bank fields (panNumber, aadhaarNumber, uan,
// bankAccountNumber, bankIfsc). This is stricter than what a human HR_ADMIN
// can see on /dashboard/employees/[id] — an extra margin specifically
// because this surface hands data to an LLM API, a different trust
// boundary than a page only a signed-in browser renders.
// ---------------------------------------------------------------------------

type CallerSession = { user: { id: string; role: AppRole } };

async function getCallerEmployee(session: CallerSession) {
  return prisma.employee.findUnique({ where: { userId: session.user.id } });
}

export const ASSISTANT_TOOLS: Tool[] = [
  {
    name: "get_my_profile",
    description:
      "Get the current user's own employee profile: name, employee code, department, designation, lifecycle status, date of joining, and reporting manager's name. Use for questions like 'what's my status' or 'who's my manager'. Never returns compensation or statutory/bank details.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_leave_balances",
    description:
      "Get the current user's own leave balances for the current year: leave type name, allocated days, used days, encashed days, and remaining days.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_pending_requests",
    description:
      "Get the current user's own pending requests awaiting a decision: leave, work-from-home, resignation, attendance correction, and leave encashment requests.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_team_pending_approvals",
    description:
      "Get pending requests (leave, work-from-home, resignation, attendance correction, leave encashment) that the current user can approve or reject — their direct reports' if they're a manager, or every pending request org-wide if they're HR. Returns an error if the current user has neither permission.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_org_headcount",
    description:
      "Get org-wide headcount broken down by department and by lifecycle status. HR/management only — returns an error for anyone else.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_employees",
    description:
      "Search for employees by name or employee code (case-insensitive, partial match). Returns up to 10 matches with employee code, name, department, designation, lifecycle status, date of joining, and reporting manager's name. HR/management only — returns an error for anyone else. Never returns compensation or statutory/bank details.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Name or employee code to search for" } },
      required: ["query"],
    },
  },
  {
    name: "get_hr_helpdesk_summary",
    description:
      "Get HR helpdesk request counts by category and status, plus the average time to resolution in days. HR/management only — returns an error for anyone else.",
    input_schema: { type: "object", properties: {} },
  },
];

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Dispatches one tool call by name. Returns a plain JSON-serializable
 * value — success payload or `{ error: string }` — for the caller to pass
 * back to the model as the tool_result content. Never throws for an
 * expected condition (not found / forbidden); only for unexpected
 * failures, which the caller (askAssistant) catches around the whole loop. */
export async function runAssistantTool(
  name: string,
  input: unknown,
  session: CallerSession
): Promise<unknown> {
  switch (name) {
    case "get_my_profile": {
      const employee = await getCallerEmployee(session);
      if (!employee) return { error: "Your account isn't linked to an employee record." };
      const manager = employee.reportingManagerId
        ? await prisma.employee.findUnique({
            where: { id: employee.reportingManagerId },
            select: { fullName: true },
          })
        : null;
      return {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        department: employee.department,
        designation: employee.designation,
        status: employee.status,
        dateOfJoining: fmt(employee.dateOfJoining),
        reportingManagerName: manager?.fullName ?? null,
      };
    }

    case "get_my_leave_balances": {
      const employee = await getCallerEmployee(session);
      if (!employee) return { error: "Your account isn't linked to an employee record." };
      const balances = await prisma.leaveBalance.findMany({
        where: { employeeId: employee.id, year: new Date().getFullYear() },
        include: { leaveType: true },
      });
      return balances.map((b) => ({
        leaveType: b.leaveType.name,
        allocated: b.allocated,
        used: b.used,
        encashed: b.encashed,
        remaining: b.allocated - b.used - b.encashed,
      }));
    }

    case "get_my_pending_requests": {
      const employee = await getCallerEmployee(session);
      if (!employee) return { error: "Your account isn't linked to an employee record." };
      const [leave, wfh, resignation, correction, encashment] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: { employeeId: employee.id, status: "PENDING" },
          include: { leaveType: true },
        }),
        prisma.wFHRequest.findMany({ where: { employeeId: employee.id, status: "PENDING" } }),
        prisma.resignationRequest.findMany({ where: { employeeId: employee.id, status: "PENDING" } }),
        prisma.attendanceCorrectionRequest.findMany({
          where: { employeeId: employee.id, status: "PENDING" },
        }),
        prisma.leaveEncashmentRequest.findMany({
          where: { employeeId: employee.id, status: "PENDING" },
          include: { leaveType: true },
        }),
      ]);
      return {
        leave: leave.map((r) => ({
          type: r.leaveType.name,
          startDate: fmt(r.startDate),
          endDate: fmt(r.endDate),
          days: r.days,
        })),
        workFromHome: wfh.map((r) => ({ startDate: fmt(r.startDate), endDate: fmt(r.endDate) })),
        resignation: resignation.map((r) => ({
          resignationDate: fmt(r.resignationDate),
          noticePeriodDays: r.noticePeriodDays,
        })),
        attendanceCorrection: correction.map((r) => ({
          date: fmt(r.date),
          requestedStatus: r.requestedStatus,
        })),
        leaveEncashment: encashment.map((r) => ({ type: r.leaveType.name, days: r.days })),
      };
    }

    case "get_team_pending_approvals": {
      const isHR = HR_WRITE_ROLES.includes(session.user.role);
      const isManager = session.user.role === "MANAGER";
      if (!isHR && !isManager) {
        return { error: "The current user doesn't have permission to approve requests." };
      }
      const employee = await getCallerEmployee(session);
      if (isManager && !isHR && !employee) {
        return { error: "Your account isn't linked to an employee record." };
      }
      const scope = isHR
        ? {}
        : { employee: { reportingManagerId: employee!.id } };

      const [leave, wfh, resignation, correction, encashment] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: { status: "PENDING", ...scope },
          include: { employee: true, leaveType: true },
        }),
        prisma.wFHRequest.findMany({
          where: { status: "PENDING", ...scope },
          include: { employee: true },
        }),
        prisma.resignationRequest.findMany({
          where: { status: "PENDING", ...scope },
          include: { employee: true },
        }),
        prisma.attendanceCorrectionRequest.findMany({
          where: { status: "PENDING", ...scope },
          include: { employee: true },
        }),
        prisma.leaveEncashmentRequest.findMany({
          where: { status: "PENDING", ...scope },
          include: { employee: true, leaveType: true },
        }),
      ]);
      return {
        leave: leave.map((r) => ({
          employeeName: r.employee.fullName,
          type: r.leaveType.name,
          startDate: fmt(r.startDate),
          endDate: fmt(r.endDate),
          days: r.days,
        })),
        workFromHome: wfh.map((r) => ({
          employeeName: r.employee.fullName,
          startDate: fmt(r.startDate),
          endDate: fmt(r.endDate),
        })),
        resignation: resignation.map((r) => ({
          employeeName: r.employee.fullName,
          resignationDate: fmt(r.resignationDate),
        })),
        attendanceCorrection: correction.map((r) => ({
          employeeName: r.employee.fullName,
          date: fmt(r.date),
          requestedStatus: r.requestedStatus,
        })),
        leaveEncashment: encashment.map((r) => ({
          employeeName: r.employee.fullName,
          type: r.leaveType.name,
          days: r.days,
        })),
      };
    }

    case "get_org_headcount": {
      if (!HR_VIEW_ROLES.includes(session.user.role)) {
        return { error: "The current user doesn't have permission to view org-wide data." };
      }
      const [byDepartment, byStatus] = await Promise.all([
        prisma.employee.groupBy({ by: ["department"], _count: { _all: true } }),
        prisma.employee.groupBy({ by: ["status"], _count: { _all: true } }),
      ]);
      return {
        byDepartment: byDepartment.map((g) => ({ department: g.department, count: g._count._all })),
        byStatus: byStatus.map((g) => ({ status: g.status, count: g._count._all })),
      };
    }

    case "search_employees": {
      if (!HR_VIEW_ROLES.includes(session.user.role)) {
        return { error: "The current user doesn't have permission to search employees." };
      }
      const query = typeof (input as { query?: unknown })?.query === "string"
        ? (input as { query: string }).query
        : "";
      if (!query.trim()) return { error: "Provide a name or employee code to search for." };

      const matches = await prisma.employee.findMany({
        where: {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { employeeCode: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { reportingManager: { select: { fullName: true } } },
        take: 10,
      });
      return matches.map((e) => ({
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        department: e.department,
        designation: e.designation,
        status: e.status,
        dateOfJoining: fmt(e.dateOfJoining),
        reportingManagerName: e.reportingManager?.fullName ?? null,
      }));
    }

    case "get_hr_helpdesk_summary": {
      if (!HR_VIEW_ROLES.includes(session.user.role)) {
        return { error: "The current user doesn't have permission to view HR helpdesk data." };
      }
      const [byCategory, resolved] = await Promise.all([
        prisma.hRRequest.groupBy({ by: ["category", "status"], _count: { _all: true } }),
        prisma.hRRequest.findMany({
          where: { resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        }),
      ]);
      const avgResolutionDays =
        resolved.length > 0
          ? Math.round(
              (resolved.reduce(
                (sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 86400000,
                0
              ) /
                resolved.length) *
                10
            ) / 10
          : null;
      return {
        byCategoryAndStatus: byCategory.map((g) => ({
          category: g.category,
          status: g.status,
          count: g._count._all,
        })),
        averageResolutionDays: avgResolutionDays,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
