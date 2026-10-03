import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  Files,
  Globe2,
  MessageSquareText,
  ShieldCheck,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import styles from "./admin-dashboard.module.css";
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
import { HotelOperationSummary, RoomStatusBoard } from "@/components/platform/room-status-board";
import { CadasturPanel } from "@/components/platform/cadastur-panel";
import { CatalogContentPanel } from "@/components/platform/catalog-content-panel";
import {
  catalogCategories,
  type CatalogCategory,
  type CatalogSourceEntry,
} from "@/lib/catalog-content";
import { listCatalogItems } from "@/server/catalog-content-service";
import { listDirectory } from "@/server/cadastur/service";
import { pageActor } from "@/server/platform-session";
import { companiesFor, isPlatformAdmin } from "@/server/platform-access";
import { companyInventory, listMembers } from "@/server/company-service";
import { businessBookings } from "@/server/booking-service";
import { one, many } from "@/server/platform-store";
import { getDatabase } from "@/db";
import {
  roles,
  money,
  displayTime,
  displayDate,
  companyDisplayName,
  todayInManaus,
} from "@/lib/platform-schema";
import { avatarKeyFromImage, defaultAvatarForUser, profileAvatarUrl } from "@/lib/profile-avatars";
export const metadata = { title: "Painel de operação", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type AdminDashboardProps = {
  actor: { id: string; name: string; email: string; image?: string | null };
  companyCount: number;
  publishedCount: number;
  memberCount: number;
  pendingCadastur: number;
  contactCount: number;
};

function AdminDashboard({
  actor,
  companyCount,
  publishedCount,
  memberCount,
  pendingCadastur,
  contactCount,
}: AdminDashboardProps) {
  const avatar = avatarKeyFromImage(actor.image) ?? defaultAvatarForUser(actor.id);
  const firstName = actor.name.trim().split(/\s+/)[0] || "administrador";
  const metrics: {
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    href: string;
  }[] = [
    {
      label: "Empresas cadastradas",
      value: companyCount,
      detail: `${publishedCount} publicadas no catálogo`,
      icon: Building2,
      href: "/painel/plataforma/empresas",
    },
    {
      label: "Vínculos de equipe",
      value: memberCount,
      detail: "Acessos concedidos às empresas",
      icon: UsersRound,
      href: "/painel/plataforma/acessos",
    },
    {
      label: "Cadastur a revisar",
      value: pendingCadastur,
      detail: "Cadastros aguardando análise",
      icon: ClipboardCheck,
      href: "/painel/plataforma/cadastur",
    },
    {
      label: "Contatos recebidos",
      value: contactCount,
      detail: "Mensagens enviadas pelo site",
      icon: MessageSquareText,
      href: "/painel/contato",
    },
  ];
  const actions: {
    title: string;
    description: string;
    href: string;
    label: string;
    icon: LucideIcon;
  }[] = [
    {
      title: "Empresas",
      description: "Cadastre parceiros e mantenha os perfis da rede atualizados.",
      href: "/painel/plataforma/empresas",
      label: "Gerenciar empresas",
      icon: Building2,
    },
    {
      title: "Contas e permissões",
      description: "Vincule pessoas às empresas e defina seus perfis de trabalho.",
      href: "/painel/plataforma/acessos",
      label: "Gerenciar acessos",
      icon: ShieldCheck,
    },
    {
      title: "Diretório Cadastur",
      description: "Revise, associe e publique informações do diretório turístico.",
      href: "/painel/plataforma/cadastur",
      label: "Abrir diretório",
      icon: ClipboardCheck,
    },
    {
      title: "Conteúdos dos catálogos",
      description: "Edite apresentações, contatos e imagens dos sete módulos públicos.",
      href: "/painel/plataforma/conteudos",
      label: "Gerenciar conteúdos",
      icon: Files,
    },
    {
      title: "Contatos do site",
      description: "Consulte as mensagens enviadas pelos visitantes da Hub.",
      href: "/painel/contato",
      label: "Ver mensagens",
      icon: MessageSquareText,
    },
  ];

  return (
    <div className={styles.dashboard}>
      <section
        className={`${styles.welcome} ${styles.motion}`}
        aria-labelledby="admin-dashboard-title"
      >
        <div className={styles.welcomeProfile}>
          <div className={styles.avatarFrame}>
            <Image
              src={profileAvatarUrl(avatar)}
              alt={`Avatar de ${actor.name}`}
              width={88}
              height={88}
              priority
            />
          </div>
          <div className={styles.welcomeCopy}>
            <p className={styles.eyebrow}>PAINEL DO ADMINISTRADOR</p>
            <h1 id="admin-dashboard-title">Olá, {firstName}.</h1>
            <p>Gerencie a rede de parceiros e os serviços da Hub Amazonas.</p>
            <span>{actor.email}</span>
          </div>
        </div>
        <div className={styles.welcomeActions}>
          <Link href="/minha-conta?editar=perfil">
            Meu perfil <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/">
            <Globe2 size={16} aria-hidden="true" /> Ver site
          </Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Resumo administrativo">
        {metrics.map(({ label, value, detail, icon: Icon, href }, index) => (
          <Link
            className={`${styles.metric} ${styles.motion}`}
            href={href}
            key={label}
            style={{ animationDelay: `${Math.min(index * 65, 260)}ms` }}
          >
            <span className={styles.metricHeading}>
              <span className={styles.metricIcon}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              {label}
            </span>
            <strong>{value}</strong>
            <span className={styles.metricDetail}>
              {detail} <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>

      <section className={styles.actionsSection} aria-labelledby="admin-actions-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>CENTRO DE CONTROLE</p>
            <h2 id="admin-actions-title">Acessos administrativos</h2>
          </div>
          <p>Atalhos para as tarefas mais importantes da plataforma.</p>
        </div>
        <div className={styles.actions}>
          {actions.map(({ title, description, href, label, icon: Icon }, index) => (
            <Link
              className={`${styles.actionCard} ${styles.motion}`}
              href={href}
              key={title}
              style={{ animationDelay: `${Math.min(index * 65, 260)}ms` }}
            >
              <span className={styles.actionIcon}>
                <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <ArrowUpRight className={styles.actionArrow} size={18} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
              <span className={styles.actionLink}>
                {label} <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className={styles.footerNote}>
        <span className={styles.footerIcon}>
          <ShieldCheck size={19} aria-hidden="true" />
        </span>
        <p>
          As permissões são verificadas em cada operação. Use <strong>Contas e permissões</strong>{" "}
          para conceder acesso de equipe às empresas.
        </p>
      </div>
    </div>
  );
}

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
  searchParams: Promise<{ empresa?: string; categoria?: string; cadastur?: string }>;
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
        : ["", "empresas", "acessos", "cadastur", "conteudos"];
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
  const query = await searchParams;
  const requested = query.empresa;
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
    else if (section === "conteudos") {
      const category = catalogCategories.includes(query.categoria as CatalogCategory)
        ? (query.categoria as CatalogCategory)
        : "hospedagens";
      const sourceRow = query.cadastur
        ? one<CatalogSourceEntry & { category: string }>(
            db,
            "SELECT id,category,name,city,subtype,phone,email,address,website FROM cadastur_entries WHERE id=?",
            query.cadastur,
          )
        : undefined;
      const sourceEntry: CatalogSourceEntry | undefined =
        sourceRow?.category === category
          ? {
              id: sourceRow.id,
              category,
              name: sourceRow.name,
              city: sourceRow.city,
              subtype: sourceRow.subtype,
              phone: sourceRow.phone,
              email: sourceRow.email,
              address: sourceRow.address,
              website: sourceRow.website,
            }
          : undefined;
      content = (
        <CatalogContentPanel
          category={category}
          items={listCatalogItems(db, actor)}
          sourceEntry={sourceEntry}
        />
      );
    } else if (section === "empresas")
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
    else {
      const publishedCount = allCompanies.filter(
        (company) => company.status === "published",
      ).length;
      const contactCount = one<{ n: number }>(db, "SELECT COUNT(*) n FROM contacts")?.n ?? 0;
      const pendingCadastur =
        one<{ n: number }>(
          db,
          "SELECT COUNT(*) n FROM cadastur_entries WHERE review_status='pending'",
        )?.n ?? 0;
      content = (
        <AdminDashboard
          actor={actor}
          companyCount={allCompanies.length}
          publishedCount={publishedCount}
          memberCount={members.length}
          pendingCadastur={pendingCadastur}
          contactCount={contactCount}
        />
      );
    }
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
          <RoomStatusBoard companyId={companyId} rooms={inventory.rooms} />
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
            description={
              area === "hotel"
                ? "Aprove solicitações e registre check-in e check-out diretamente na reserva, conforme o período da estadia."
                : "Analise os pedidos. A disponibilidade é conferida novamente no momento da aprovação."
            }
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
    else if (section === "fnrh") {
      const today = todayInManaus();
      content = (
        <>
          <PageIntro
            eyebrow={companyDisplayName(company)}
            title="FNRH · Registro de estadias"
            description="Organize chegadas e saídas vinculadas às reservas confirmadas. O registro também pode ser iniciado na lista de reservas."
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
                    ) : b.check_in! <= today && today < b.check_out! ? (
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
                    ) : (
                      <p>
                        O check-in poderá ser registrado entre {displayDate(b.check_in!)} e{" "}
                        {displayDate(b.check_out!)}.
                      </p>
                    )}
                  </article>
                ))}
            </div>
          )}
        </>
      );
    } else if (section === "guias")
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
    else if (area === "hotel") {
      const today = todayInManaus();
      const pendingBookings = bookings.filter((booking) => booking.status === "pending");
      const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed");
      const occupiedRooms = inventory.rooms.filter((room) => room.current_guest).length;
      const readyRooms = inventory.rooms.filter(
        (room) => room.operational_status === "ready" && !room.current_guest,
      ).length;
      const roomsToPrepare = inventory.rooms.filter(
        (room) =>
          room.operational_status === "cleaning" || room.operational_status === "maintenance",
      ).length;
      const arrivalsToday = confirmedBookings.filter(
        (booking) => booking.check_in === today && !booking.checked_in_at,
      ).length;
      const departuresToday = confirmedBookings.filter(
        (booking) => booking.check_out === today && !booking.checked_out_at,
      ).length;
      const actionableBookings = bookings.filter(
        (booking) =>
          booking.status === "pending" ||
          (booking.status === "confirmed" &&
            ((booking.checked_in_at && !booking.checked_out_at) ||
              (booking.check_in === today && !booking.checked_in_at))),
      );
      content = (
        <>
          <PageIntro
            eyebrow="OPERAÇÃO HOTELEIRA"
            title={companyDisplayName(company)}
            description={`${company.city} · ${company.status === "published" ? "Publicado no catálogo" : "Fora do catálogo público"}`}
          />
          <HotelOperationSummary
            arrivals={arrivalsToday}
            departures={departuresToday}
            pendingBookings={pendingBookings.length}
            roomsToPrepare={roomsToPrepare}
          />
          <div className="hotel-operations-metrics" aria-label="Resumo de quartos e reservas">
            <Link
              className="hotel-operations-metric"
              href={`/painel/hotel/quartos?empresa=${companyId}`}
            >
              <span className="hotel-operations-metric-icon">
                <BedDouble size={18} aria-hidden="true" />
              </span>
              <span>Quartos prontos</span>
              <strong>{readyRooms}</strong>
              <span>Conferir acomodações →</span>
            </Link>
            <Link
              className="hotel-operations-metric"
              href={`/painel/hotel/fnrh?empresa=${companyId}`}
            >
              <span className="hotel-operations-metric-icon">
                <UsersRound size={18} aria-hidden="true" />
              </span>
              <span>Hóspedes hospedados</span>
              <strong>{occupiedRooms}</strong>
              <span>Estadias com check-in →</span>
            </Link>
            <Link
              className="hotel-operations-metric"
              href={`/painel/hotel/quartos?empresa=${companyId}`}
            >
              <span className="hotel-operations-metric-icon">
                <Wrench size={18} aria-hidden="true" />
              </span>
              <span>Limpeza ou manutenção</span>
              <strong>{roomsToPrepare}</strong>
              <span>Atualizar situação →</span>
            </Link>
            <Link
              className="hotel-operations-metric"
              href={`/painel/hotel/reservas?empresa=${companyId}`}
            >
              <span className="hotel-operations-metric-icon">
                <CalendarCheck2 size={18} aria-hidden="true" />
              </span>
              <span>Solicitações pendentes</span>
              <strong>{pendingBookings.length}</strong>
              <span>Aguardando análise →</span>
            </Link>
          </div>
          <RoomStatusBoard companyId={companyId} rooms={inventory.rooms} />
          <h2 className="subheading">Precisam da sua atenção</h2>
          <BookingList bookings={actionableBookings.slice(0, 5)} business />
        </>
      );
    } else
      content = (
        <>
          <PageIntro
            eyebrow="OPERAÇÃO DE PASSEIOS"
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
              <span>Passeios cadastrados</span>
              <strong>{inventory.tours.length}</strong>
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
