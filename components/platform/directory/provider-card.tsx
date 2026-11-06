import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { CatalogCategory, CatalogItem } from "@/lib/catalog-content";
import { displayPublicPhone } from "@/lib/public-contacts";
import { getLocale } from "@/lib/i18n/server";
import { translate, translateText } from "@/lib/i18n/messages";
import { fromHub, type PublicProvider } from "@/server/cadastur/public-directory";
import { providerDirectoryModules } from "./config";
import "../provider-directory.css";

export async function ProviderContacts({
  entry,
}: {
  entry: Pick<PublicProvider, "phone" | "email" | "address" | "website">;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="provider-contacts">
      {entry.phone ? (
        <a href={"tel:" + entry.phone}>
          <Phone size={15} aria-hidden="true" />
          <span>{displayPublicPhone(entry.phone)}</span>
        </a>
      ) : (
        <span>
          <Phone size={15} aria-hidden="true" />
          {t("directory.phoneMissing")}
        </span>
      )}
      {entry.email ? (
        <a href={"mailto:" + entry.email}>
          <Mail size={15} aria-hidden="true" />
          <span>{entry.email}</span>
        </a>
      ) : (
        <span>
          <Mail size={15} aria-hidden="true" />
          {t("directory.emailMissing")}
        </span>
      )}
      <span>
        <MapPin size={15} aria-hidden="true" />
        <span>{entry.address || t("directory.addressMissing")}</span>
      </span>
      {entry.website && (
        <a href={entry.website} target="_blank" rel="noopener noreferrer">
          <Globe size={15} aria-hidden="true" />
          <span>{t("directory.visitSite")}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export async function ProviderCard({ entry }: { entry: PublicProvider }) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const category: CatalogCategory = entry.category;
  const config = providerDirectoryModules[category];
  const Icon = config.icon;
  const categoryLabel = translateText(locale, config.label);
  return (
    <article className="provider-card">
      <div className="provider-card-top">
        <span className="provider-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
        <span>
          {entry.city} · {entry.uf}
        </span>
      </div>
      {entry.images[0] && (
        <Image
          unoptimized
          className="provider-card-photo"
          src={entry.images[0]}
          alt={`Imagem de ${entry.name}`}
          width={1280}
          height={720}
          sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 33vw"
          loading="lazy"
        />
      )}
      <h2>
        <Link href={"/prestadores/" + entry.id}>{entry.name}</Link>
      </h2>
      <p className="provider-subtype">{entry.subtype || categoryLabel}</p>
      {entry.summary && <p className="provider-card-summary">{entry.summary}</p>}
      <ProviderContacts entry={entry} />
      <div className="provider-card-bottom">
        <span>
          {category === "hospedagens"
            ? t("directory.dailyOnRequest")
            : category === "agencias"
              ? t("directory.packagesOnRequest")
              : entry.editorial
                ? t("directory.hubContent")
                : t("directory.meetProvider")}
        </span>
        <Link href={"/prestadores/" + entry.id} aria-label={"Ver detalhes de " + entry.name}>
          <ArrowUpRight size={21} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export async function HubContentGrid({ items, title }: { items: CatalogItem[]; title: string }) {
  if (!items.length) return null;
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <section className="provider-results hub-content-results" aria-label={title}>
      <div className="provider-section-heading">
        <div>
          <p className="eyebrow">{t("directory.hubContentLabel")}</p>
          <h2>{translateText(locale, title)}</h2>
        </div>
        <span>
          {items.length}{" "}
          {t(items.length === 1 ? "directory.presentation" : "directory.presentations")}
        </span>
      </div>
      <div className="provider-grid">
        {items.map((item) => (
          <ProviderCard key={item.id} entry={fromHub(item)} />
        ))}
      </div>
    </section>
  );
}
