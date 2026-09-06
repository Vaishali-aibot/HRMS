"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import { changeUserRole, type ChangeUserRoleState } from "@/lib/actions/user-role";
import { linkUserToEmployee, type LinkEmployeeState } from "@/lib/actions/user-role";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/types/next-auth";

const initialRoleState: ChangeUserRoleState = {};
const initialLinkState: LinkEmployeeState = {};

const ROLES: AppRole[] = ["HR_ADMIN", "HR_EXECUTIVE", "MANAGER", "EMPLOYEE", "MANAGEMENT"];

type EmployeeOption = { id: string; employeeCode: string; fullName: string };

export function UserRoleRow({
  user,
  availableEmployees,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: AppRole;
    employee: { id: string; employeeCode: string; fullName: string } | null;
  };
  availableEmployees: EmployeeOption[];
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeUserRole, initialRoleState);
  const [linkState, linkAction, linkPending] = useActionState(linkUserToEmployee, initialLinkState);

  return (
    <TableRow>
      <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <form action={linkAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <NativeSelect
            name="employeeId"
            defaultValue={user.employee?.id ?? ""}
            className="h-7 w-44 text-xs"
          >
            <option value="">— Not linked —</option>
            {availableEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.fullName}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="xs" disabled={linkPending}>
            {linkPending ? "Saving…" : "Save"}
          </Button>
        </form>
        {linkState.error && <p className="mt-1 text-xs text-destructive">{linkState.error}</p>}
      </TableCell>
      <TableCell>
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <NativeSelect name="role" defaultValue={user.role} className="h-7 w-32 text-xs">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="xs" disabled={rolePending}>
            {rolePending ? "Saving…" : "Save"}
          </Button>
        </form>
        {roleState.error && <p className="mt-1 text-xs text-destructive">{roleState.error}</p>}
      </TableCell>
    </TableRow>
  );
}
