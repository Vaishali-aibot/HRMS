import { HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { ImportEmployeesForm } from "./import-form";

export default async function ImportEmployeesPage() {
  await requireRoleForPage(...HR_WRITE_ROLES);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an Excel file with a &quot;Dotkonnekt&quot; sheet (columns: Name, Email, PAN,
          Title, Department, Manager, Date of Birth, Date of Joining). You&apos;ll review every
          row — including anything that looks like it already exists — before anything is
          saved.
        </p>
      </div>
      <ImportEmployeesForm />
    </div>
  );
}
