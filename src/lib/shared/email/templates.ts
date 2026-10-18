import type { EmailMessage } from "@/lib/shared/email/types";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const invitationEmail = (input: {
  to: string;
  link: string;
  inviterName: string;
  days: number;
}): EmailMessage => {
  const intro = `${input.inviterName} convidou você para acessar o Compasso.`;
  const expiry = `O link vale por ${input.days} dias e só pode ser usado uma vez.`;
  return {
    to: input.to,
    subject: "Você foi convidado(a) para o Compasso",
    text: `${intro}\n\nDefina sua senha e entre: ${input.link}\n\n${expiry}`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(input.link)}">Definir senha e entrar</a></p><p>${escapeHtml(expiry)}</p>`,
  };
};
