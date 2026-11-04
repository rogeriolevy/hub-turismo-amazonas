"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, MapPin } from "lucide-react";
import { navigationPackages, navigationSources } from "@/lib/navigation-data";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { Price } from "./attribution";

export function NavigationPackages({ today }: { today: string }) {
  return (
    <LocalizedClientTree>
      <section className="nav-section" id="pacotes" aria-labelledby="pacotes-title">
        <div className="nav-section-heading">
          <div>
            <p className="eyebrow">VÁ ALÉM DA CHEGADA</p>
            <h2 id="pacotes-title">Pacotes e experiências.</h2>
          </div>
          <p>Ofertas pesquisadas junto aos fornecedores.</p>
        </div>
        <div className="nav-packages-layout">
          {navigationPackages.map((item) => (
            <article className="nav-package-card" key={item.id}>
              <div className="nav-package-icon">
                <Compass size={30} strokeWidth={1.4} aria-hidden="true" />
              </div>
              <div className="nav-package-copy">
                <p className="nav-package-duration">
                  <MapPin size={14} aria-hidden="true" /> Maués, AM <span>·</span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {item.duration}
                </p>
                <h3>{item.title}</h3>
                <p>
                  {item.subtitle} · {item.provider}
                </p>
                <Price price={item.price} today={today} />
                <p className="nav-package-couple">Também anunciado: R$ 7.800 por casal.</p>
                <p>
                  <strong>Inclui:</strong> {item.includes}
                </p>
                <p>
                  <strong>Confirme antes de reservar:</strong> {item.excludes}
                </p>
                <p className="nav-package-conditions">{item.price.note}</p>
                <a
                  className="button button-dark"
                  href={navigationSources[item.sourceId].url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver pacote na agência <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
          <aside className="nav-complete-trip">
            <p className="eyebrow">DO EMBARQUE À ESTADIA</p>
            <h3>Faça a viagem do seu jeito.</h3>
            <p>Combine seu transporte com hospedagens e experiências cadastradas na Hub.</p>
            <Link href="/hospedagens">
              Encontrar hospedagem <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/experiencias">
              Explorar experiências <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <small>Cada serviço tem sua própria disponibilidade e contratação.</small>
          </aside>
        </div>
      </section>
    </LocalizedClientTree>
  );
}
