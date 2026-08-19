import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRoleForPage } from "@/lib/rbac";

import { NewEmployeeForm } from "./employee-form";

export default async function NewEmployeePage() {
  await requireRoleForPage(...HR_WRITE_ROLES);

  // Populates the reporting-manager <select> with real Employee.id values —
  // the form must never accept a free-text "employee ID" for this field,
  // since that's a foreign key to the internal id, not the human-readable
  // employeeCode HR sees elsewhere in the UI.
  const potentialManagers = await prisma.employee.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, employeeCode: true, fullName: true },
  });

  return <NewEmployeeForm potentialManagers={potentialManagers} />;
}
