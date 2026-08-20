import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { AddAssetForm } from "./add-asset-form";
import { AssetRow } from "./asset-row";

export default async function AssetsPage() {
  await requireRoleForPage(...HR_WRITE_ROLES);

  const [assets, employees] = await Promise.all([
    prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
      include: { assignedEmployee: { select: { employeeCode: true, fullName: true } } },
    }),
    prisma.employee.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Assets</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        PRD §26. Deliberately minimal — enough to make an exit&apos;s
        &quot;Asset Return&quot; step real, not a full asset-management module.
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
              <AssetRow key={a.id} asset={a} employees={employees} />
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
