import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AddMyAssetForm } from "./add-my-asset-form";
import { MyAssetCard } from "./my-asset-card";

export default async function MyAssetsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My assets</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet — contact HR.
        </p>
      </div>
    );
  }

  const assets = await prisma.employeeAsset.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">My assets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Log the company equipment you have — laptop, charger, monitor, or anything else. HR can see
        what you enter here from the Assets page.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {assets.map((a) => (
          <MyAssetCard key={a.id} asset={a} />
        ))}
        {assets.length === 0 && (
          <p className="text-sm text-muted-foreground">You haven&apos;t added any assets yet.</p>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Add an item</h2>
        <div className="mt-2">
          <AddMyAssetForm />
        </div>
      </div>
    </div>
  );
}
