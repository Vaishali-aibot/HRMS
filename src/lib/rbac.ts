import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { AppRole } from "@/types/next-auth";

/**
 * Server-side role guard for Server Actions / data-mutation functions.
 *
 * The proxy (src/proxy.ts) keeps signed-out users out of /dashboard, but per
 * Next.js's own guidance, a network-layer gate is not a substitute for
 * checking authorization inside each Server Action / data-access function —
 * so every mutating action should call this (or requireSession) itself.
 *
 * Throws on failure — callers in a Server Action should catch this and
 * return a friendly `{ error }` state rather than let it crash uncaught.
 */
export async function requireRole(...allowed: AppRole[]) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  if (!allowed.includes(session.user.role)) {
    throw new Error(
      `Forbidden: role ${session.user.role} is not permitted to perform this action`
    );
  }
  return session;
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session;
}

/**
 * Server-side role guard for pages (Server Components). Unlike requireRole,
 * this never throws into a render — it redirects, which is what you want
 * for a page a user navigated to rather than a form they submitted.
 */
export async function requireRoleForPage(...allowed: AppRole[]) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!allowed.includes(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}

/** Roles that can see org-wide HR data (full roster, HR metrics, reports). */
export const HR_VIEW_ROLES: AppRole[] = ["HR_ADMIN", "HR_EXECUTIVE", "MANAGEMENT"];

/** Roles that can create/edit Employee Master records. */
export const HR_WRITE_ROLES: AppRole[] = ["HR_ADMIN", "HR_EXECUTIVE"];

export const ROLE_LABELS: Record<AppRole, string> = {
  HR_ADMIN: "HR Admin",
  HR_EXECUTIVE: "HR Executive",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  MANAGEMENT: "Management",
};
