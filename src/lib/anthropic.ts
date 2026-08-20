import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null | undefined;

/**
 * Returns a shared Anthropic client, or null if ANTHROPIC_API_KEY isn't
 * set — same graceful-fallback shape as prisma.ts's singleton, except the
 * caller (src/lib/actions/assistant.ts) surfaces the null case as a
 * friendly chat message rather than silently no-opping, since this is a
 * feature the user is actively interacting with, not a background job.
 */
export function getAnthropicClient(): Anthropic | null {
  if (client === undefined) {
    client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }
  return client;
}
