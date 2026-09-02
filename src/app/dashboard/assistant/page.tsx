import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { auth } from "@/lib/auth";

import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Answers using your own HR data (and, for managers/HR, your
            team&apos;s/the org&apos;s) — never compensation, bank, or
            statutory ID details.
          </p>
        </div>
      </div>
      <AssistantChat />
    </div>
  );
}
