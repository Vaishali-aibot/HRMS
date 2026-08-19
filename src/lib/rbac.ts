import { auth } from "@/lib/auth";
import type { AppRole } from "@/types/next-auth";

/**
 * Server-side role guard for Server Components and Server Actions.
 *
 * The proxy (src/proxy.ts) keeps signed-out users out of /dashboard, but per
 * Next.js's own guidance, a network-layer gate is not a substitute for
 * checking authorization inside each Server Action / data-access function —
 * so every mutating action should call this (or requireAnyRole) itself.
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

export const ROLE_LABELS: Record<AppRole, string> = {
  HR_ADMIN: "HR Admin",
  HR_EXECUTIVE: "HR Executive",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  MANAGEMENT: "Management",
};
