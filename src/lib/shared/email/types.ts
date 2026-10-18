export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailResult =
  { ok: true } | { ok: false; reason: "not_configured" | "rejected" | "unreachable" };
