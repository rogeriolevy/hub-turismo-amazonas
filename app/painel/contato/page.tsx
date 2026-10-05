import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { getSession } from "@/server/admin";
import { LoginForm, SignOutButton } from "@/components/site/admin-auth";
import { isAdmin } from "@/server/authorization";
import { ContactInbox } from "@/components/site/contact-inbox";
import { captchaRequired, turnstileSiteKey } from "@/server/turnstile";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contatos recebidos",
  robots: { index: false, follow: false },
  alternates: { canonical: "/painel/contato" },
};

export default async function ContactPanel() {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const user = session?.user;
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="container admin-main">
        <p className="eyebrow">{t("admin.panel")}</p>
        <h1>{t("admin.contactTitle")}</h1>
        {!user ? (
          <div className="admin-notice">
            <p>{t("admin.loginRequired")}</p>
            <LoginForm turnstileSiteKey={turnstileSiteKey()} captchaRequired={captchaRequired()} />
          </div>
        ) : !isAdmin(user.email, process.env.ADMIN_EMAILS) ? (
          <div className="admin-notice">
            <h2>{t("admin.unauthorized")}</h2>
            <p>{t("admin.notEnabled")}</p>
            <SignOutButton />
          </div>
        ) : (
          <>
            <div className="inbox-heading">
              <p>Acesso de {user.email}</p>
              <Link className="text-link" href="/painel/plataforma">
                {t("admin.platformAdmin")}
              </Link>
              <SignOutButton />
            </div>
            <ContactInbox />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
