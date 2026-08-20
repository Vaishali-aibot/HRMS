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
    <div>
      <h1 className="text-xl font-semibold">Assets</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        PRD §26 — register, assign, and track condition/damage history over
        an asset&apos;s lifecycle (assigned, returned, condition updates,
        retired, lost).
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Asset ID</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
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
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/50 dark:text-white/50">
                  No assets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Add an asset</h2>
        <div className="mt-2">
          <AddAssetForm />
        </div>
      </div>
    </div>
  );
}
