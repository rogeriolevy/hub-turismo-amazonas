"use client";

import { ArrowUpRight } from "lucide-react";
import { navigationSources, type ReferencePrice, type SourceId } from "@/lib/navigation-data";
import { isHistoricalPrice } from "@/lib/navigation";
import { useLanguage } from "@/components/site/language-provider";

export function SourceLink({ id }: { id: SourceId }) {
  const source = navigationSources[id];
  if (!("url" in source)) return <span>{source.name}</span>;
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.name} <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

export function Price({ price, today }: { price: ReferencePrice | null; today: string }) {
  const { locale, t } = useLanguage();
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, { timeZone: "UTC" }).format(
      new Date(date + "T12:00:00Z"),
    );
  const formatMoney = (cents: number) =>
    new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale, {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  if (!price)
    return (
      <div className="nav-price">
        <span>{t("navigation.unconfirmedFare")}</span>
        <strong>{t("navigation.onRequest")}</strong>
      </div>
    );
  const historical = isHistoricalPrice(price, today);
  return (
    <div className="nav-price">
      <span>
        {historical ? t("navigation.historicalFare") : t("navigation.foundValue")}
        {price.from ? t("navigation.from") : ""}
      </span>
      <div>
        <strong>{formatMoney(price.amountCents)}</strong>
        <span> / {price.unit}</span>
      </div>
      {price.travelDate && (
        <small>
          {t("navigation.forDate")} {formatDate(price.travelDate)}
        </small>
      )}
      <small>
        {t("navigation.checkedAt")} {formatDate(price.observedAt)}
        {t("navigation.subjectToChange")}
      </small>
    </div>
  );
}
