"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

export type EmployeeAssetActionState = { error?: string };

const CATEGORIES = ["LAPTOP", "CHARGER", "MONITOR", "OTHER"] as const;

// Fields not relevant to the selected category (e.g. `ram` when adding a
// charger) aren't rendered at all, so formData.get() returns null rather
// than "" for them — both need to fall through to undefined for an
// .optional() field, not just the empty-string case.
const emptyToUndefined = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? undefined : v;

const saveSchema = z.object({
  category: z.enum(CATEGORIES),
  brand: z.preprocess(emptyToUndefined, z.string().optional()),
  model: z.preprocess(emptyToUndefined, z.string().optional()),
  serialNumber: z.preprocess(emptyToUndefined, z.string().optional()),
  processor: z.preprocess(emptyToUndefined, z.string().optional()),
  ram: z.preprocess(emptyToUndefined, z.string().optional()),
  operatingSystem: z.preprocess(emptyToUndefined, z.string().optional()),
  assetTag: z.preprocess(emptyToUndefined, z.string().optional()),
  otherDescription: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
});

function parseFormData(formData: FormData) {
  return saveSchema.safeParse({
    category: formData.get("category"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    processor: formData.get("processor"),
    ram: formData.get("ram"),
    operatingSystem: formData.get("operatingSystem"),
    assetTag: formData.get("assetTag"),
    otherDescription: formData.get("otherDescription"),
    notes: formData.get("notes"),
  });
}

/** Resolves the Employee record for the signed-in user, or an error state. */
async function currentEmployee() {
  const session = await requireSession();
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    throw new Error("Your account isn't linked to an employee record yet — contact HR.");
  }
  return employee;
}

export async function addMyAsset(
  _prevState: EmployeeAssetActionState,
  formData: FormData
): Promise<EmployeeAssetActionState> {
  let employee;
  try {
    employee = await currentEmployee();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "You must be signed in to do this." };
  }

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.employeeAsset.create({
      data: { employeeId: employee.id, ...parsed.data },
    });
  } catch (err) {
    console.error("addMyAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/my-assets");
  revalidatePath("/dashboard/assets");
  return {};
}

export async function updateMyAsset(
  _prevState: EmployeeAssetActionState,
  formData: FormData
): Promise<EmployeeAssetActionState> {
  let employee;
  try {
    employee = await currentEmployee();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "You must be signed in to do this." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid request." };
  }

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    // Scope the update to this employee's own rows via a compound where —
    // an id belonging to someone else simply matches zero rows rather than
    // needing a separate ownership check before the write.
    const { count } = await prisma.employeeAsset.updateMany({
      where: { id, employeeId: employee.id },
      data: parsed.data,
    });
    if (count === 0) {
      return { error: "Asset entry not found." };
    }
  } catch (err) {
    console.error("updateMyAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/my-assets");
  revalidatePath("/dashboard/assets");
  return {};
}

export async function deleteMyAsset(
  _prevState: EmployeeAssetActionState,
  formData: FormData
): Promise<EmployeeAssetActionState> {
  let employee;
  try {
    employee = await currentEmployee();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "You must be signed in to do this." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid request." };
  }

  try {
    const { count } = await prisma.employeeAsset.deleteMany({
      where: { id, employeeId: employee.id },
    });
    if (count === 0) {
      return { error: "Asset entry not found." };
    }
  } catch (err) {
    console.error("deleteMyAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/my-assets");
  revalidatePath("/dashboard/assets");
  return {};
}
