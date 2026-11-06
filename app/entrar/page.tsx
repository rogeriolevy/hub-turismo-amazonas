import { redirect } from "next/navigation";
import { getSession } from "@/server/admin";
import { AuthScreen } from "@/components/site/auth-screen";
import { safeAuthDestination } from "@/lib/auth-destination";
import { captchaRequired, turnstileSiteKey } from "@/server/turnstile";
import { emailVerificationRequired, isEmailDeliveryConfigured } from "@/server/email";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
  alternates: { canonical: "/entrar" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    voltar?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const params = await searchParams;
  const destination = safeAuthDestination(params.voltar);
  if (await getSession()) redirect(destination);
  return (
    <AuthScreen
      initialMode="login"
      destination={destination}
      turnstileSiteKey={turnstileSiteKey()}
      captchaRequired={captchaRequired()}
      emailDeliveryEnabled={isEmailDeliveryConfigured()}
      emailVerificationRequired={emailVerificationRequired()}
      emailVerified={params["email-verificado"] === "1"}
    />
  );
}
