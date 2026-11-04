import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Phone } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { publicProvider, type DirectoryCategory } from "@/server/cadastur/public-directory";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
import { providerDirectoryModules as modules } from "./config";
import { ProviderContacts } from "./provider-card";
import { ProviderAttribution } from "./provider-attribution";
import { NearbyRecommendations } from "../nearby-recommendations";
import "../provider-directory.css";

export async function ProviderDetail({ id }: { id: string }) {
  const entry = await publicProvider(getDatabase(), id);
  if (!entry) notFound();
  const category = entry.category;
  const directoryHref =
    category === "guias"
      ? "/experiencias?tipo=guia"
      : category === "passeios"
        ? "/experiencias?tipo=atividade"
        : "/" + category;
  const info = modules[category],
    Icon = info.icon;
  return (
    <>
      <Header />
      <LocalizedTree>
        <main
          id="conteudo"
          tabIndex={-1}
          className={"provider-page provider-detail provider-" + category}
        >
          <div className="container">
            <Link href={directoryHref} className="text-link">
              ← {info.label}
            </Link>
            <div className="provider-detail-layout">
              <section>
                <div className="provider-detail-art">
                  {entry.images[0] ? (
                    <Image
                      unoptimized
                      src={entry.images[0]}
                      alt={`Imagem de ${entry.name}`}
                      width={1600}
                      height={1100}
                      sizes="(max-width: 800px) 100vw, 66vw"
                    />
                  ) : (
                    <Icon size={82} strokeWidth={1} aria-hidden="true" />
                  )}
                  <span>{info.label} · Amazonas</span>
                </div>
                <p className="eyebrow">
                  {entry.city} · {entry.uf}
                </p>
                <h1>{entry.name}</h1>
                <p>{entry.subtype || info.label}</p>
                {entry.summary && <p className="provider-detail-summary">{entry.summary}</p>}
                {entry.description && <p className="preserve-lines">{entry.description}</p>}
                {entry.details && (
                  <section className="provider-extra-details" aria-label="Informações adicionais">
                    <h2>Mais informações</h2>
                    <p className="preserve-lines">{entry.details}</p>
                  </section>
                )}
                {entry.images.length > 1 && (
                  <div className="provider-detail-gallery" aria-label="Outras imagens">
                    {entry.images.slice(1).map((image, index) => (
                      <Image
                        unoptimized
                        key={image}
                        src={image}
                        alt={`Imagem ${index + 2} de ${entry.name}`}
                        width={640}
                        height={480}
                        sizes="(max-width: 600px) 33vw, 20vw"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
                {category === "guias" && entry.languages && (
                  <dl className="provider-facts">
                    <div>
                      <dt>Idiomas de atendimento</dt>
                      <dd>{entry.languages}</dd>
                    </div>
                  </dl>
                )}
              </section>
              <aside className="provider-contact-panel">
                <p className="eyebrow">PLANEJE SUA VISITA</p>
                <h2>Fale com {category === "guias" ? "o profissional" : "o estabelecimento"}</h2>
                <ProviderContacts entry={entry} />
                {entry.phone && (
                  <a className="button button-dark" href={"tel:" + entry.phone}>
                    Ligar agora <Phone size={17} aria-hidden="true" />
                  </a>
                )}
                {entry.website && (
                  <a
                    className="button button-outline"
                    href={entry.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Acessar site <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                )}
                {(category === "hospedagens" || category === "agencias") && (
                  <p>
                    {category === "hospedagens"
                      ? "Consulte diárias, quartos e disponibilidade para sua viagem."
                      : "Consulte roteiros, pacotes e valores para suas datas."}
                  </p>
                )}
              </aside>
            </div>
            {category === "hospedagens" && entry.source === "cadastur" && (
              <NearbyRecommendations providerId={entry.id} source="cadastur" />
            )}
            {entry.source === "cadastur" ? (
              <ProviderAttribution
                category={category as DirectoryCategory}
                includesHub={entry.editorial}
              />
            ) : (
              <p className="provider-hub-credit">
                Conteúdo enviado e mantido pela equipe da Hub Amazonas.
              </p>
            )}
          </div>
        </main>
      </LocalizedTree>
      <Footer photoCredit={false} />
    </>
  );
}
