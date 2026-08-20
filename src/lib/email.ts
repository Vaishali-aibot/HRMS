import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM ?? "HRMS <onboarding@resend.dev>";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

/**
 * Sends an email via Resend, or logs it and returns false if
 * RESEND_API_KEY isn't configured — so the rest of the app (including the
 * reminders cron) keeps working in local dev / before email is set up,
 * rather than throwing on every call.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  if (!resend) {
    console.log(
      `[email:not-configured] Would send "${subject}" to ${Array.isArray(to) ? to.join(", ") : to}`
    );
    return false;
  }

  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    if (result.error) {
      console.error("sendEmail failed:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail threw:", err);
    return false;
  }
}
