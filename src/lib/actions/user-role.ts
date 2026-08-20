"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const ROLE_VALUES = ["HR_ADMIN", "HR_EXECUTIVE", "MANAGER", "EMPLOYEE", "MANAGEMENT"] as const;

const changeUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLE_VALUES),
});

export type ChangeUserRoleState = { error?: string };

export async function changeUserRole(
  _prevState: ChangeUserRoleState,
  formData: FormData
): Promise<ChangeUserRoleState> {
  let session;
  try {
    // Role assignment is deliberately HR_ADMIN-only (PRD §4.1 — "Manage
    // employee access" is listed under HR Admin, not HR Executive), unlike
    // most other mutations here which allow both.
    session = await requireRole("HR_ADMIN");
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = changeUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { userId, role } = parsed.data;

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return { error: "User not found." };
    }
    if (target.role === role) {
      return { error: "User already has that role." };
    }

    // Prevent locking everyone out of admin: don't allow the last HR_ADMIN
    // to be demoted (including demoting themselves) until someone else
    // holds the role.
    if (target.role === "HR_ADMIN" && role !== "HR_ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "HR_ADMIN" } });
      if (adminCount <= 1) {
        return { error: "Cannot remove the last HR Admin — promote someone else first." };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role } });
      await tx.auditLog.create({
        data: {
          entityType: "User",
          entityId: userId,
          field: "role",
          oldValue: target.role,
          newValue: role,
          changedById: session.user.id,
        },
      });
    });
  } catch (err) {
    console.error("changeUserRole failed:", err);
    return { error: "Something went wrong while updating the role. Please try again." };
  }

  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}
