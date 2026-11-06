import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { Footer, Header } from "@/components/site/navigation";
import { translate } from "@/lib/i18n/messages";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
import { getLocale } from "@/lib/i18n/server";
import "./contato.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  return {
    title: translate(locale, "contactPage.metaTitle"),
    description: translate(locale, "contactPage.metaDescription"),
    alternates: { canonical: "/contato" },
  };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <>
      <Header variant="institutional" />
      <LocalizedTree>
        <main id="conteudo" tabIndex={-1} className="contact-page">
          <section className="contact-page-hero" aria-labelledby="contact-page-title">
            <div className="container contact-page-hero__inner">
              <div className="contact-page-intro">
                <p className="eyebrow">{t("contactPage.eyebrow")}</p>
                <h1 id="contact-page-title">{t("contactPage.title")}</h1>
                <p>{t("contactPage.description")}</p>
              </div>
              <div className="contact-page-channels" aria-labelledby="contact-page-channels-title">
                <div className="contact-page-section-heading">
                  <h2 id="contact-page-channels-title">{t("contactPage.channelsTitle")}</h2>
                  <p>{t("contactPage.channelsDescription")}</p>
                </div>
                <div className="contact-page-channel-grid">
                  <article className="contact-page-channel-card">
                    <span className="contact-page-channel-icon" aria-hidden="true">
                      <MessageCircle size={22} strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3>{t("contactPage.whatsappTitle")}</h3>
                      <p>{t("contactPage.whatsappDescription")}</p>
                    </div>
                    <span className="contact-page-channel-status">
                      {t("contactPage.demoLabel")}
                    </span>
                  </article>
                  <article className="contact-page-channel-card">
                    <span className="contact-page-channel-icon" aria-hidden="true">
                      <Mail size={22} strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3>{t("contactPage.emailTitle")}</h3>
                      <p>{t("contactPage.emailDescription")}</p>
                    </div>
                    <span className="contact-page-channel-status">
                      {t("contactPage.demoLabel")}
                    </span>
                  </article>
                </div>
              </div>
            </div>
          </section>

          <section className="contact-page-form-section" aria-labelledby="contact-page-form-title">
            <div className="container contact-page-form-layout">
              <div className="contact-page-form-copy">
                <p className="eyebrow">{t("contactPage.formEyebrow")}</p>
                <h2 id="contact-page-form-title">{t("contactPage.formTitle")}</h2>
                <p>{t("contactPage.formDescription")}</p>
              </div>
              <ContactForm />
            </div>
          </section>
        </main>
      </LocalizedTree>
      <Footer variant="institutional" />
    </>
  );
}
