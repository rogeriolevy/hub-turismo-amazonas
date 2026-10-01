import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/site/navigation";
import { PanelShell } from "@/components/platform/panel-shell";
import { PageIntro, EmptyState, PortalNotice, type ModuleLink } from "@/components/platform/shared";
import {
  CompanyEditor,
  RoomEditor,
  TourEditor,
  GuideEditor,
  DepartureEditor,
} from "@/components/platform/panel-forms";
import { ActionForm } from "@/components/platform/action-form";
import { BookingList } from "@/components/platform/booking-list";
import { CadasturPanel } from "@/components/platform/cadastur-panel";
import { listDirectory } from "@/server/cadastur/service";
import { pageActor } from "@/server/platform-session";
import { companiesFor, isPlatformAdmin } from "@/server/platform-access";
import { companyInventory, listMembers } from "@/server/company-service";
import { businessBookings } from "@/server/booking-service";
import { one, many } from "@/server/platform-store";
import { getDatabase } from "@/db";
import { roles, money, displayTime, displayDate, companyDisplayName } from "@/lib/platform-schema";
export const metadata = { title: "Painel de operação", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
function Denied() {
  return (
    <>
      <Header />
      <main className="portal-main container" id="conteudo" tabIndex={-1}>
        <EmptyState title="Este módulo precisa de autorização.">
          <p>
            Peça ao administrador para vincular sua conta a uma empresa e conceder o perfil
            adequado.
          </p>
          <Link className="button button-dark" href="/minha-conta">
            Voltar à minha conta
          </Link>
        </EmptyState>
      </main>
      <Footer />
    </>
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; section?: string[] }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const route = await params;
  if (!["hotel", "passeios", "plataforma"].includes(route.module)) notFound();
  const area = route.module as "hotel" | "passeios" | "plataforma",
    section = route.section?.join("/") || "";
  const allowed =
    area === "hotel"
      ? ["", "quartos", "reservas", "fnrh"]
      : area === "passeios"
        ? ["", "passeios", "guias", "agenda", "vagas", "reservas"]
        : ["", "empresas", "acessos", "cadastur"];
  if (!allowed.includes(section)) notFound();
  const actor = await pageActor("/painel/" + area),
    db = getDatabase(),
    admin = isPlatformAdmin(actor),
    allCompanies = companiesFor(db, actor);
  const companies = allCompanies.filter((c) =>
    area === "hotel" ? c.kind === "hotel" : c.kind === "operator",
  );
  if (area === "plataforma" && !admin) return <Denied />;
  if (area !== "plataforma" && !admin && !companies.length) return <Denied />;
  const requested = (await searchParams).empresa;
  const companyId = typeof requested === "string" ? requested : companies[0]?.id;
  if (area !== "plataforma" && companyId && !companies.some((c) => c.id === companyId))
    return <Denied />;
  const modules: ModuleLink[] = [];
  if (admin || allCompanies.some((c) => c.kind === "hotel"))
    modules.push({
      href: "/painel/hotel",
      label: "Painel hoteleiro",
      description: "Quartos, reservas e estadias.",
    });
  if (admin || allCompanies.some((c) => c.kind === "operator"))
    modules.push({
      href: "/painel/passeios",
      label: "Painel de passeios",
      description: "Guias, agenda e vagas.",
    });
  if (admin)
    modules.push({
      href: "/painel/plataforma",
      label: "Administração geral",
      description: "Empresas e permissões.",
    });
  let content: React.ReactNode;
  if (area === "plataforma") {
    const members = listMembers(db, actor);
    if (section === "cadastur")
      content = (
        <CadasturPanel
          initial={listDirectory(db, actor, { category: "hospedagens" })}
          companies={allCompanies
            .filter((c) => c.kind === "hotel")
            .map((c) => ({ id: c.id, name: companyDisplayName(c) }))}
          guides={many<{ id: string; name: string }>(
            db,
            "SELECT id,name FROM guides ORDER BY name",
          )}
        />
      );
    else if (section === "empresas")
      content = (
        <>
          <PageIntro
            eyebrow="REDE HUB"
            title="Empresas"
            description="Cadastre parceiros e controle quais informações aparecem nos catálogos."
          />
          <details className="editor-card" open={!allCompanies.length}>
            <summary>Cadastrar uma empresa</summary>
            <CompanyEditor />
          </details>
          <div className="editor-list">
            {allCompanies.map((company) => (
              <details className="editor-card" key={company.id}>
                <summary>
                  <span>
                    {companyDisplayName(company)}
                    <small>
                      {company.kind === "hotel" ? "Hotel / pousada" : "Operador"} · {company.city}
                    </small>
                  </span>
                  <span className="status-pill">
                    {company.status === "published"
                      ? "Publicado"
                      : company.status === "draft"
                        ? "Rascunho"
                        : "Suspenso"}
                  </span>
                </summary>
                <CompanyEditor company={company} />
              </details>
            ))}
          </div>
        </>
      );
    else if (section === "acessos")
      content = (
        <>
          <PageIntro
            eyebrow="CONTAS E SEGURANÇA"
            title="Pessoas certas. Acessos definidos."
            description="A pessoa cria sua conta primeiro. Depois, vincule o e-mail a uma empresa e ao perfil de trabalho."
          />
          <PortalNotice>
            O cadastro ainda não confirma o e-mail por mensagem. Antes de conceder acesso, confirme
            diretamente com a pessoa que ela criou e controla essa conta.
          </PortalNotice>
          {allCompanies.length ? (
            <details className="editor-card" open>
              <summary>Conceder ou alterar acesso</summary>
              <ActionForm
                action="acessos"
                reset
                fields={[
                  {
                    name: "company_id",
                    label: "Empresa",
                    type: "select",
                    options: allCompanies.map((c) => ({
                      value: c.id,
                      label: companyDisplayName(c),
                    })),
                  },
                  {
                    name: "email",
                    label: "E-mail da conta cadastrada",
                    type: "email",
                    maxLength: 254,
                  },
                  {
                    name: "role",
                    label: "Perfil",
                    type: "select",
                    options: Object.entries(roles).map(([value, label]) => ({ value, label })),
                  },
                ]}
                label="Salvar permissão"
              />
            </details>
          ) : (
            <EmptyState title="Cadastre uma empresa primeiro.">
              <Link href="/painel/plataforma/empresas">Ir para empresas →</Link>
            </EmptyState>
          )}
          <div className="resource-list">
            {members.map((member) => (
              <article key={member.company_id + member.user_id}>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.email}</p>
                  <p>
                    {member.company_name} · {roles[member.role]}
                  </p>
                </div>
                <ActionForm
                  action="revogar-acesso"
                  fixed={{ company_id: member.company_id, user_id: member.user_id }}
                  label="Remover acesso"
                />
              </article>
            ))}
          </div>
          <PortalNotice>
            O administrador do sistema é definido na configuração segura da instalação. Este
            formulário concede apenas perfis de empresa; as permissões são conferidas no servidor em
            cada operação.
          </PortalNotice>
        </>
      );
    else
      content = (
        <>
          <PageIntro
            eyebrow="VISÃO GERAL"
            title="Conexões que ganham forma."
            description="Organize os parceiros, libere as equipes e acompanhe o crescimento da plataforma."
          />
          <div className="account-grid">
            <Link className="metric-card" href="/painel/plataforma/empresas">
              <span>Empresas cadastradas</span>
              <strong>{allCompanies.length}</strong>
              <span>{allCompanies.filter((c) => c.status === "published").length} publicadas</span>
            </Link>
            <Link className="metric-card" href="/painel/plataforma/acessos">
              <span>Vínculos de equipe</span>
              <strong>{members.length}</strong>
              <span>Gerenciar permissões →</span>
            </Link>
            <Link className="metric-card" href="/admin">
              <span>Contatos recebidos</span>
              <strong>{one<{ n: number }>(db, "SELECT COUNT(*) n FROM contacts")!.n}</strong>
              <span>Abrir caixa de contatos →</span>
            </Link>
          </div>
          <div className="onboarding-card">
            <h2>Comece pela sua rede.</h2>
            <ol>
              <li>Cadastre o hotel ou operador como rascunho.</li>
              <li>Vincule contas cadastradas aos perfis de equipe.</li>
              <li>Cadastre quartos ou passeios, guias e saídas.</li>
              <li>Publique a empresa e receba solicitações.</li>
            </ol>
            <Link className="button button-dark" href="/painel/plataforma/empresas">
              Organizar empresas
            </Link>
          </div>
        </>
      );
  } else if (!companyId) {
    content = (
      <EmptyState
        title={
          area === "hotel"
            ? "Sua primeira hospedagem começa aqui."
            : "Vamos conectar os primeiros operadores."
        }
      >
        <p>Cadastre uma empresa na administração geral para habilitar este painel.</p>
        <Link className="button button-dark" href="/painel/plataforma/empresas">
          Cadastrar empresa
        </Link>
      </EmptyState>
    );
  } else {
    const inventory = companyInventory(db, actor, companyId),
      bookings = businessBookings(db, actor, companyId),
      company = inventory.company;
    if (section === "quartos")
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title="Quartos"
            description="Cada registro representa um quarto físico. A aprovação de reservas respeita os períodos já confirmados."
          />
          <details className="editor-card">
            <summary>Cadastrar quarto</summary>
            <RoomEditor companyId={companyId} />
          </details>
          <div className="editor-list">
            {inventory.rooms.map((room) => (
              <details className="editor-card" key={room.id}>
                <summary>
                  <span>
                    {room.code} · {room.name}
                    <small>
                      Até {room.capacity} pessoas · {money(room.price_cents)} / noite
                    </small>
                  </span>
                  <span className="status-pill">{room.active ? "Ativo" : "Indisponível"}</span>
                </summary>
                <RoomEditor companyId={companyId} room={room} />
              </details>
            ))}
          </div>
        </>
      );
    else if (section === "reservas" || section === "vagas")
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title={area === "hotel" ? "Reservas" : "Vagas e solicitações"}
            description="Analise os pedidos. A disponibilidade é conferida novamente no momento da aprovação."
          />
          {section === "vagas" && (
            <div className="resource-list">
              {inventory.departures.map((d) => (
                <article key={d.id}>
                  <div>
                    <h3>{d.tour_name}</h3>
                    <p>{displayTime(d.starts_at)}</p>
                  </div>
                  <strong>
                    {d.capacity - (d.reserved || 0)} de {d.capacity} vagas livres
                  </strong>
                </article>
              ))}
            </div>
          )}
          <BookingList bookings={bookings} business />
        </>
      );
    else if (section === "fnrh")
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title="FNRH · Registro de estadias"
            description="Organize chegadas e saídas vinculadas às reservas confirmadas."
          />
          <PortalNotice>
            Registro local de estadia. Esta versão não preenche nem transmite a FNRH oficial e não
            substitui o procedimento governamental. A integração oficial será uma etapa própria.
          </PortalNotice>
          {!bookings.some((b) => b.status === "confirmed") ? (
            <EmptyState title="Nenhuma estadia confirmada.">
              <p>Aprove uma solicitação em Reservas para registrar a chegada.</p>
            </EmptyState>
          ) : (
            <div className="editor-list">
              {bookings
                .filter((b) => b.status === "confirmed")
                .map((b) => (
                  <article className="reservation-card" key={b.id}>
                    <h2>{b.customer_name}</h2>
                    <p>
                      {b.item_name} · {displayDate(b.check_in!)} → {displayDate(b.check_out!)}
                    </p>
                    {b.checked_in_at ? (
                      <>
                        <p>
                          Entrada: {displayTime(b.checked_in_at)} · Origem: {b.origin_city},{" "}
                          {b.country}
                        </p>
                        {b.checked_out_at ? (
                          <p>Saída: {displayTime(b.checked_out_at)}</p>
                        ) : (
                          <ActionForm
                            action="estadia"
                            fixed={{ company_id: companyId, booking_id: b.id, action: "checkout" }}
                            label="Registrar check-out"
                          />
                        )}
                      </>
                    ) : (
                      <ActionForm
                        action="estadia"
                        fixed={{ company_id: companyId, booking_id: b.id, action: "checkin" }}
                        initial={{ country: "Brasil" }}
                        fields={[
                          { name: "country", label: "País de origem", maxLength: 80 },
                          { name: "origin_city", label: "Cidade de origem", maxLength: 100 },
                        ]}
                        label="Registrar check-in"
                      />
                    )}
                  </article>
                ))}
            </div>
          )}
        </>
      );
    else if (section === "guias")
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title="Guias"
            description="Apresente os profissionais e vincule seus perfis aos passeios."
          />
          <details className="editor-card">
            <summary>Cadastrar guia</summary>
            <GuideEditor companyId={companyId} />
          </details>
          {inventory.guides.map((guide) => (
            <details className="editor-card" key={guide.id}>
              <summary>
                <span>
                  {guide.name}
                  <small>{guide.languages}</small>
                </span>
                <span>{guide.published ? "Publicado" : "Rascunho"}</span>
              </summary>
              <GuideEditor companyId={companyId} guide={guide} />
            </details>
          ))}
        </>
      );
    else if (section === "passeios")
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title="Passeios"
            description="Descreva a experiência, o guia, a duração e o valor por pessoa."
          />
          <details className="editor-card">
            <summary>Cadastrar passeio</summary>
            <TourEditor companyId={companyId} guides={inventory.guides} />
          </details>
          {inventory.tours.map((tour) => (
            <details className="editor-card" key={tour.id}>
              <summary>
                <span>
                  {tour.name}
                  <small>
                    {tour.city} · {tour.duration_minutes} min · {money(tour.price_cents)}
                  </small>
                </span>
                <span>{tour.published ? "Publicado" : "Rascunho"}</span>
              </summary>
              <TourEditor companyId={companyId} guides={inventory.guides} tour={tour} />
            </details>
          ))}
        </>
      );
    else if (section === "agenda")
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title="Agenda de saídas"
            description="Horários no fuso de Manaus. Controle a capacidade de cada saída."
          />
          {inventory.tours.length ? (
            <details className="editor-card">
              <summary>Criar saída</summary>
              <DepartureEditor companyId={companyId} tours={inventory.tours} />
            </details>
          ) : (
            <PortalNotice>Cadastre um passeio antes de abrir a agenda.</PortalNotice>
          )}
          {inventory.departures.map((d) => (
            <details className="editor-card" key={d.id}>
              <summary>
                <span>
                  {d.tour_name}
                  <small>
                    {displayTime(d.starts_at)} · {d.reserved || 0}/{d.capacity} vagas confirmadas
                  </small>
                </span>
                <span>{d.active ? "Aberta" : "Fechada"}</span>
              </summary>
              <DepartureEditor companyId={companyId} tours={inventory.tours} departure={d} />
            </details>
          ))}
        </>
      );
    else
      content = (
        <>
          <PageIntro
            eyebrow={area === "hotel" ? "OPERAÇÃO HOTELEIRA" : "OPERAÇÃO DE PASSEIOS"}
            title={companyDisplayName(company)}
            description={
              company.city +
              " · " +
              (company.status === "published"
                ? "Publicado no catálogo"
                : "Fora do catálogo público")
            }
          />
          <div className="account-grid">
            <div className="metric-card">
              <span>{area === "hotel" ? "Quartos cadastrados" : "Passeios cadastrados"}</span>
              <strong>{area === "hotel" ? inventory.rooms.length : inventory.tours.length}</strong>
              <span>Seu inventário</span>
            </div>
            <div className="metric-card">
              <span>Solicitações pendentes</span>
              <strong>{bookings.filter((b) => b.status === "pending").length}</strong>
              <span>Aguardando a sua análise</span>
            </div>
            <div className="metric-card">
              <span>Reservas confirmadas</span>
              <strong>{bookings.filter((b) => b.status === "confirmed").length}</strong>
              <span>Todos os períodos</span>
            </div>
          </div>
          <h2 className="subheading">Precisam da sua atenção</h2>
          <BookingList
            bookings={bookings.filter((b) => b.status === "pending").slice(0, 5)}
            business
          />
        </>
      );
  }
  return (
    <PanelShell
      module={area}
      section={section}
      companies={companies}
      companyId={companyId}
      modules={modules}
    >
      {content}
    </PanelShell>
  );
}
