"use client";

import { useState, useTransition } from "react";

import { askAssistant, type AssistantMessage } from "@/lib/actions/assistant";

const bubbleBase = "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap";

export function AssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || isPending) return;

    const historyForRequest = messages;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);

    startTransition(async () => {
      const result = await askAssistant(historyForRequest, question);
      if ("error" in result) {
        setError(result.error);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-[240px] flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
        {messages.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">
            Ask about your leave balance, pending requests, or — if you&apos;re a
            manager or HR — team approvals, org headcount, or HR helpdesk
            volume.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`${bubbleBase} ${
                m.role === "user"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {isPending && (
          <p className="text-sm text-black/50 dark:text-white/50">Thinking…</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={isPending}
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {isPending ? "…" : "Send"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
