import { redirect } from "next/navigation";
import { getSession } from "@/server/admin";
import { AuthScreen } from "@/components/site/auth-screen";
import { safeAuthDestination } from "@/lib/auth-destination";
import { captchaRequired, turnstileSiteKey } from "@/server/turnstile";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cadastro" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string | string[] }>;
}) {
  const destination = safeAuthDestination((await searchParams).voltar);
  if (await getSession()) redirect(destination);
  return (
    <AuthScreen
      initialMode="signup"
      destination={destination}
      turnstileSiteKey={turnstileSiteKey()}
      captchaRequired={captchaRequired()}
    />
  );
}
