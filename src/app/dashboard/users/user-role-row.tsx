"use client";

import { useActionState } from "react";

import { changeUserRole, type ChangeUserRoleState } from "@/lib/actions/user-role";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/types/next-auth";

const initialState: ChangeUserRoleState = {};

const ROLES: AppRole[] = ["HR_ADMIN", "HR_EXECUTIVE", "MANAGER", "EMPLOYEE", "MANAGEMENT"];

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function UserRoleRow({
  user,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: AppRole;
    employee: { employeeCode: string; fullName: string } | null;
  };
}) {
  const [state, formAction, pending] = useActionState(changeUserRole, initialState);

  return (
    <tr className="border-t border-black/10 align-top dark:border-white/10">
      <td className="px-4 py-2">{user.name ?? "—"}</td>
      <td className="px-4 py-2">{user.email}</td>
      <td className="px-4 py-2">
        {user.employee ? `${user.employee.employeeCode} — ${user.employee.fullName}` : "—"}
      </td>
      <td className="px-4 py-2">
        <form action={formAction} className="flex items-center gap-2">
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
            disabled={pending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
        {state.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </td>
    </tr>
  );
}
