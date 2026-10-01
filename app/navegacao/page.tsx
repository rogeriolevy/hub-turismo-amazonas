import Image from "next/image";
import { ArrowDown, ArrowUpRight, Ship, Plane } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { NavigationExplorer } from "@/components/platform/navigation-explorer";
import { todayInManaus } from "@/lib/platform-schema";
import "./navigation.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Navegação e transporte no Amazonas",
  description:
    "Planeje sua viagem por Maués, Manaus, Parintins e Boa Vista do Ramos. Roteiros de embarcações, referências de passagens aéreas e fluviais, contatos e pacotes.",
  alternates: { canonical: "/navegacao" },
};

export default function NavigationPage() {
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="navigation-page">
        <section className="nav-hero" aria-labelledby="navigation-title">
          <div className="container nav-hero-inner">
            <div className="nav-hero-copy">
              <p className="eyebrow">HUB. NAVEGAÇÃO</p>
              <h1 id="navigation-title">
                Seu caminho
                <br />
                pela <em>Amazônia.</em>
              </h1>
              <p>
                Rios que conectam. Destinos que acolhem. Encontre informações para viajar por Maués
                e pelo Amazonas.
              </p>
              <div className="nav-hero-actions">
                <a className="button button-dark" href="#passagens">
                  Explorar trajetos <ArrowDown size={17} aria-hidden="true" />
                </a>
                <a className="text-link" href="#horarios">
                  Horários de barcos <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>
              <div className="nav-hero-modes">
                <span>
                  <Ship size={18} aria-hidden="true" />
                  Transporte fluvial
                </span>
                <span>
                  <Plane size={18} aria-hidden="true" />
                  Transporte aéreo
                </span>
              </div>
            </div>
            <figure className="nav-hero-art">
              <Image
                src="/images/navegacao/rios-e-ceus.webp"
                alt="Ilustração de barco regional e avião entre rios e florestas da Amazônia"
                width={1536}
                height={1024}
                sizes="(max-width: 800px) 100vw, 55vw"
                priority
              />
              <figcaption>Imagem ilustrativa gerada por IA</figcaption>
            </figure>
          </div>
        </section>
        <nav className="nav-page-links" aria-label="Seções de Navegação">
          <div className="container">
            <a href="#passagens">Passagens e trajetos</a>
            <a href="#horarios">Horários e contatos</a>
            <a href="#pacotes">Pacotes</a>
          </div>
        </nav>
        <div className="container">
          <NavigationExplorer today={todayInManaus()} />
        </div>
      </main>
      <Footer photoCredit={false} />
    </>
  );
}
