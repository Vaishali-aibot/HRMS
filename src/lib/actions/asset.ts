"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import type { Prisma } from "@/generated/prisma/client";

export type AssetActionState = { error?: string };

async function nextAssetCode(tx: Prisma.TransactionClient) {
  const counter = await tx.counter.upsert({
    where: { name: "assetCode" },
    update: { value: { increment: 1 } },
    create: { name: "assetCode", value: 1 },
  });
  return `AST-${String(counter.value).padStart(4, "0")}`;
}

const createSchema = z.object({
  type: z.string().min(1, "Type is required"),
  serialNumber: z.string().optional().or(z.literal("")),
});

export async function createAsset(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = createSchema.safeParse({
    type: formData.get("type"),
    serialNumber: formData.get("serialNumber"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const assetCode = await nextAssetCode(tx);
      await tx.asset.create({
        data: {
          assetCode,
          type: parsed.data.type,
          serialNumber: parsed.data.serialNumber || undefined,
          status: "AVAILABLE",
        },
      });
    });
  } catch (err) {
    console.error("createAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/assets");
  return {};
}

const ASSIGNABLE_STATUSES = ["AVAILABLE", "RETURNED"] as const;

const assignSchema = z.object({
  assetId: z.string().min(1),
  employeeId: z.string().min(1, "Choose an employee"),
});

export async function assignAsset(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = assignSchema.safeParse({
    assetId: formData.get("assetId"),
    employeeId: formData.get("employeeId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId } });
    if (!asset) {
      return { error: "Asset not found." };
    }
    if (!ASSIGNABLE_STATUSES.includes(asset.status as (typeof ASSIGNABLE_STATUSES)[number])) {
      return { error: `This asset isn't available to assign (status: ${asset.status}).` };
    }

    await prisma.$transaction([
      prisma.asset.update({
        where: { id: parsed.data.assetId },
        data: {
          assignedEmployeeId: parsed.data.employeeId,
          status: "ASSIGNED",
          issueDate: new Date(),
          returnDate: null,
        },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: parsed.data.assetId,
          action: "ASSIGNED",
          employeeId: parsed.data.employeeId,
          performedById: session.user.id,
        },
      }),
    ]);
  } catch (err) {
    console.error("assignAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/assets");
  return {};
}

const returnSchema = z.object({
  assetId: z.string().min(1),
  condition: z.string().optional().or(z.literal("")),
});

export async function returnAsset(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = returnSchema.safeParse({
    assetId: formData.get("assetId"),
    condition: formData.get("condition"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId } });
    if (!asset) {
      return { error: "Asset not found." };
    }
    if (asset.status !== "ASSIGNED") {
      return { error: "This asset isn't currently assigned." };
    }

    // assignedEmployeeId is deliberately kept (not nulled) — it's "last
    // assigned to", useful history. Reassigning to someone else overwrites
    // it via assignAsset above.
    await prisma.$transaction([
      prisma.asset.update({
        where: { id: parsed.data.assetId },
        data: {
          status: "RETURNED",
          returnDate: new Date(),
          condition: parsed.data.condition || undefined,
        },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: parsed.data.assetId,
          action: "RETURNED",
          employeeId: asset.assignedEmployeeId,
          condition: parsed.data.condition || undefined,
          performedById: session.user.id,
        },
      }),
    ]);
  } catch (err) {
    console.error("returnAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/assets");
  return {};
}

const conditionSchema = z.object({
  assetId: z.string().min(1),
  condition: z.string().min(1, "Condition is required"),
  notes: z.string().optional().or(z.literal("")),
});

/** Log a condition/damage note without changing assignment or status —
 * e.g. a periodic check on equipment that's still in active use. */
export async function updateAssetCondition(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = conditionSchema.safeParse({
    assetId: formData.get("assetId"),
    condition: formData.get("condition"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId } });
    if (!asset) {
      return { error: "Asset not found." };
    }

    await prisma.$transaction([
      prisma.asset.update({
        where: { id: parsed.data.assetId },
        data: { condition: parsed.data.condition },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: parsed.data.assetId,
          action: "CONDITION_UPDATED",
          employeeId: asset.assignedEmployeeId,
          condition: parsed.data.condition,
          notes: parsed.data.notes || undefined,
          performedById: session.user.id,
        },
      }),
    ]);
  } catch (err) {
    console.error("updateAssetCondition failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/assets");
  return {};
}

const lifecycleSchema = z.object({
  assetId: z.string().min(1),
  notes: z.string().optional().or(z.literal("")),
});

/** Permanently retire an asset (end of life) — no further assignment. */
export async function retireAsset(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  return setAssetLifecycleStatus(formData, "RETIRED");
}

/** Mark an asset lost — same "no further assignment" end state as retired,
 * kept as a distinct status/history action since the reason matters for
 * reporting (loss vs. planned end-of-life). */
export async function reportAssetLost(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  return setAssetLifecycleStatus(formData, "LOST");
}

async function setAssetLifecycleStatus(
  formData: FormData,
  status: "RETIRED" | "LOST"
): Promise<AssetActionState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = lifecycleSchema.safeParse({
    assetId: formData.get("assetId"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId } });
    if (!asset) {
      return { error: "Asset not found." };
    }
    if (asset.status === "RETIRED" || asset.status === "LOST") {
      return { error: "This asset is already retired or lost." };
    }

    await prisma.$transaction([
      prisma.asset.update({ where: { id: parsed.data.assetId }, data: { status } }),
      prisma.assetHistory.create({
        data: {
          assetId: parsed.data.assetId,
          action: status,
          employeeId: asset.assignedEmployeeId,
          notes: parsed.data.notes || undefined,
          performedById: session.user.id,
        },
      }),
    ]);
  } catch (err) {
    console.error("setAssetLifecycleStatus failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/assets");
  return {};
}
