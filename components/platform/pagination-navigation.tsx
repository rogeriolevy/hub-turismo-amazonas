import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

export async function PaginationNavigation({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const locale = await getLocale();
  return (
    <nav className="cadastur-pagination" aria-label={translate(locale, "pagination.label")}>
      {page > 1 ? (
        <Link className="button button-outline" href={hrefForPage(page - 1)}>
          {translate(locale, "pagination.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span>{translate(locale, "pagination.page", { page, totalPages })}</span>
      {page < totalPages ? (
        <Link className="button button-outline" href={hrefForPage(page + 1)}>
          {translate(locale, "pagination.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
