import {
  ArrowDown,
  ArrowUpRight,
  BedDouble,
  CalendarCheck2,
  Compass,
  MapPin,
  Network,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { ContactForm } from "@/components/site/contact-form";

const solutions = [
  {
    icon: CalendarCheck2,
    number: "01",
    title: "Uma recepção mais simples",
    text: "Reservas, hóspedes, check-in e check-out em um fluxo conectado. Mais clareza para quem recebe, mais cuidado com quem chega.",
  },
  {
    icon: BedDouble,
    number: "02",
    title: "Cada quarto, no seu tempo",
    text: "Uma visão do que está pronto, ocupado, em limpeza ou manutenção para apoiar a rotina de hotéis e pousadas.",
  },
  {
    icon: Network,
    number: "03",
    title: "Informação que aproxima",
    text: "Um resumo da operação para ajudar equipes a organizar o dia. A inteligência artificial e a preparação para FNRH fazem parte da evolução do projeto.",
  },
];
export default function Home() {
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hero-image"
            src="/images/amazonia.webp"
            alt="Rios entre a floresta amazônica na região de Manaus, Amazonas"
            width="1920"
            height="1275"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="container hero-content">
            <p className="eyebrow light">
              <span className="short-line" /> NASCEMOS DA AMAZÔNIA
            </p>
            <h1 id="hero-title">
              Conectando pessoas.
              <br />
              Valorizando a <em>Amazônia.</em>
            </h1>
            <p className="hero-description">
              Tecnologia com raízes locais para transformar a hospitalidade e construir novos
              caminhos para o turismo no Amazonas.
            </p>
            <div className="hero-actions">
              <a className="button button-gold" href="#solucoes">
                Conheça nossa proposta <ArrowUpRight size={18} />
              </a>
              <a className="text-link light" href="#sobre">
                Nossa história <ArrowDown size={17} />
              </a>
            </div>
          </div>
          <div className="container hero-bottom">
            <span>
              <MapPin size={16} /> Amazonas, Brasil
            </span>
            <span>Raízes locais. Conexões que vão além.</span>
            <a href="#sobre" aria-label="Ir para a apresentação">
              <ArrowDown size={22} />
            </a>
          </div>
        </section>
        <div className="purpose-strip">
          <div className="container">
            <span>
              <Waves /> Hospitalidade amazônica
            </span>
            <span>
              <Compass /> Desenvolvimento local
            </span>
            <span>
              <ShieldCheck /> Tecnologia com propósito
            </span>
          </div>
        </div>
        <section className="section container about" id="sobre">
          <div>
            <p className="eyebrow">QUEM SOMOS</p>
            <h2>
              O futuro do turismo
              <br />
              começa com quem
              <br />
              <em>já faz parte daqui.</em>
            </h2>
          </div>
          <div className="about-copy">
            <p className="lead">
              A Hub Turismo Amazonas nasce de uma ideia: aproximar a tecnologia de quem faz a
              hospitalidade acontecer na Amazônia.
            </p>
            <p>
              Nosso ponto de partida são os hotéis e pousadas de Maués. Estamos desenvolvendo uma
              proposta para simplificar a gestão e apoiar as equipes que acolhem visitantes todos os
              dias.
            </p>
            <p>
              A visão é crescer junto com a região, conectando hospedagem, experiências e parceiros
              locais, respeitando os ritmos e as particularidades do território.
            </p>
            <a className="text-link" href="#caminho">
              Conheça o caminho que estamos construindo <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <section className="solutions section" id="solucoes">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TECNOLOGIA QUE ACOLHE</p>
                <h2>
                  Mais conexão.
                  <br />
                  <em>Uma gestão mais humana.</em>
                </h2>
              </div>
              <p>
                Começamos pelo essencial: uma solução de gestão pensada para a rotina de pequenos
                meios de hospedagem.
              </p>
            </div>
            <div className="solution-grid">
              {solutions.map(({ icon: Icon, number, title, text }) => (
                <article className="solution-card" key={number}>
                  <div className="card-top">
                    <Icon size={29} strokeWidth={1.4} />
                    <span>{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="section container journey" id="caminho">
          <div>
            <p className="eyebrow">NOSSO CAMINHO</p>
            <h2>
              Um começo em Maués.
              <br />
              <em>Um horizonte amazônico.</em>
            </h2>
            <p className="journey-intro">
              Construir com foco, ouvir quem está na ponta e evoluir com responsabilidade.
            </p>
            <a className="button button-dark" href="#contato">
              Vamos construir juntos <ArrowUpRight size={18} />
            </a>
          </div>
          <ol className="timeline">
            <li>
              <span className="timeline-number">01</span>
              <div>
                <span className="stage-label">PONTO DE PARTIDA</span>
                <h3>Ouvir e entender</h3>
                <p>
                  Conhecer os desafios de hotéis e pousadas e desenhar uma experiência que faça
                  sentido para a região.
                </p>
              </div>
            </li>
            <li>
              <span className="timeline-number">02</span>
              <div>
                <span className="stage-label">FOCO DO PROJETO</span>
                <h3>Organizar a hospitalidade</h3>
                <p>
                  Desenvolver o núcleo de gestão: da reserva à recepção, da estadia à preparação do
                  próximo quarto.
                </p>
              </div>
            </li>
            <li>
              <span className="timeline-number">03</span>
              <div>
                <span className="stage-label">VISÃO DE FUTURO</span>
                <h3>Conectar o ecossistema</h3>
                <p>
                  Aproximar hospedagem, experiências e transporte regional. Integrações e
                  comercialização dependem de etapas futuras.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="contact-section section" id="contato">
          <div className="container contact-layout">
            <div>
              <p className="eyebrow light">VAMOS CONVERSAR</p>
              <h2>
                O próximo capítulo
                <br />
                pode começar
                <br />
                <em>com você.</em>
              </h2>
              <p>
                Tem um hotel, uma pousada ou uma ideia para fortalecer o turismo na região? Queremos
                conhecer sua história.
              </p>
              <span className="contact-location">
                <MapPin size={18} /> Foco inicial em Maués, Amazonas
              </span>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
