import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { AddAssetForm } from "./add-asset-form";
import { AssetRow } from "./asset-row";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function AssetsPage() {
  await requireRoleForPage(...HR_WRITE_ROLES);

  const [assets, employees] = await Promise.all([
    prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignedEmployee: { select: { employeeCode: true, fullName: true } },
        history: { orderBy: { occurredAt: "desc" }, take: 10 },
      },
    }),
    prisma.employee.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);
  const employeeNameById = new Map(employees.map((e) => [e.id, `${e.employeeCode} — ${e.fullName}`]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PRD §26 — register, assign, and track condition/damage history over
          an asset&apos;s lifecycle (assigned, returned, condition updates,
          retired, lost).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((a) => (
              <AssetRow
                // Keyed on status too — see the same reasoning on
                // CycleRow/GoalRow in src/app/dashboard/performance/page.tsx:
                // an uncontrolled input/select doesn't re-sync its displayed
                // value on a revalidatePath re-render unless remounted.
                key={`${a.id}:${a.status}`}
                asset={{
                  ...a,
                  history: a.history.map((h) => ({
                    id: h.id,
                    action: h.action,
                    condition: h.condition,
                    notes: h.notes,
                    occurredAt: fmt(h.occurredAt),
                    employeeName: h.employeeId ? employeeNameById.get(h.employeeId) ?? null : null,
                  })),
                }}
                employees={employees}
              />
            ))}
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No assets yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Add an asset</h2>
        <div className="mt-2">
          <AddAssetForm />
        </div>
      </div>
    </div>
  );
}
