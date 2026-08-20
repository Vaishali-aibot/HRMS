"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";

export type WFHPolicyState = { error?: string };

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;

const updateSchema = z.object({
  maxDaysPerMonth: z.coerce.number().int().nonnegative().optional(),
  maxDaysPerYear: z.coerce.number().int().nonnegative().optional(),
  allowedLocations: z.string().optional().or(z.literal("")),
});

/** Singleton config — always upserts the one `id: "default"` row. Empty
 * employment-type selection / empty location list means "no restriction",
 * not "nobody eligible" — see the schema comment on WFHPolicy. */
export async function updateWFHPolicy(
  _prevState: WFHPolicyState,
  formData: FormData
): Promise<WFHPolicyState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = updateSchema.safeParse({
    maxDaysPerMonth: formData.get("maxDaysPerMonth") || undefined,
    maxDaysPerYear: formData.get("maxDaysPerYear") || undefined,
    allowedLocations: formData.get("allowedLocations") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const eligibleEmploymentTypes = EMPLOYMENT_TYPES.filter(
    (t) => formData.get(`eligible_${t}`) !== null
  );
  const allowedLocations = (parsed.data.allowedLocations ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await prisma.wFHPolicy.upsert({
      where: { id: "default" },
      update: {
        maxDaysPerMonth: parsed.data.maxDaysPerMonth ?? null,
        maxDaysPerYear: parsed.data.maxDaysPerYear ?? null,
        eligibleEmploymentTypes,
        allowedLocations,
      },
      create: {
        id: "default",
        maxDaysPerMonth: parsed.data.maxDaysPerMonth ?? null,
        maxDaysPerYear: parsed.data.maxDaysPerYear ?? null,
        eligibleEmploymentTypes,
        allowedLocations,
      },
    });
  } catch (err) {
    console.error("updateWFHPolicy failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/wfh");
  return {};
}
