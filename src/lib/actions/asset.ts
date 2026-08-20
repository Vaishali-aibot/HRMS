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
  try {
    await requireRole(...HR_WRITE_ROLES);
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

    await prisma.asset.update({
      where: { id: parsed.data.assetId },
      data: {
        assignedEmployeeId: parsed.data.employeeId,
        status: "ASSIGNED",
        issueDate: new Date(),
        returnDate: null,
      },
    });
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
  try {
    await requireRole(...HR_WRITE_ROLES);
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
    await prisma.asset.update({
      where: { id: parsed.data.assetId },
      data: {
        status: "RETURNED",
        returnDate: new Date(),
        condition: parsed.data.condition || undefined,
      },
    });
  } catch (err) {
    console.error("returnAsset failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/assets");
  return {};
}
