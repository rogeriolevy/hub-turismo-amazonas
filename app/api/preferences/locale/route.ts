import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/messages";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("locale" in body)) {
    return NextResponse.json({ error: "Idioma inválido." }, { status: 400 });
  }
  const locale = (body as { locale?: unknown }).locale;
  if (typeof locale !== "string" || !isLocale(locale)) {
    return NextResponse.json({ error: "Idioma inválido." }, { status: 400 });
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure = forwardedProto === "https" || new URL(request.url).protocol === "https:";
  (await cookies()).set("hub-locale", locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure,
  });
  return NextResponse.json({ data: { locale } });
}
