import Link from "next/link";
import { PlatformBrand } from "./brand";
import { ModuleSwitcher, publicModules, type ModuleLink } from "./shared";
import { SignOutButton } from "@/components/site/admin-auth";
import type { Company } from "@/server/platform-models";
export function PanelShell({
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
  const links =
    module === "hotel"
      ? [
          ["", "Visão geral"],
          ["quartos", "Quartos"],
          ["reservas", "Reservas"],
          ["fnrh", "FNRH · Estadias"],
        ]
      : module === "passeios"
        ? [
            ["", "Visão geral"],
            ["passeios", "Passeios"],
            ["guias", "Guias"],
            ["agenda", "Agenda"],
            ["vagas", "Vagas e reservas"],
          ]
        : [
            ["", "Visão geral"],
            ["empresas", "Empresas"],
            ["acessos", "Contas e permissões"],
            ["cadastur", "Cadastur · Diretório"],
          ];
  const suffix = companyId ? "?empresa=" + companyId : "";
  return (
    <div className="panel-app">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="panel-sidebar">
        <PlatformBrand />
        <p className="sidebar-caption">
          {module === "hotel"
            ? "PAINEL HOTELEIRO"
            : module === "passeios"
              ? "GUIAS E OPERADORES"
              : "ADMINISTRAÇÃO GERAL"}
        </p>
        <nav aria-label="Navegação do painel">
          {links.map(([path, label]) => (
            <Link
              key={path}
              aria-current={section === path ? "page" : undefined}
              href={"/painel/" + module + (path ? "/" + path : "") + suffix}
            >
              {label}
            </Link>
          ))}
          {module === "plataforma" && <Link href="/admin">Contatos do site</Link>}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/minha-conta">Minha conta</Link>
          <Link href="/">Visitar o site ↗</Link>
        </div>
      </aside>
      <div className="panel-workspace">
        <header className="panel-topbar">
          <ModuleSwitcher modules={[...publicModules, ...modules]} />
          <div className="local-tag">Operação local</div>
          <SignOutButton />
        </header>
        <main id="conteudo" tabIndex={-1} className="panel-main">
          {module !== "plataforma" && companies.length > 0 && (
            <form className="company-picker" method="get">
              <label htmlFor="company-picker">Empresa em atendimento</label>
              <select id="company-picker" name="empresa" defaultValue={companyId}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <button className="button button-dark">Selecionar</button>
            </form>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
