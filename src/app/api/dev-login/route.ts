import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

// DEV-ONLY: mints a database session for a test account and sets the session
// cookie directly, bypassing Microsoft OAuth. This lets a human click through
// the app locally without a real dotkonnekt.com Microsoft account. Refuses to
// run outside development.
//
// Usage: /api/dev-login (defaults to the HR_ADMIN test account) or
// /api/dev-login?email=<email> for any other test account.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get("email") ?? "hr-admin-test@example.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `Test user ${email} not found` }, { status: 404 });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  const response = NextResponse.redirect(new URL("/dashboard", "http://localhost:3000"));
  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return response;
}
