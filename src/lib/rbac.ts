import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { AppRole } from "@/types/next-auth";

// Server-only guards. Pure role constants/labels live in src/lib/roles.ts —
// import from there instead in any "use client" file (see the comment on
// that file for why: this module's auth()/Prisma chain must never end up
// in a client bundle).
export { HR_VIEW_ROLES, HR_WRITE_ROLES, ROLE_LABELS } from "@/lib/roles";

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
