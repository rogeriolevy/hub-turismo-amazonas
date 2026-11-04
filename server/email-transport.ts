import nodemailer from "nodemailer";

type SmtpConfiguration = {
  host: string;
  port: number;
  from: string;
  user?: string;
  password?: string;
};

function smtpConfiguration(): SmtpConfiguration | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD ?? "";
  const portValue = process.env.SMTP_PORT?.trim() ?? "";

  // SMTP_PORT is allowed to keep its documented default in .env files.
  if (!host && !from && !user && !password) return null;
  if (!host || !from || Boolean(user) !== Boolean(password))
    throw new Error(
      "Configure SMTP_HOST e SMTP_FROM; SMTP_USER e SMTP_PASSWORD devem ser usados juntos.",
    );

  const port = portValue ? Number(portValue) : 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("SMTP_PORT precisa ser um número entre 1 e 65535.");

  return { host, port, from, ...(user ? { user, password } : {}) };
}

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter(configuration: SmtpConfiguration) {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    requireTLS: configuration.port !== 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    ...(configuration.user && configuration.password
      ? { auth: { user: configuration.user, pass: configuration.password } }
      : {}),
  });
  return transporter;
}

export function isEmailDeliveryConfigured() {
  return smtpConfiguration() !== null;
}

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId?: string;
};

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
  messageId,
}: TransactionalEmail) {
  const configuration = smtpConfiguration();
  if (!configuration) throw new Error("Email delivery is not configured.");

  await getTransporter(configuration).sendMail({
    from: configuration.from,
    to,
    subject: subject.replace(/[\r\n]+/g, " "),
    text,
    html,
    ...(messageId ? { messageId } : {}),
  });
}
