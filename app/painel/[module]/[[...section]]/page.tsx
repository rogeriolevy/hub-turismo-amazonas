import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header, Footer } from "@/components/site/navigation";
import { PanelShell } from "@/components/platform/panel-shell";
import { EmptyState, type ModuleLink } from "@/components/platform/shared";
import { BookingManagement } from "@/components/platform/booking-management";
import { HotelOverview } from "@/components/platform/hotel/overview";
import { RoomManagement } from "@/components/platform/hotel/room-management";
import { StayManagement } from "@/components/platform/hotel/stay-management";
import { ExperiencesOverview } from "@/components/platform/experiences/overview";
import { TourGuideManagement } from "@/components/platform/experiences/tour-guide-management";
import { DepartureManagement } from "@/components/platform/experiences/departure-management";
import { GuideSchedule } from "@/components/platform/experiences/guide-schedule";
import { CompanyManagement } from "@/components/platform/administration/company-management";
import { AccessManagement } from "@/components/platform/administration/access-management";
import { AdministrationOverview } from "./_components/administration/overview";
import { CadasturPanel } from "@/components/platform/cadastur-panel";
import { CatalogContentPanel } from "@/components/platform/catalog-content-panel";
import { AuditLogPanel } from "@/components/platform/audit-log-panel";
import { BookingEmailOperations } from "@/components/platform/booking-email-operations";
import { catalogContentManagementPage } from "@/server/catalog-content-service";
import { listDirectory } from "@/server/cadastur/directory-service";
import { pageActor } from "@/server/platform-session";
import {
  companiesPageFor,
  companyMember,
  companyRole as getCompanyRole,
  firstCompanyForKind,
  isPlatformAdmin,
} from "@/server/platform-access";
import { companyCounts } from "@/server/company-service";
import { listMembersPage } from "@/server/company-membership-service";
import { platformDashboardSummary } from "@/server/platform-dashboard-service";
import { bookingEmailOperationsSummary } from "@/server/booking-email-operations-service";
import { companyForPanel, companyGuideDeparturesPage } from "@/server/inventory-read-service";
import { businessPanelReadData } from "@/server/business-panel-read-service";
import { listAuditEntries } from "@/server/audit-service";
import { HttpError } from "@/server/http";
import { getDatabase } from "@/db";
import {
  isPanelArea,
  isPanelSection,
  panelAreas,
  panelSectionAlias,
} from "@/lib/platform-navigation";
import { companyDisplayName } from "@/lib/platform-schema/company";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { unreadNotificationCount } from "@/server/notification-service";
export const metadata = { title: "Painel de operação", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function Denied() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <>
      <Header />
      <main className="portal-main container" id="conteudo" tabIndex={-1}>
        <EmptyState title={t("admin.deniedTitle")}>
          <p>{t("admin.deniedText")}</p>
          <Link className="button button-dark" href="/minha-conta">
            {t("admin.backAccount")}
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
  searchParams: Promise<{
    empresa?: string;
    categoria?: string;
    cadastur?: string;
    page?: string;
    roomPage?: string;
    tourPage?: string;
    guidePage?: string;
    departurePage?: string;
    reserva?: string;
    memberPage?: string;
    companyPage?: string;
  }>;
}) {
  const route = await params;
  const locale = await getLocale();
  if (!isPanelArea(route.module)) notFound();
  const area = route.module,
    section = route.section?.join("/") || "";
  const query = await searchParams;
  const canonicalSection = panelSectionAlias(area, section);
  if (canonicalSection) {
    const companyQuery =
      typeof query.empresa === "string" ? `?empresa=${encodeURIComponent(query.empresa)}` : "";
    redirect(`/painel/${area}/${canonicalSection}${companyQuery}`);
  }
  if (!isPanelSection(area, section)) notFound();
  const actor = await pageActor("/painel/" + area),
    db = getDatabase(),
    admin = isPlatformAdmin(actor);
  const unreadNotifications = await unreadNotificationCount(db, actor);
  const [firstHotel, firstOperator] =
    area === "plataforma"
      ? [undefined, undefined]
      : await Promise.all([
          firstCompanyForKind(db, actor, "hotel"),
          firstCompanyForKind(db, actor, "operator"),
        ]);
  if (area === "plataforma" && !admin) return <Denied />;
  const requested = query.empresa;
  const companyKind = panelAreas[area].companyKind ?? "operator";
  const firstCompany =
    companyKind === "hotel" ? firstHotel : companyKind === "operator" ? firstOperator : undefined;
  const hasCompanies = Boolean(firstCompany);
  const companyId = typeof requested === "string" ? requested : firstCompany?.id;
  if (area !== "plataforma" && !admin && !hasCompanies) return <Denied />;
  let selectedCompany: Awaited<ReturnType<typeof companyForPanel>> | undefined;
  let memberRole: "hotel_manager" | "hotel_staff" | "operator" | "guide" | null = null;
  if (area !== "plataforma" && companyId) {
    try {
      selectedCompany = await companyForPanel(db, actor, companyId, companyKind);
      memberRole = await getCompanyRole(db, actor, companyId);
    } catch (error) {
      if (error instanceof HttpError && (error.status === 403 || error.status === 404))
        return <Denied />;
      throw error;
    }
  }
  if (memberRole === "guide" && (area !== "passeios" || section !== "")) return <Denied />;
  const modules: ModuleLink[] = [];
  if (admin || firstHotel)
    modules.push({
      href: "/painel/hotel",
      label: "Painel hoteleiro",
      description: "Quartos, reservas e estadias.",
    });
  if (admin || firstOperator)
    modules.push({
      href: "/painel/passeios",
      label: "Painel de experiências",
      description: "Passeios, guias, agenda e vagas.",
    });
  if (admin)
    modules.push({
      href: "/painel/plataforma",
      label: "Administração geral",
      description: "Empresas e permissões.",
    });
  let content: React.ReactNode;
  if (area === "plataforma") {
    const [membersPage, companiesPage, companySummary, dashboardSummary] = await Promise.all([
      section === "acessos"
        ? listMembersPage(db, actor, query.memberPage)
        : Promise.resolve(undefined),
      section === "empresas"
        ? companiesPageFor(db, actor, query.companyPage)
        : Promise.resolve(undefined),
      section === "acessos" ? companyCounts(db, actor) : Promise.resolve(undefined),
      section === "" ? platformDashboardSummary(db, actor) : Promise.resolve(undefined),
    ]);
    if (section === "auditoria") {
      const data = await listAuditEntries(db, actor, {
        companyId: typeof query.empresa === "string" ? query.empresa : undefined,
        page: query.page,
      });
      content = <AuditLogPanel data={data} />;
    } else if (section === "notificacoes-email") {
      const data = await bookingEmailOperationsSummary(db, actor);
      content = <BookingEmailOperations data={data} locale={locale} />;
    } else if (section === "cadastur") {
      const initial = await listDirectory(db, actor, { category: "hospedagens" });
      content = <CadasturPanel initial={initial} locale={locale} />;
    } else if (section === "conteudos") {
      const catalogPage = await catalogContentManagementPage(db, actor, query);
      content = <CatalogContentPanel {...catalogPage} />;
    } else if (section === "empresas")
      content = <CompanyManagement companiesPage={companiesPage!} locale={locale} />;
    else if (section === "acessos")
      content = (
        <AccessManagement
          membersPage={membersPage!}
          companyCount={companySummary?.total ?? 0}
          locale={locale}
        />
      );
    else if (section === "") {
      if (!dashboardSummary) notFound();
      content = (
        <AdministrationOverview
          locale={locale}
          actor={actor}
          companyCount={dashboardSummary.companyCount}
          publishedCount={dashboardSummary.publishedCount}
          memberCount={dashboardSummary.memberCount}
          pendingCadastur={dashboardSummary.pendingCadastur}
          contactCount={dashboardSummary.contactCount}
          bookingRows={dashboardSummary.bookingRows}
        />
      );
    } else notFound();
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
    const company = selectedCompany!;
    const guideMember = memberRole === "guide" ? await companyMember(db, actor, companyId) : null;
    const guideSchedule =
      memberRole === "guide" && guideMember?.guide_id
        ? await companyGuideDeparturesPage(db, actor, companyId, query.departurePage)
        : undefined;
    const businessData =
      memberRole === "guide"
        ? undefined
        : await businessPanelReadData(db, actor, area, section, companyId, {
            ...query,
            bookingId: typeof query.reserva === "string" ? query.reserva : undefined,
          });
    const {
      bookingPage,
      stayPage,
      bookingSummary,
      attentionBookings,
      roomsPage,
      roomSummary,
      guidesPage,
      guideOptions,
      toursPage,
      tourOptions,
      departuresPage,
      operatorSummary,
    } = businessData ?? {};
    const rooms = roomsPage?.items ?? [];
    const pageUrl = (
      targetSection: string,
      pageKey: string,
      page: number,
      preserve: Record<string, string | undefined> = {},
    ) => {
      const params = new URLSearchParams({ empresa: companyId });
      for (const [key, value] of Object.entries(preserve)) if (value) params.set(key, value);
      params.set(pageKey, String(page));
      const pathname = `/painel/${area}${targetSection ? `/${targetSection}` : ""}`;
      return `${pathname}?${params.toString()}`;
    };
    if (memberRole === "guide")
      content = guideSchedule ? (
        <GuideSchedule
          companyName={companyDisplayName(company)}
          departuresPage={guideSchedule}
          hrefForPage={(page) => pageUrl("", "departurePage", page)}
        />
      ) : (
        <EmptyState title="Acesso aguardando configuração">
          <p>A administração precisa vincular sua conta ao cadastro correto de guia.</p>
        </EmptyState>
      );
    else if (section === "quartos")
      content = (
        <RoomManagement
          companyId={companyId}
          companyName={companyDisplayName(company)}
          roomsPage={roomsPage!}
          canManageInventory={admin || memberRole === "hotel_manager"}
        />
      );
    else if (section === "reservas" || section === "vagas")
      content = (
        <BookingManagement
          area={area === "hotel" ? "hotel" : "passeios"}
          section={section}
          companyName={companyDisplayName(company)}
          bookingPage={bookingPage!}
          bookingHrefForPage={(page) =>
            pageUrl(section, "page", page, {
              departurePage: section === "vagas" ? query.departurePage : undefined,
            })
          }
          departuresPage={departuresPage}
          departureHrefForPage={
            section === "vagas"
              ? (page) => pageUrl("vagas", "departurePage", page, { page: query.page })
              : undefined
          }
        />
      );
    else if (section === "fnrh") {
      content = (
        <StayManagement
          companyId={companyId}
          companyName={companyDisplayName(company)}
          stayPage={stayPage!}
        />
      );
    } else if (section === "experiencias")
      content = (
        <TourGuideManagement
          companyId={companyId}
          companyName={companyDisplayName(company)}
          toursPage={toursPage!}
          guidesPage={guidesPage!}
          guideOptions={guideOptions ?? []}
          tourHrefForPage={(page) =>
            pageUrl("experiencias", "tourPage", page, { guidePage: query.guidePage })
          }
          guideHrefForPage={(page) =>
            pageUrl("experiencias", "guidePage", page, { tourPage: query.tourPage })
          }
        />
      );
    else if (section === "agenda")
      content = (
        <DepartureManagement
          companyId={companyId}
          companyName={companyDisplayName(company)}
          departuresPage={departuresPage!}
          tourOptions={tourOptions ?? []}
          hrefForPage={(page) => pageUrl("agenda", "departurePage", page)}
        />
      );
    else if (area === "hotel") {
      content = (
        <HotelOverview
          company={company}
          companyId={companyId}
          bookingSummary={bookingSummary!}
          roomSummary={roomSummary!}
          rooms={rooms}
          roomsPage={roomsPage}
          attentionBookings={attentionBookings ?? []}
        />
      );
    } else
      content = (
        <ExperiencesOverview
          company={company}
          operatorSummary={operatorSummary!}
          bookingSummary={bookingSummary!}
          attentionBookings={attentionBookings ?? []}
        />
      );
  }
  return (
    <PanelShell
      module={area}
      section={section}
      hasCompanies={area !== "plataforma" && hasCompanies}
      companyId={companyId}
      companyKind={area !== "plataforma" ? companyKind : undefined}
      guideMode={memberRole === "guide"}
      unreadNotifications={unreadNotifications}
      modules={modules}
    >
      {content}
    </PanelShell>
  );
}
