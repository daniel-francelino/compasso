import type { EmailMessage, EmailResult } from "@/lib/shared/email/types";
import { logError } from "@/lib/shared/logger";

const RESEND_URL = "https://api.resend.com/emails";

export const sendEmail = async (message: EmailMessage): Promise<EmailResult> => {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];
  if (!apiKey || !from) return { ok: false, reason: "not_configured" };

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (response.ok) return { ok: true };
    logError("email provider rejected the message", response.status);
    return { ok: false, reason: "rejected" };
  } catch (error) {
    logError("email provider unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
};
