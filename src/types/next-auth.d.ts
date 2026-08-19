import type { DefaultSession } from "next-auth";

export type AppRole =
  | "HR_ADMIN"
  | "HR_EXECUTIVE"
  | "MANAGER"
  | "EMPLOYEE"
  | "MANAGEMENT";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}
