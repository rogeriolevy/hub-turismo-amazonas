import Link from "next/link";
import { PlatformBrand } from "./brand";
import { ModuleSwitcher, publicModules, type ModuleLink } from "./shared";
import { SignOutButton } from "@/components/site/admin-auth";
import { PlatformOptionSelect } from "./platform-option-select";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
import { panelAreas, type PanelArea } from "@/lib/platform-navigation";
export async function PanelShell({
  module,
  section,
  hasCompanies,
  companyId,
  companyKind,
  guideMode = false,
  unreadNotifications = 0,
  modules,
  children,
}: {
  module: PanelArea;
  section: string;
  hasCompanies: boolean;
  companyId?: string;
  companyKind?: "hotel" | "operator";
  guideMode?: boolean;
  unreadNotifications?: number;
  modules: ModuleLink[];
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const definition = panelAreas[module];
  const links = guideMode
    ? [["", t("panel.myDepartures")] as const]
    : definition.sections.map(({ path, labelKey }) => [path, t(labelKey)] as const);
  const suffix = companyId ? "?empresa=" + companyId : "";
  return (
    <div className="panel-app">
      <a className="skip-link" href="#conteudo">
        {t("header.skip")}
      </a>
      <aside className="panel-sidebar">
        <PlatformBrand />
        <p className="sidebar-caption">{t(definition.titleKey)}</p>
        <nav aria-label={t("panel.nav")}>
          {links.map(([path, label]) => (
            <Link
              key={path}
              aria-current={section === path ? "page" : undefined}
              href={"/painel/" + module + (path ? "/" + path : "") + suffix}
            >
              {label}
            </Link>
          ))}
          {definition.externalLinks.map(({ href, labelKey }) => (
            <Link key={href} href={href}>
              {t(labelKey)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/minha-conta/notificacoes" className="notification-nav-link">
            {t("panel.notifications")}
            {unreadNotifications > 0 && (
              <span
                className="notification-count"
                aria-label={t("notifications.unreadCount", { count: unreadNotifications })}
              >
                {unreadNotifications}
              </span>
            )}
          </Link>
          <Link href="/minha-conta">{t("panel.myAccount")}</Link>
          <Link href="/">{t("panel.visitSite")}</Link>
        </div>
      </aside>
      <div className="panel-workspace">
        <header className="panel-topbar">
          <ModuleSwitcher modules={[...publicModules, ...modules]} />
          <LanguageSwitcher />
          <div className="local-tag">{t("panel.localOperation")}</div>
          <SignOutButton />
        </header>
        <main id="conteudo" tabIndex={-1} className="panel-main">
          {module !== "plataforma" && hasCompanies && (
            <form className="company-picker" method="get">
              <PlatformOptionSelect
                id="company-picker"
                name="empresa"
                label={t("panel.company")}
                initialValue={companyId || ""}
                entity="company"
                companyKind={companyKind}
                required
              />
              <button className="button button-dark">{t("panel.select")}</button>
            </form>
          )}
          <LocalizedTree>{children}</LocalizedTree>
        </main>
      </div>
    </div>
  );
}
