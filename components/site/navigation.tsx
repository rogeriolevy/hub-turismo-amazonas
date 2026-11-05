import {
  ArrowUpRight,
  ContactRound,
  Grid2X2,
  LogIn,
  Settings2,
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
import { PlatformNavigation } from "./platform-navigation";
import "./navigation.css";

const institutionalLinks = [
  { href: "/sobre", key: "header.about", icon: Waves },
  { href: "/contato", key: "header.contact", icon: ContactRound },
] as const;

const platformLinks = [
  { href: "/hospedagens", key: "header.accommodations", icon: "accommodations" },
  { href: "/navegacao", key: "header.navigation", icon: "navigation" },
  { href: "/gastronomia", key: "header.food", icon: "food" },
  { href: "/experiencias", key: "header.experiences", icon: "experiences" },
  { href: "/agencias", key: "header.agencies", icon: "agencies" },
  { href: "/servicos", key: "header.services", icon: "services" },
] as const;

type NavigationVariant = "institutional" | "platform";

export function Brand({ variant = "platform" }: { variant?: NavigationVariant }) {
  return <PlatformBrand homeHref={variant === "platform" ? "/plataforma" : "/"} />;
}
export async function Header({ variant = "platform" }: { variant?: NavigationVariant } = {}) {
  const [session, locale] = await Promise.all([getSession().catch(() => null), getLocale()]);
  const t = (key: MessageKey) => translate(locale, key);
  const avatar = session
    ? (avatarKeyFromImage(session.user.image) ?? defaultAvatarForUser(session.user.id))
    : null;
  const accountHref =
    variant === "platform"
      ? session
        ? "/minha-conta"
        : "/entrar?voltar=%2Fminha-conta"
      : "/plataforma";
  const accountLabel =
    variant === "platform"
      ? session
        ? t("module.account")
        : t("auth.login")
      : t("header.account");
  const AccountIcon = variant === "platform" ? (session ? UserRound : LogIn) : Grid2X2;

  return (
    <>
      <a className="skip-link" href="#conteudo">
        {t("header.skip")}
      </a>
      <header className={`site-header site-header--compact site-header--${variant}`}>
        <div className="container header-inner">
          <Brand variant={variant} />
          {variant === "platform" ? (
            <PlatformNavigation
              ariaLabel={t("header.nav")}
              homeLabel={t("header.platformHome")}
              links={platformLinks.map(({ href, key, icon }) => ({
                href,
                label: t(key),
                icon,
              }))}
            />
          ) : (
            <nav
              className="header-primary-nav header-primary-nav--institutional"
              aria-label={t("header.nav")}
            >
              {institutionalLinks.map(({ href, key, icon: Icon }) => (
                <Link className="header-primary-link" href={href} key={href}>
                  <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t(key)}</span>
                </Link>
              ))}
            </nav>
          )}
          <div className="header-actions">
            <LanguageSwitcher />
            <Link
              className="header-account"
              href={accountHref}
              aria-label={accountLabel}
              title={accountLabel}
            >
              <AccountIcon size={17} aria-hidden="true" />
              <span>{accountLabel}</span>
            </Link>
            {session && avatar ? (
              <AccountMenu name={session.user.name} email={session.user.email} avatar={avatar} />
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}
export async function Footer({
  photoCredit = true,
  variant = "platform",
}: {
  photoCredit?: boolean;
  variant?: NavigationVariant;
}) {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-map">
          <section className="footer-about" aria-label="Hub Turismo Amazonas">
            <Brand variant={variant} />
            <p>{t("footer.tagline")}</p>
            {variant === "institutional" ? (
              <Link className="footer-contact" href="/contato">
                {t("footer.contact")} <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </section>
          <nav className="footer-links" aria-label={t("footer.siteInfo")}>
            <h2>{t("footer.siteInfo")}</h2>
            <div className="footer-link-list">
              <Link className="footer-link" href="/plataforma">
                <Grid2X2 size={17} strokeWidth={1.7} aria-hidden="true" />
                <span>{t("header.account")}</span>
              </Link>
              <Link className="footer-link" href="/painel/contato">
                <Settings2 size={17} strokeWidth={1.7} aria-hidden="true" />
                <span>{t("footer.admin")}</span>
              </Link>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Hub Turismo Amazonas</span>
          <nav className="footer-meta-links" aria-label={t("footer.siteInfo")}>
            {variant === "institutional" ? <Link href="/sobre">{t("header.about")}</Link> : null}
            <Link href="/privacidade">{t("footer.privacy")}</Link>
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
