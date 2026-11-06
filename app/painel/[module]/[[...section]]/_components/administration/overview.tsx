import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  Files,
  Globe2,
  MessageSquareText,
  MailCheck,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import styles from "./overview.module.css";
import { avatarKeyFromImage, defaultAvatarForUser, profileAvatarUrl } from "@/lib/profile-avatars";
import { translate, type Locale, type MessageKey } from "@/lib/i18n/messages";
import type { PlatformBookingStatusSummary } from "@/server/platform-dashboard-service";

type AdministrationOverviewProps = {
  locale: Locale;
  actor: { id: string; name: string; email: string; image?: string | null };
  companyCount: number;
  publishedCount: number;
  memberCount: number;
  pendingCadastur: number;
  contactCount: number;
  bookingRows: PlatformBookingStatusSummary[];
};

export function AdministrationOverview({
  locale,
  actor,
  companyCount,
  publishedCount,
  memberCount,
  pendingCadastur,
  contactCount,
  bookingRows,
}: AdministrationOverviewProps) {
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const avatar = avatarKeyFromImage(actor.image) ?? defaultAvatarForUser(actor.id);
  const firstName = actor.name.trim().split(/\s+/)[0] || "administrador";
  const bookingTotals = bookingRows.reduce(
    (totals, row) => ({
      hotels: totals.hotels + row.hotels,
      tours: totals.tours + row.tours,
      total: totals.total + row.total,
    }),
    { hotels: 0, tours: 0, total: 0 },
  );
  const metrics: {
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    href: string;
  }[] = [
    {
      label: t("admin.companies"),
      value: companyCount,
      detail: t("admin.published", { count: publishedCount }),
      icon: Building2,
      href: "/painel/plataforma/empresas",
    },
    {
      label: t("admin.members"),
      value: memberCount,
      detail: t("admin.membersDetail"),
      icon: UsersRound,
      href: "/painel/plataforma/acessos",
    },
    {
      label: t("admin.cadastur"),
      value: pendingCadastur,
      detail: t("admin.cadasturDetail"),
      icon: ClipboardCheck,
      href: "/painel/plataforma/cadastur",
    },
    {
      label: t("admin.contacts"),
      value: contactCount,
      detail: t("admin.contactsDetail"),
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
      title: t("admin.companiesTitle"),
      description: t("admin.companiesDescription"),
      href: "/painel/plataforma/empresas",
      label: t("admin.manageCompanies"),
      icon: Building2,
    },
    {
      title: t("admin.membersTitle"),
      description: t("admin.membersDescription"),
      href: "/painel/plataforma/acessos",
      label: t("admin.manageMembers"),
      icon: ShieldCheck,
    },
    {
      title: t("admin.directoryTitle"),
      description: t("admin.directoryDescription"),
      href: "/painel/plataforma/cadastur",
      label: t("admin.openDirectory"),
      icon: ClipboardCheck,
    },
    {
      title: t("admin.contentTitle"),
      description: t("admin.contentDescription"),
      href: "/painel/plataforma/conteudos",
      label: t("admin.manageContent"),
      icon: Files,
    },
    {
      title: t("admin.contactsTitle"),
      description: t("admin.contactsDescription"),
      href: "/painel/contato",
      label: t("admin.viewMessages"),
      icon: MessageSquareText,
    },
    {
      title: t("admin.emailOperationsTitle"),
      description: t("admin.emailOperationsDescription"),
      href: "/painel/plataforma/notificacoes-email",
      label: t("admin.openEmailOperations"),
      icon: MailCheck,
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
            <p className={styles.eyebrow}>{t("admin.panel")}</p>
            <h1 id="admin-dashboard-title">{t("admin.greeting", { name: firstName })}</h1>
            <p>{t("admin.description")}</p>
            <span>{actor.email}</span>
          </div>
        </div>
        <div className={styles.welcomeActions}>
          <Link href="/minha-conta?editar=perfil">
            {t("admin.profile")} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/">
            <Globe2 size={16} aria-hidden="true" /> {t("admin.viewSite")}
          </Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label={t("admin.summary")}>
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

      <section className={styles.bookingReport} aria-labelledby="admin-booking-report-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>{t("admin.controlCenter")}</p>
            <h2 id="admin-booking-report-title">{t("admin.bookingReport")}</h2>
          </div>
          <p>{t("admin.bookingReportDescription")}</p>
        </div>
        <div className={styles.bookingTableWrap}>
          <table className={styles.bookingTable} aria-label={t("admin.bookingReport")}>
            <thead>
              <tr>
                <th scope="col">{t("admin.bookingStatus")}</th>
                <th scope="col">{t("admin.bookingHotels")}</th>
                <th scope="col">{t("admin.bookingTours")}</th>
                <th scope="col">{t("admin.bookingTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {bookingRows.map((row) => (
                <tr key={row.status}>
                  <th scope="row">{t(`bookingLabels.${row.status}` as MessageKey)}</th>
                  <td>{row.hotels}</td>
                  <td>{row.tours}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t("admin.bookingTotal")}</th>
                <td>{bookingTotals.hotels}</td>
                <td>{bookingTotals.tours}</td>
                <td>{bookingTotals.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className={styles.actionsSection} aria-labelledby="admin-actions-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>{t("admin.controlCenter")}</p>
            <h2 id="admin-actions-title">{t("admin.accesses")}</h2>
          </div>
          <p>{t("admin.accessesDescription")}</p>
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
        <p>{t("admin.permissionNotice")}</p>
      </div>
    </div>
  );
}
