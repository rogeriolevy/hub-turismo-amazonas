import { AuthScreen } from "@/components/site/auth-screen";
import { captchaRequired, turnstileSiteKey } from "@/server/turnstile";
import { emailVerificationRequired, isEmailDeliveryConfigured } from "@/server/email";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Confirmar e-mail",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <AuthScreen
      initialMode="verification"
      destination="/conta"
      turnstileSiteKey={turnstileSiteKey()}
      captchaRequired={captchaRequired()}
      emailDeliveryEnabled={isEmailDeliveryConfigured()}
      emailVerificationRequired={emailVerificationRequired()}
    />
  );
}
