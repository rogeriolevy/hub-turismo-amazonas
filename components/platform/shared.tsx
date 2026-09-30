import Link from "next/link";
import { ArrowUpRight, ChevronDown, Compass, MapPin, BedDouble } from "lucide-react";
export type ModuleLink = { href: string; label: string; description: string };
export const publicModules: ModuleLink[] = [
  { href: "/", label: "Institucional", description: "Conheça a Hub e nossa proposta." },
  { href: "/hospedagens", label: "Hospedagens", description: "Um lugar para viver a Amazônia." },
  { href: "/passeios", label: "Passeios e guias", description: "Descubra experiências locais." },
  { href: "/minha-conta", label: "Minha conta", description: "Acompanhe suas solicitações." },
];
export function ModuleSwitcher({ modules = publicModules }: { modules?: ModuleLink[] }) {
  return (
    <details className="module-switcher">
      <summary>
        Alternar módulo <ChevronDown size={16} />
      </summary>
      <nav aria-label="Módulos da plataforma">
        {modules.map((item) => (
          <Link key={item.href} href={item.href}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </Link>
        ))}
      </nav>
    </details>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="portal-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="portal-empty">
      <Compass size={36} />
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function CatalogCard({
  href,
  title,
  city,
  description,
  price,
  kind,
}: {
  href: string;
  title: string;
  city: string;
  description: string;
  price: string;
  kind: "hotel" | "tour";
}) {
  return (
    <article className="catalog-card">
      <Link href={href} className={`catalog-art ${kind}`} aria-label={`Conhecer ${title}`}>
        {kind === "hotel" ? <BedDouble size={52} /> : <Compass size={52} />}
        <span>AMAZONAS · {kind === "hotel" ? "HOSPEDAGEM" : "EXPERIÊNCIA"}</span>
      </Link>
      <div className="catalog-copy">
        <p className="catalog-city">
          <MapPin size={14} />
          {city}
        </p>
        <h2>
          <Link href={href}>{title}</Link>
        </h2>
        <p>{description}</p>
        <div className="catalog-bottom">
          <strong>{price}</strong>
          <Link href={href} className="text-link">
            Conhecer <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function PortalNotice({ children }: { children: React.ReactNode }) {
  return <div className="portal-notice">{children}</div>;
}
