import Link from "next/link";
import { PlatformBrand } from "./brand";
import { ModuleSwitcher, publicModules, type ModuleLink } from "./shared";
import { SignOutButton } from "@/components/site/admin-auth";
import type { Company } from "@/server/platform-models";
import { companyDisplayName } from "@/lib/platform-schema";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
export async function PanelShell({
  module,
  section,
  companies,
  companyId,
  modules,
  children,
}: {
  module: "hotel" | "passeios" | "plataforma";
  section: string;
  companies: Company[];
  companyId?: string;
  modules: ModuleLink[];
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const links =
    module === "hotel"
      ? [
          ["", t("panel.overview")],
          ["quartos", t("panel.rooms")],
          ["reservas", t("panel.bookings")],
          ["fnrh", t("panel.stays")],
        ]
      : module === "passeios"
        ? [
            ["", t("panel.overview")],
            ["experiencias", t("panel.experiencesTab")],
            ["agenda", t("panel.schedule")],
            ["vagas", t("panel.availability")],
          ]
        : [
            ["", t("panel.overview")],
            ["empresas", t("panel.companies")],
            ["acessos", t("panel.permissions")],
            ["cadastur", t("panel.directory")],
            ["conteudos", t("panel.content")],
          ];
  const suffix = companyId ? "?empresa=" + companyId : "";
  return (
    <div className="panel-app">
      <a className="skip-link" href="#conteudo">
        {t("header.skip")}
      </a>
      <aside className="panel-sidebar">
        <PlatformBrand />
        <p className="sidebar-caption">
          {module === "hotel"
            ? t("panel.hotel")
            : module === "passeios"
              ? t("panel.experiences")
              : t("panel.platform")}
        </p>
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
          {module === "plataforma" && <Link href="/painel/contato">{t("panel.contacts")}</Link>}
        </nav>
        <div className="sidebar-bottom">
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
          {module !== "plataforma" && companies.length > 0 && (
            <form className="company-picker" method="get">
              <label htmlFor="company-picker">{t("panel.company")}</label>
              <select id="company-picker" name="empresa" defaultValue={companyId}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {companyDisplayName(company)}
                  </option>
                ))}
              </select>
              <button className="button button-dark">{t("panel.select")}</button>
            </form>
          )}
          <LocalizedTree>{children}</LocalizedTree>
        </main>
      </div>
    </div>
  );
}
