import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// Next.js 16 renamed the "middleware" file convention to "proxy" — this is
// intentionally named `proxy.ts`, not `middleware.ts`. See:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// This only gates page navigation. Every Server Action / data-access
// function must ALSO call requireRole()/requireSession() from src/lib/rbac.ts
// — Next's own docs warn a proxy matcher can silently stop covering a route
// after a refactor, so it must never be the only check.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboardRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboardRoute && !isLoggedIn) {
    const signInUrl = new URL("/sign-in", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
