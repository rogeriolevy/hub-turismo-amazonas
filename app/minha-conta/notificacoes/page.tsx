import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { PageIntro } from "@/components/platform/shared";
import { NotificationInbox } from "@/components/platform/notification-inbox";
import { PaginationNavigation } from "@/components/platform/pagination-navigation";
import { getDatabase } from "@/db";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { myNotificationsPage } from "@/server/notification-service";
import { pageActor } from "@/server/platform-session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notificações",
  robots: { index: false, follow: false },
  alternates: { canonical: "/minha-conta/notificacoes" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [actor, locale] = await Promise.all([pageActor("/minha-conta/notificacoes"), getLocale()]);
  const query = await searchParams;
  const page = typeof query.page === "string" ? query.page : undefined;
  const notifications = await myNotificationsPage(getDatabase(), actor, page);
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link href="/minha-conta" className="text-link">
            ← {translate(locale, "panel.myAccount")}
          </Link>
          <PageIntro
            eyebrow={translate(locale, "panel.myAccount").toLocaleUpperCase(locale)}
            title={translate(locale, "notifications.title")}
            description={translate(locale, "notifications.description")}
          />
          <NotificationInbox items={notifications.items} unreadCount={notifications.unreadCount} />
          <PaginationNavigation
            page={notifications.page}
            totalPages={notifications.totalPages}
            hrefForPage={(page) => `/minha-conta/notificacoes?page=${page}`}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
