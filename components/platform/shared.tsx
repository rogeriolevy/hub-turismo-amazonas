import Link from "next/link";
import { ArrowUpRight, ChevronDown, Compass, MapPin, BedDouble } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { translate, translateText, type Locale, type MessageKey } from "@/lib/i18n/messages";
import {
  LocalizedEmptyState,
  LocalizedPageIntro,
  LocalizedPortalNotice,
} from "./shared-views";
export type ModuleLink = { href: string; label: string; description: string };
export const publicModules: ModuleLink[] = [
  { href: "/", label: "Institucional", description: "Conheça a Hub e nossa proposta." },
  { href: "/hospedagens", label: "Hospedagens", description: "Um lugar para viver a Amazônia." },
  {
    href: "/gastronomia",
    label: "Gastronomia",
    description: "Restaurantes, bares e sabores locais.",
  },
  {
    href: "/experiencias",
    label: "Experiências",
    description: "Passeios, roteiros e profissionais locais.",
  },
  { href: "/agencias", label: "Agências de turismo", description: "Planeje roteiros e pacotes." },
  {
    href: "/servicos",
    label: "Serviços turísticos",
    description: "Especialistas para sua viagem.",
  },
  {
    href: "/navegacao",
    label: "Navegação",
    description: "Passagens, horários e caminhos pelo Amazonas.",
  },
  { href: "/minha-conta", label: "Minha conta", description: "Acompanhe suas solicitações." },
];
const moduleMessages: Record<string, [MessageKey, MessageKey]> = {
  "/": ["module.home", "module.homeDescription"],
  "/hospedagens": ["module.hotel", "module.hotelDescription"],
  "/gastronomia": ["module.food", "module.foodDescription"],
  "/experiencias": ["module.experiences", "module.experiencesDescription"],
  "/agencias": ["module.agencies", "module.agenciesDescription"],
  "/servicos": ["module.services", "module.servicesDescription"],
  "/navegacao": ["module.navigation", "module.navigationDescription"],
  "/minha-conta": ["module.account", "module.accountDescription"],
};

export function localizeModule(item: ModuleLink, locale: Locale): ModuleLink {
  const keys = moduleMessages[item.href];
  if (!keys) return item;
  return {
    ...item,
    label: translate(locale, keys[0]),
    description: translate(locale, keys[1]),
  };
}

export async function ModuleSwitcher({ modules = publicModules }: { modules?: ModuleLink[] }) {
  const locale = await getLocale();
  return (
    <details className="module-switcher">
      <summary>
        {translate(locale, "account.switchModule")} <ChevronDown size={16} />
      </summary>
      <nav aria-label={translate(locale, "account.moduleNav")}>
        {modules.map((item) => (
          <Link key={item.href} href={item.href}>
            <strong>{localizeModule(item, locale).label}</strong>
            <span>{localizeModule(item, locale).description}</span>
          </Link>
        ))}
      </nav>
    </details>
  );
}
export async function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const locale = await getLocale();
  return <LocalizedPageIntro locale={locale} eyebrow={eyebrow} title={title} description={description} />;
}
export async function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return <LocalizedEmptyState locale={locale} title={title}>{children}</LocalizedEmptyState>;
}
export async function CatalogCard({
  href,
  title,
  city,
  description,
  price,
  kind,
  subtype,
}: {
  href: string;
  title: string;
  city: string;
  description: string;
  price: string;
  kind: "hotel" | "tour";
  subtype?: string;
}) {
  const locale = await getLocale();
  return (
    <article className="catalog-card">
      <Link
        href={href}
        className={`catalog-art ${kind}`}
        aria-label={`${translateText(locale, "Conhecer")} ${title}`}
      >
        {kind === "hotel" ? <BedDouble size={52} /> : <Compass size={52} />}
        <span>AMAZONAS · {kind === "hotel" ? "HOSPEDAGEM" : "EXPERIÊNCIA"}</span>
      </Link>
      <div className="catalog-copy">
        <p className="catalog-city">
          <MapPin size={14} />
          {city}
        </p>
        {subtype && <p className="catalog-subtype">{subtype}</p>}
        <h2>
          <Link href={href}>{title}</Link>
        </h2>
        <p>{description}</p>
        <div className="catalog-bottom">
          <strong>{price}</strong>
          <Link href={href} className="text-link">
            {translateText(locale, "Conhecer")} <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export async function PortalNotice({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <LocalizedPortalNotice locale={locale}>{children}</LocalizedPortalNotice>;
}
