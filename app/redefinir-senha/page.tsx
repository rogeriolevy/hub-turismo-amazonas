import { AuthScreen } from "@/components/site/auth-screen";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = (await searchParams).token;
  return (
    <AuthScreen
      initialMode="reset"
      destination="/conta"
      turnstileSiteKey=""
      captchaRequired={false}
      emailDeliveryEnabled={false}
      emailVerificationRequired={false}
      resetToken={typeof token === "string" ? token : ""}
    />
  );
}
