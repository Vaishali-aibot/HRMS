import Image from "next/image";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  // Never trust callbackUrl as-is — it's an attacker-controllable query
  // param, and an unvalidated value here is an open redirect (CWE-601).
  const destination = safeRedirectPath(callbackUrl, "/dashboard");

  if (session?.user) {
    redirect(destination);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary/5 via-background to-background p-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <Image
          src="/logo.png"
          alt="dotkonnekt"
          width={328}
          height={164}
          className="mx-auto h-auto w-40"
          priority
        />
        <h1 className="mt-4 text-sm font-medium text-muted-foreground">HR Management System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your dotkonnekt.com Microsoft account.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", {
              redirectTo: destination,
            });
          }}
        >
          {/* Kept black/white — this follows Microsoft's own brand
              guidance for a "Sign in with Microsoft" button, not ours. */}
          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
          >
            Sign in with Microsoft
          </button>
        </form>
      </div>
    </main>
  );
}
