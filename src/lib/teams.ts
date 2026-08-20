const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

export type SendTeamsMessageInput = { title: string; text: string };

/**
 * Posts a plain-text notification to a Microsoft Teams channel via a
 * webhook URL (PRD §32's "Teams notifications") — the one Teams
 * integration that doesn't need an Entra app registration or admin
 * consent beyond what a channel owner can already self-serve.
 *
 * ⚠️ Uncertain / verify before relying on this: Microsoft has been
 * retiring the classic "Incoming Webhook" connector (which used a
 * `MessageCard` JSON payload — what this function sends) in favor of
 * "Workflows" (Power Automate-based) webhooks, which may expect a
 * different payload shape depending on how the flow is built. Which of
 * these your Teams tenant/channel actually offers may have changed after
 * this code was written — check your channel's Connectors/Workflows menu
 * and Microsoft's current docs, and adjust the payload below if the
 * webhook you get doesn't accept `MessageCard`.
 *
 * Same graceful-fallback shape as sendEmail: logs and returns false if
 * TEAMS_WEBHOOK_URL isn't configured, so the rest of the app (including
 * the reminders cron) keeps working without it.
 *
 * Teams channel webhooks post to a shared channel, not a person — there's
 * no per-user "your leave was approved" equivalent here, only broadcast
 * notifications like the daily HR digest.
 */
export async function sendTeamsMessage({ title, text }: SendTeamsMessageInput): Promise<boolean> {
  if (!TEAMS_WEBHOOK_URL) {
    console.log(`[teams:not-configured] Would post "${title}"`);
    return false;
  }

  try {
    const res = await fetch(TEAMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        summary: title,
        title,
        text,
      }),
    });
    if (!res.ok) {
      console.error("sendTeamsMessage failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendTeamsMessage threw:", err);
    return false;
  }
}
