"use client";

import { useActionState } from "react";

import { changeUserRole, type ChangeUserRoleState } from "@/lib/actions/user-role";
import { linkUserToEmployee, type LinkEmployeeState } from "@/lib/actions/user-role";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/types/next-auth";

const initialRoleState: ChangeUserRoleState = {};
const initialLinkState: LinkEmployeeState = {};

const ROLES: AppRole[] = ["HR_ADMIN", "HR_EXECUTIVE", "MANAGER", "EMPLOYEE", "MANAGEMENT"];

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

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
    <tr className="border-t border-black/10 align-top dark:border-white/10">
      <td className="px-4 py-2">{user.name ?? "—"}</td>
      <td className="px-4 py-2">{user.email}</td>
      <td className="px-4 py-2">
        <form action={linkAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <select name="employeeId" defaultValue={user.employee?.id ?? ""} className={inputClass}>
            <option value="">— Not linked —</option>
            {availableEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.fullName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={linkPending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {linkPending ? "Saving…" : "Save"}
          </button>
        </form>
        {linkState.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{linkState.error}</p>
        )}
      </td>
      <td className="px-4 py-2">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <select name="role" defaultValue={user.role} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={rolePending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {rolePending ? "Saving…" : "Save"}
          </button>
        </form>
        {roleState.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{roleState.error}</p>
        )}
      </td>
    </tr>
  );
}
