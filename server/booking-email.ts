import { sendTransactionalEmail } from "./email-transport.ts";

export type BookingEmailEvent =
  "booking.requested" | "booking.confirmed" | "booking.declined" | "booking.cancelled";

export type BookingEmailMessage = {
  id: string;
  to: string;
  event: BookingEmailEvent;
  bookingId: string;
  companyId: string;
  companyKind: "hotel" | "operator";
  companyName: string;
};

const copy: Record<BookingEmailEvent, { subject: string; headline: string; detail: string }> = {
  "booking.requested": {
    subject: "Nova solicitação de reserva | Hub Turismo Amazonas",
    headline: "Nova solicitação de reserva",
    detail: "Acesse o painel para analisar a solicitação.",
  },
  "booking.confirmed": {
    subject: "Sua reserva foi confirmada | Hub Turismo Amazonas",
    headline: "Sua reserva foi confirmada",
    detail: "Consulte os detalhes e as próximas informações na sua conta.",
  },
  "booking.declined": {
    subject: "Atualização sobre sua reserva | Hub Turismo Amazonas",
    headline: "A solicitação de reserva não foi confirmada",
    detail: "Acesse sua conta para consultar suas reservas.",
  },
  "booking.cancelled": {
    subject: "Reserva cancelada | Hub Turismo Amazonas",
    headline: "Uma reserva foi cancelada pelo turista",
    detail: "Acesse o painel para consultar a situação da reserva.",
  },
};

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

function bookingLink(message: BookingEmailMessage, recipientIsTeam: boolean) {
  const siteUrl = new URL(process.env.SITE_URL ?? "");
  const path = recipientIsTeam
    ? message.companyKind === "hotel"
      ? "/painel/hotel/reservas"
      : "/painel/passeios/reservas"
    : "/minha-conta/reservas";
  const link = new URL(path, siteUrl);
  if (recipientIsTeam) link.searchParams.set("empresa", message.companyId);
  link.searchParams.set("reserva", message.bookingId);
  return { href: link.href, hostname: siteUrl.hostname };
}

export function renderBookingEmail(message: BookingEmailMessage) {
  const recipientIsTeam =
    message.event === "booking.requested" || message.event === "booking.cancelled";
  const eventCopy = copy[message.event];
  const link = bookingLink(message, recipientIsTeam);
  const companyName = message.companyName.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  const reference = message.bookingId.slice(0, 8);
  const text = [
    eventCopy.headline,
    companyName,
    `Reserva: ${reference}`,
    eventCopy.detail,
    link.href,
    "",
    "Este aviso também está disponível na plataforma Hub Turismo Amazonas.",
  ].join("\n");
  const html = [
    `<h1>${escapeHtml(eventCopy.headline)}</h1>`,
    `<p>${escapeHtml(companyName)}</p>`,
    `<p>Reserva: ${escapeHtml(reference)}</p>`,
    `<p>${escapeHtml(eventCopy.detail)}</p>`,
    `<p><a href="${escapeHtml(link.href)}">Abrir reserva</a></p>`,
    `<p>Se o botão não abrir, copie este endereço: ${escapeHtml(link.href)}</p>`,
    "<p>Este aviso também está disponível na plataforma Hub Turismo Amazonas.</p>",
  ].join("");
  return {
    to: message.to,
    subject: eventCopy.subject,
    text,
    html,
    messageId: `<${message.id}@${link.hostname}>`,
  };
}

export async function sendBookingEmail(message: BookingEmailMessage) {
  await sendTransactionalEmail(renderBookingEmail(message));
}
