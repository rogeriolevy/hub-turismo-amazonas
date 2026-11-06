import { PageIntro } from "../shared";
import { CompanyEditor } from "../panel-forms";
import { PaginationNavigation } from "../pagination-navigation";
import { companyActivityLabels, companyDisplayName } from "@/lib/platform-schema/company";
import { translateText, type Locale } from "@/lib/i18n/messages";
import type { CompaniesPage } from "@/server/platform-access";

export function CompanyManagement({
  companiesPage,
  locale,
}: {
  companiesPage: CompaniesPage;
  locale: Locale;
}) {
  return (
    <>
      <PageIntro
        eyebrow={translateText(locale, "REDE HUB")}
        title="Empresas"
        description="Cadastre hospedagens, operadores de passeios, navegação fluvial e transporte aéreo."
      />
      <details className="editor-card" open={!companiesPage.total}>
        <summary>{translateText(locale, "Cadastrar uma empresa")}</summary>
        <CompanyEditor />
      </details>
      <div className="editor-list">
        {companiesPage.items.map((company) => (
          <details className="editor-card" key={company.id}>
            <summary>
              <span>
                {companyDisplayName(company)}
                <small>
                  {companyActivityLabels[company.activity_type]} · {company.city}
                </small>
              </span>
              <span className="status-pill">
                {translateText(
                  locale,
                  company.status === "published"
                    ? "Publicado"
                    : company.status === "draft"
                      ? "Rascunho"
                      : "Suspenso",
                )}
              </span>
            </summary>
            <CompanyEditor company={company} />
          </details>
        ))}
      </div>
      <PaginationNavigation
        page={companiesPage.page}
        totalPages={companiesPage.totalPages}
        hrefForPage={(page) => `/painel/plataforma/empresas?companyPage=${page}`}
      />
    </>
  );
}
