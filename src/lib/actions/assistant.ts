"use server";

import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "@/lib/anthropic";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/assistant-tools";
import { requireSession } from "@/lib/rbac";

export type AssistantMessage = { role: "user" | "assistant"; text: string };
export type AssistantResult = { reply: string } | { error: string };

const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_TURNS = 20;
const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are an HR assistant embedded in an HRMS app, answering questions about the current signed-in user's own HR data, or (for managers/HR) their team's/the organization's data.

Use the provided tools to look up real data — never guess or make up numbers. If a tool returns an error (e.g. permission denied, not linked to an employee record), relay that plainly rather than working around it. Keep answers concise and specific to what was asked. You have no access to compensation, bank, or statutory ID details — if asked about those, say you don't have access to that information here.`;

/**
 * Runs one turn of the AI assistant (PRD §40): sends the question (plus a
 * bounded slice of prior turns) to Claude with a fixed set of read-only,
 * role-checked tools (src/lib/assistant-tools.ts) — the model never gets
 * raw database access, only those vetted functions. Loops on tool_use
 * responses (bounded by MAX_TOOL_ITERATIONS) until Claude produces a final
 * text reply.
 */
export async function askAssistant(
  history: AssistantMessage[],
  question: string
): Promise<AssistantResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return { error: "Ask something first." };
  }
  if (trimmedQuestion.length > MAX_QUESTION_LENGTH) {
    return { error: `That's too long — keep it under ${MAX_QUESTION_LENGTH} characters.` };
  }

  const client = getAnthropicClient();
  if (!client) {
    return {
      error: "The AI assistant isn't configured yet — ask HR/IT to set ANTHROPIC_API_KEY.",
    };
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-MAX_HISTORY_TURNS).map((m) => ({ role: m.role, content: m.text })),
    { role: "user" as const, content: trimmedQuestion },
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: ASSISTANT_TOOLS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((b) => b.type === "text");
        return { reply: textBlock?.text ?? "I don't have a response for that." };
      }

      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await runAssistantTool(block.name, block.input, session);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }
    return { error: "That took too many steps to answer — try asking something more specific." };
  } catch (err) {
    console.error("askAssistant failed:", err);
    return { error: "Something went wrong talking to the assistant. Please try again." };
  }
}
