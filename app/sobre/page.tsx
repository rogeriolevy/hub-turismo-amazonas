import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Compass,
  Eye,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Waves,
} from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import "./sobre.css";

export const metadata: Metadata = {
  title: "Sobre a Hub",
  description:
    "Conheça a origem, o propósito, a missão, a visão e os valores da Hub Turismo Amazonas.",
  alternates: { canonical: "/sobre" },
};

const values = [
  {
    icon: MapPin,
    title: "Raízes amazônicas",
    text: "Desenvolver a partir da realidade do Amazonas, respeitando os ritmos, as distâncias e a diversidade de cada lugar.",
  },
  {
    icon: HeartHandshake,
    title: "Hospitalidade em primeiro lugar",
    text: "A tecnologia deve apoiar quem acolhe e tornar cada contato com o destino mais humano e cuidadoso.",
  },
  {
    icon: Sparkles,
    title: "Simplicidade que ajuda",
    text: "Preferimos fluxos claros e úteis, que resolvam necessidades reais sem complicar a rotina de quem usa.",
  },
  {
    icon: ShieldCheck,
    title: "Confiança e responsabilidade",
    text: "Tratamos dados com cuidado, explicamos o que a plataforma oferece e evoluímos cada etapa com transparência.",
  },
];

const steps = [
  {
    number: "01",
    label: "PONTO DE PARTIDA",
    title: "Apoiar quem recebe",
    text: "A proposta original começou pela rotina de hotéis e pousadas: quartos, hóspedes, reservas e o fluxo de recepção.",
  },
  {
    number: "02",
    label: "CONEXÃO PRESENTE",
    title: "Facilitar a descoberta",
    text: "Catálogos aproximam visitantes de hospedagens, experiências, gastronomia e outros serviços turísticos.",
  },
  {
    number: "03",
    label: "HORIZONTE",
    title: "Conectar o destino",
    text: "A visão de longo prazo é aproximar ainda mais os serviços e as experiências locais, avançando por etapas responsáveis.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="about-page">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="container about-hero-layout">
            <div className="about-hero-copy">
              <p className="eyebrow">
                <span className="about-eyebrow-line" /> NOSSA IDENTIDADE
              </p>
              <h1 id="about-title">
                A Amazônia é o nosso ponto de partida.
                <br />
                <em>As conexões, o caminho.</em>
              </h1>
              <p>
                A Hub Turismo Amazonas nasceu para aproximar tecnologia, hospitalidade e as pessoas
                que fazem o turismo acontecer na região.
              </p>
              <a className="about-hero-link" href="#origem">
                Conheça nossa história <ArrowDown size={17} aria-hidden="true" />
              </a>
            </div>
            <div className="about-identity-art" aria-hidden="true">
              <div className="about-art-orbit about-art-orbit--outer" />
              <div className="about-art-orbit about-art-orbit--inner" />
              <span className="about-art-pin about-art-pin--one" />
              <span className="about-art-pin about-art-pin--two" />
              <div className="about-art-mark">
                <Waves size={72} strokeWidth={1.2} aria-hidden="true" />
                <span>HUB. AMAZONAS</span>
              </div>
              <div className="about-art-location">
                <MapPin size={15} aria-hidden="true" /> Maués · Amazonas
              </div>
              <span className="about-art-caption">RAÍZES LOCAIS · CONEXÕES QUE VÃO ALÉM</span>
            </div>
          </div>
          <div className="container about-hero-bottom">
            <span>Da Amazônia, para novas conexões.</span>
            <span>Amazonas, Brasil</span>
          </div>
        </section>

        <section id="origem" className="about-origin section container">
          <div className="about-origin-heading">
            <p className="eyebrow">POR QUE CRIAMOS A HUB</p>
            <h2>
              Uma ideia ampla,
              <br />
              <em>um começo possível.</em>
            </h2>
            <div className="about-origin-marker">
              <Target size={22} aria-hidden="true" />
              <span>O primeiro foco foi a hospitalidade em Maués.</span>
            </div>
          </div>
          <div className="about-origin-copy">
            <p className="about-lead">
              Os documentos de origem imaginaram um Hub de turismo para a Amazônia e definiram um
              primeiro passo concreto: apoiar a organização diária de hotéis e pousadas.
            </p>
            <p>
              A proposta nasceu no contexto de um projeto acadêmico de produto. Em vez de começar
              tentando resolver toda a viagem de uma vez, o plano priorizou um núcleo de gestão que
              pudesse acompanhar o percurso da reserva à recepção e à saída do hóspede.
            </p>
            <p>
              Esse começo orienta a Hub até hoje: construir ferramentas úteis para quem recebe,
              facilitar a descoberta para quem visita e conectar novos serviços conforme o projeto
              amadurece junto com o território.
            </p>
            <span className="about-origin-note">
              <Compass size={18} aria-hidden="true" />
              Um primeiro passo local para um horizonte amazônico.
            </span>
          </div>
        </section>

        <section className="about-path" aria-labelledby="about-path-title">
          <div className="container">
            <div className="about-section-heading">
              <div>
                <p className="eyebrow">NOSSO CAMINHO</p>
                <h2 id="about-path-title">
                  Crescer com foco.
                  <br />
                  <em>Conectar com cuidado.</em>
                </h2>
              </div>
              <p>
                O projeto começa pelo que pode apoiar o dia a dia e amplia suas conexões sem perder
                de vista as pessoas e os lugares envolvidos.
              </p>
            </div>
            <div className="about-steps">
              {steps.map((step) => (
                <article className="about-step" key={step.number}>
                  <div className="about-step-top">
                    <span>{step.number}</span>
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </div>
                  <p className="about-step-label">{step.label}</p>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-purpose" aria-label="Missão e visão">
          <div className="container about-purpose-grid">
            <article className="about-purpose-card about-purpose-card--mission">
              <span className="about-purpose-icon">
                <Target size={23} aria-hidden="true" />
              </span>
              <p className="about-step-label">NOSSA MISSÃO</p>
              <h2>Criar tecnologia que fortaleça a hospitalidade e as conexões locais.</h2>
              <p>
                Simplificar a rotina de quem recebe e aproximar visitantes dos serviços e das
                experiências do Amazonas, com ferramentas claras, úteis e responsáveis.
              </p>
            </article>
            <article className="about-purpose-card about-purpose-card--vision">
              <span className="about-purpose-icon">
                <Eye size={23} aria-hidden="true" />
              </span>
              <p className="about-step-label">NOSSA VISÃO</p>
              <h2>Ser uma ponte digital entre pessoas, negócios e destinos amazônicos.</h2>
              <p>
                Crescer junto com a região e contribuir para um turismo mais conectado, acolhedor e
                valorizador de quem vive e trabalha no território.
              </p>
            </article>
          </div>
        </section>

        <section className="about-values section container" aria-labelledby="about-values-title">
          <div className="about-section-heading about-values-heading">
            <div>
              <p className="eyebrow">O QUE NOS GUIA</p>
              <h2 id="about-values-title">
                Valores com
                <br />
                <em>raízes e propósito.</em>
              </h2>
            </div>
            <p>
              São princípios para orientar nossas escolhas de produto, a forma de trabalhar e cada
              nova conexão que a Hub pretende construir.
            </p>
          </div>
          <div className="about-values-grid">
            {values.map(({ icon: Icon, title, text }) => (
              <article className="about-value-card" key={title}>
                <span>
                  <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-now" aria-labelledby="about-now-title">
          <div className="container about-now-inner">
            <div className="about-now-icon">
              <Waves size={29} aria-hidden="true" />
            </div>
            <div>
              <p className="about-step-label">UMA CONSTRUÇÃO EM ETAPAS</p>
              <h2 id="about-now-title">Clareza sobre o presente. Responsabilidade com o futuro.</h2>
              <p>
                Hoje, a plataforma reúne informações turísticas e permite enviar solicitações que
                dependem da confirmação de cada estabelecimento. Pagamentos on-line e integrações
                oficiais continuam fora do que está disponível nesta etapa.
              </p>
            </div>
            <Link className="about-now-link" href="/hospedagens">
              Explore a Hub <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
