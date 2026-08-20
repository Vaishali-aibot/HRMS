// Plain constant, not a Server Action — kept out of exit.ts specifically
// because a "use server" file may only export async functions (Next.js
// rejects any other export, e.g. a plain array, at build/dev time).
export const NOT_EXITABLE_STATUSES = ["NOTICE_PERIOD", "EXITED", "ALUMNI"] as const;
