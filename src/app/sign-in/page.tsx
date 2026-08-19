import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-sm rounded-xl border border-black/10 p-8 text-center dark:border-white/15">
        <h1 className="text-xl font-semibold">HRMS</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Sign in with your dotkonnekt.com Microsoft account.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", {
              redirectTo: callbackUrl ?? "/dashboard",
            });
          }}
        >
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
