import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import "./account.css";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  BriefcaseBusiness,
  CalendarCheck2,
  Clock3,
  Compass,
  Grid2X2,
  Settings2,
  Ship,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { ModuleSwitcher, publicModules, localizeModule } from "@/components/platform/shared";
import { ProfileEditor } from "@/components/platform/profile-editor";
import { pageActor } from "@/server/platform-session";
import { getDatabase } from "@/db";
import { companiesFor, isPlatformAdmin } from "@/server/platform-access";
import { myBookings } from "@/server/booking-service";
import { avatarKeyFromImage, defaultAvatarForUser, profileAvatarUrl } from "@/lib/profile-avatars";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
  alternates: { canonical: "/minha-conta" },
};

const moduleIcons: Record<string, LucideIcon> = {
  "/": Compass,
  "/hospedagens": BedDouble,
  "/gastronomia": UtensilsCrossed,
  "/experiencias": Compass,
  "/agencias": BriefcaseBusiness,
  "/servicos": Sparkles,
  "/navegacao": Ship,
  "/painel/hotel": BedDouble,
  "/painel/passeios": Compass,
  "/painel/plataforma": Settings2,
};

function entranceStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index * 65, 390)}ms` };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const { editar } = await searchParams;
  const [actor, locale] = await Promise.all([pageActor(), getLocale()]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const db = getDatabase();
  const [companies, bookings] = await Promise.all([companiesFor(db, actor), myBookings(db, actor)]);
  const admin = isPlatformAdmin(actor);
  const modules = publicModules.map((module) => localizeModule(module, locale));
  if (admin || companies.some((c) => c.kind === "hotel"))
    modules.push({
      href: "/painel/hotel",
      label: t("account.hotelPanel"),
      description: t("account.hotelPanelDescription"),
    });
  if (admin || companies.some((c) => c.kind === "operator"))
    modules.push({
      href: "/painel/passeios",
      label: t("account.experiencesPanel"),
      description: t("account.experiencesPanelDescription"),
    });
  if (admin)
    modules.push({
      href: "/painel/plataforma",
      label: t("account.adminPanel"),
      description: t("account.adminPanelDescription"),
    });
  const visibleModules = modules.filter((module) => module.href !== "/minha-conta");
  const avatar = avatarKeyFromImage(actor.image) ?? defaultAvatarForUser(actor.id);
  const metrics = [
    {
      label: t("account.requests"),
      value: bookings.length,
      detail: t("account.requestsDetail"),
      icon: CalendarCheck2,
      href: "/minha-conta/reservas",
    },
    {
      label: t("account.waiting"),
      value: bookings.filter((booking) => booking.status === "pending").length,
      detail: t("account.waitingDetail"),
      icon: Clock3,
    },
    {
      label: t("account.modules"),
      value: visibleModules.length,
      detail: t("account.modulesDetail"),
      icon: Grid2X2,
    },
  ];

  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main account-main">
        <div className="container">
          <section className="account-welcome account-motion" aria-labelledby="account-title">
            <div className="account-welcome-profile">
              <div className="account-avatar-frame">
                <Image
                  src={profileAvatarUrl(avatar)}
                  alt={`Avatar de ${actor.name}`}
                  width={100}
                  height={100}
                  priority
                />
              </div>
              <div className="account-welcome-copy">
                <p className="account-overline">{t("account.heading")}</p>
                <h1 id="account-title">
                  {t("account.greeting", { name: actor.name.trim().split(/\s+/)[0] })}
                </h1>
                <p>{t("account.description")}</p>
                <span className="account-user-email">{actor.email}</span>
              </div>
            </div>
            <ProfileEditor
              name={actor.name}
              email={actor.email}
              avatar={avatar}
              defaultOpen={editar === "perfil" || editar === "avatar"}
            />
          </section>

          <section className="account-stats" aria-label={t("account.summary")}>
            {metrics.map(({ label, value, detail, icon: Icon, href }, index) => {
              const card = (
                <>
                  <span className="account-stat-heading">
                    <span className="account-stat-icon">
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                  </span>
                  <strong>{value}</strong>
                  <span className="account-stat-detail">
                    {detail}
                    {href && <ArrowRight size={15} aria-hidden="true" />}
                  </span>
                </>
              );
              const className = "account-stat-card account-motion";
              return href ? (
                <Link className={className} href={href} key={label} style={entranceStyle(index)}>
                  {card}
                </Link>
              ) : (
                <article className={className} key={label} style={entranceStyle(index)}>
                  {card}
                </article>
              );
            })}
          </section>

          <section className="account-modules-section" aria-labelledby="account-modules-title">
            <div className="account-modules-heading">
              <div>
                <p className="account-section-kicker">{t("account.explore")}</p>
                <h2 id="account-modules-title">{t("account.destination")}</h2>
              </div>
              <p>{t("account.modulesDescription")}</p>
            </div>
            <div className="account-modules">
              {visibleModules.map((module, index) => {
                const Icon = moduleIcons[module.href] ?? Compass;
                const localizedModule = localizeModule(module, locale);
                return (
                  <Link
                    className="account-module-card account-motion"
                    href={module.href}
                    key={module.href}
                    style={entranceStyle(index)}
                  >
                    <div className="account-module-top">
                      <span className="account-module-icon">
                        <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <ArrowUpRight className="account-module-arrow" size={19} aria-hidden="true" />
                    </div>
                    <h3>{localizedModule.label}</h3>
                    <p>{localizedModule.description}</p>
                    <span className="account-module-action">
                      {t("account.exploreAction")} <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="portal-toolbar account-tools">
            <ModuleSwitcher modules={modules} />
            <p>{t("account.panelAccessNote")}</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
