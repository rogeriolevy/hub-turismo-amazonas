import "server-only";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "./messages";

export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get("hub-locale")?.value;
  return isLocale(saved) ? saved : "pt";
}
