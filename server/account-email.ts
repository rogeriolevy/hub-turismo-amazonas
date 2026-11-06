import { isEmailDeliveryConfigured, sendTransactionalEmail } from "./email-transport.ts";

export type AccountEmailKind = "verification" | "password-reset" | "password-changed";

export function emailVerificationRequired() {
  const value = process.env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  if (value && value !== "true" && value !== "false")
    throw new Error("REQUIRE_EMAIL_VERIFICATION precisa ser true ou false.");
  return value === "true";
}

function internalLink(rawUrl: string) {
  const link = new URL(rawUrl);
  const site = new URL(process.env.SITE_URL ?? "");
  if (link.origin !== site.origin) throw new Error("The account email link must stay on SITE_URL.");
  return link.href;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

type AccountEmail = {
  to: string;
  kind: AccountEmailKind;
  url?: string;
};

export async function sendAccountEmail({ to, kind, url }: AccountEmail) {
  if (!isEmailDeliveryConfigured()) throw new Error("Email delivery is not configured.");

  let subject: string;
  let text: string;
  let html: string;
  if (kind === "verification") {
    if (!url) throw new Error("A verification URL is required.");
    const link = internalLink(url);
    subject = "Confirme seu e-mail | Hub Turismo Amazonas";
    text = `Confirme o e-mail da sua conta Hub Turismo Amazonas acessando este link:\n\n${link}\n\nSe você não criou esta conta, ignore esta mensagem.`;
    html = `<p>Confirme o e-mail da sua conta Hub Turismo Amazonas.</p><p><a href="${escapeHtml(link)}">Confirmar e-mail</a></p><p>Se você não criou esta conta, ignore esta mensagem.</p>`;
  } else if (kind === "password-reset") {
    if (!url) throw new Error("A password reset URL is required.");
    const link = internalLink(url);
    subject = "Redefina sua senha | Hub Turismo Amazonas";
    text = `Recebemos uma solicitação para redefinir a senha da sua conta. Use este link: ${link}\n\nSe você não pediu a redefinição, ignore esta mensagem. O link expira em 30 minutos.`;
    html = `<p>Recebemos uma solicitação para redefinir a senha da sua conta.</p><p><a href="${escapeHtml(link)}">Redefinir senha</a></p><p>Se você não pediu a redefinição, ignore esta mensagem. O link expira em 30 minutos.</p>`;
  } else {
    subject = "Senha alterada | Hub Turismo Amazonas";
    text =
      "A senha da sua conta Hub Turismo Amazonas foi alterada. Se você não fez essa alteração, entre em contato com o responsável pelo site.";
    html =
      "<p>A senha da sua conta Hub Turismo Amazonas foi alterada.</p><p>Se você não fez essa alteração, entre em contato com o responsável pelo site.</p>";
  }

  await sendTransactionalEmail({
    to,
    subject,
    text,
    html,
  });
}
