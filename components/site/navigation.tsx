import {
  ArrowUpRight,
  BedDouble,
  BriefcaseBusiness,
  Compass,
  Ship,
  Sparkles,
  UtensilsCrossed,
  UserRound,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { PlatformBrand } from "@/components/platform/brand";
import { AccountMenu } from "@/components/site/account-menu";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { getLocale } from "@/lib/i18n/server";
import { translate, type MessageKey } from "@/lib/i18n/messages";
import { avatarKeyFromImage, defaultAvatarForUser } from "@/lib/profile-avatars";
import { getSession } from "@/server/admin";
import "./navigation.css";

const destinations = [
  { href: "/hospedagens", key: "header.accommodations", icon: BedDouble },
  { href: "/gastronomia", key: "header.food", icon: UtensilsCrossed },
  { href: "/experiencias", key: "header.experiences", icon: Compass },
  { href: "/agencias", key: "header.agencies", icon: BriefcaseBusiness },
  { href: "/servicos", key: "header.services", icon: Sparkles },
  { href: "/navegacao", key: "header.navigation", icon: Ship },
];

const primaryLinks = [...destinations, { href: "/sobre", key: "header.about", icon: Waves }];

const hubLinks = [
  { href: "/sobre", key: "header.about" },
  { href: "/privacidade", key: "footer.privacy" },
  { href: "/painel/contato", key: "footer.admin" },
];

export function Brand() {
  return <PlatformBrand />;
}
export async function Header() {
  const [session, locale] = await Promise.all([getSession().catch(() => null), getLocale()]);
  const t = (key: MessageKey) => translate(locale, key);
  const avatar = session
    ? (avatarKeyFromImage(session.user.image) ?? defaultAvatarForUser(session.user.id))
    : null;

  return (
    <>
      <a className="skip-link" href="#conteudo">
        {t("header.skip")}
      </a>
      <header className="site-header site-header--compact">
        <div className="container header-inner">
          <Brand />
          <nav className="header-primary-nav" aria-label={t("header.nav")}>
            {primaryLinks.map(({ href, key, icon: Icon }) => (
              <Link className="header-primary-link" href={href} key={href}>
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(key as MessageKey)}</span>
              </Link>
            ))}
          </nav>
          <LanguageSwitcher />
          {session && avatar ? (
            <AccountMenu name={session.user.name} email={session.user.email} avatar={avatar} />
          ) : (
            <Link
              className="header-account"
              href="/minha-conta"
              aria-label={t("header.account")}
              title={t("header.account")}
            >
              <UserRound size={18} aria-hidden="true" />
              <span>{t("header.account")}</span>
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
export async function Footer({ photoCredit = true }: { photoCredit?: boolean }) {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-map">
          <section className="footer-about" aria-label="Hub Turismo Amazonas">
            <Brand />
            <p>{t("footer.tagline")}</p>
            <Link className="footer-contact" href="/#contato">
              {t("footer.contact")} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </section>
          <nav className="footer-links" aria-label={t("footer.explore")}>
            <h2>{t("footer.explore")}</h2>
            <div className="footer-link-grid">
              {destinations.map(({ href, key, icon: Icon }) => (
                <Link className="footer-link" href={href} key={href}>
                  <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  <span>{t(key as MessageKey)}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Hub Turismo Amazonas</span>
          <nav className="footer-meta-links" aria-label={t("footer.siteInfo")}>
            <Link href="/minha-conta">{t("footer.account")}</Link>
            {hubLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                {t(item.key as MessageKey)}
              </Link>
            ))}
          </nav>
          {photoCredit && (
            <span>
              {t("footer.photo")}{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Amazon17_(5641020319).jpg"
                target="_blank"
                rel="noreferrer"
              >
                Neil Palmer / CIAT
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/2.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 2.0
              </a>{" "}
              · Recorte e compressão.
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
