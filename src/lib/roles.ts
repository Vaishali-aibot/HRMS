// Pure constants/types only — no imports of auth.ts/prisma.ts. This file is
// safe to import from Client Components. rbac.ts (server-only: auth(),
// Prisma) re-exports these for server-side callers, but a "use client"
// file must import directly from here, or the whole auth/Prisma/pg module
// graph gets bundled into client JS (pg needs Node built-ins like `tls`
// that don't exist in the browser — this broke the build once already).
import type { AppRole } from "@/types/next-auth";

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
