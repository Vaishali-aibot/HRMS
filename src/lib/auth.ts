import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

// NOTE: @auth/prisma-adapter's TypeScript signature expects a PrismaClient
// imported from the default "@prisma/client" path. We generate the client to
// a custom output (required by Prisma 7 driver adapters), so the shape
// matches at runtime but not by declared type identity — hence the cast.
// If you upgrade either package, re-check this still type-checks/compiles.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as never),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  session: {
    // Database sessions (vs. JWT) so HR can revoke a session immediately
    // (delete the row) — useful for an HR system's audit/security posture.
    strategy: "database",
  },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: string }).role as
          | "HR_ADMIN"
          | "HR_EXECUTIVE"
          | "MANAGER"
          | "EMPLOYEE"
          | "MANAGEMENT";
      }
      return session;
    },
  },
});
