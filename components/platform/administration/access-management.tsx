import Link from "next/link";
import { ActionForm } from "../action-form";
import { EmptyState, PageIntro, PortalNotice } from "../shared";
import { PaginationNavigation } from "../pagination-navigation";
import { roles } from "@/lib/platform-schema/company";
import { translateText, type Locale } from "@/lib/i18n/messages";
import type { MembersPage } from "@/server/company-service";

export function AccessManagement({
  membersPage,
  companyCount,
  locale,
}: {
  membersPage: MembersPage;
  companyCount: number;
  locale: Locale;
}) {
  return (
    <>
      <PageIntro
        eyebrow={translateText(locale, "CONTAS E SEGURANÇA")}
        title={translateText(locale, "Pessoas certas. Acessos definidos.")}
        description="A pessoa cria sua conta primeiro. Depois, vincule o e-mail à empresa e ao perfil de trabalho. Para o perfil Guia, selecione também o cadastro público correto."
      />
      <PortalNotice>
        Com SMTP configurado, a pessoa confirma o e-mail por link. Mantenha essa exigência desligada
        até validar as contas migradas; antes de conceder acesso, confirme diretamente que ela
        controla a conta.
      </PortalNotice>
      {companyCount ? (
        <details className="editor-card" open>
          <summary>{translateText(locale, "Conceder ou alterar acesso")}</summary>
          <ActionForm
            action="acessos"
            fields={[
              {
                name: "company_id",
                label: translateText(locale, "Empresa"),
                type: "company-select",
              },
              {
                name: "email",
                label: translateText(locale, "E-mail da conta cadastrada"),
                type: "email",
                maxLength: 254,
              },
              {
                name: "role",
                label: translateText(locale, "Perfil"),
                type: "select",
                options: Object.entries(roles).map(([value, label]) => ({ value, label })),
              },
              {
                name: "guide_id",
                label: translateText(locale, "Cadastro de guia vinculado"),
                type: "guide-select",
                companyField: "company_id",
                visibleWhen: { field: "role", value: "guide" },
              },
            ]}
            label={translateText(locale, "Salvar permissão")}
          />
        </details>
      ) : (
        <EmptyState title={translateText(locale, "Cadastre uma empresa primeiro.")}>
          <Link href="/painel/plataforma/empresas">
            {translateText(locale, "Ir para empresas →")}
          </Link>
        </EmptyState>
      )}
      <div className="resource-list">
        {membersPage.items.map((member) => (
          <article key={member.company_id + member.user_id}>
            <div>
              <h3>{member.name}</h3>
              <p>{member.email}</p>
              <p>
                {member.company_name} · {roles[member.role]}
              </p>
              {member.role === "guide" && (
                <p>Guia vinculado: {member.guide_name || "vínculo pendente de configuração"}</p>
              )}
            </div>
            <ActionForm
              action="revogar-acesso"
              fixed={{ company_id: member.company_id, user_id: member.user_id }}
              label={translateText(locale, "Remover acesso")}
            />
          </article>
        ))}
      </div>
      <PaginationNavigation
        page={membersPage.page}
        totalPages={membersPage.totalPages}
        hrefForPage={(page) => `/painel/plataforma/acessos?memberPage=${page}`}
      />
      <PortalNotice>
        O administrador do sistema é definido na configuração segura da instalação. Este formulário
        concede apenas perfis de empresa; as permissões são conferidas no servidor em cada operação.
      </PortalNotice>
    </>
  );
}
