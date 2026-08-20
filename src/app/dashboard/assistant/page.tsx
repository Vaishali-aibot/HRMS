import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Assistant</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        PRD §40. Answers using your own HR data (and, for managers/HR, your
        team&apos;s/the org&apos;s) — never compensation, bank, or statutory
        ID details.
      </p>
      <div className="mt-4">
        <AssistantChat />
      </div>
    </div>
  );
}
