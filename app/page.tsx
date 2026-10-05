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
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

const solutions = [
  {
    icon: CalendarCheck2,
    number: "01",
    titleKey: "home.solutionReceptionTitle",
    textKey: "home.solutionReceptionText",
  },
  {
    icon: BedDouble,
    number: "02",
    titleKey: "home.solutionRoomTitle",
    textKey: "home.solutionRoomText",
  },
  {
    icon: Network,
    number: "03",
    titleKey: "home.solutionDataTitle",
    textKey: "home.solutionDataText",
  },
] as const;
export default async function Home() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
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
              <span className="short-line" /> {t("home.eyebrow")}
            </p>
            <h1 id="hero-title">
              {t("home.headlineFirst")}
              <br />
              {t("home.headlineSecond")} <em>{t("home.headlineEmphasis")}</em>
            </h1>
            <p className="hero-description">{t("home.description")}</p>
            <div className="hero-actions">
              <a className="button button-gold" href="#solucoes">
                {t("home.proposal")} <ArrowUpRight size={18} />
              </a>
              <a className="text-link light" href="#sobre">
                {t("home.history")} <ArrowDown size={17} />
              </a>
            </div>
          </div>
          <div className="container hero-bottom">
            <span>
              <MapPin size={16} /> {t("home.location")}
            </span>
            <span>{t("home.slogan")}</span>
            <a href="#sobre" aria-label="Ir para a apresentação">
              <ArrowDown size={22} />
            </a>
          </div>
        </section>
        <div className="purpose-strip">
          <div className="container">
            <span>
              <Waves /> {t("home.purposeHospitality")}
            </span>
            <span>
              <Compass /> {t("home.purposeDevelopment")}
            </span>
            <span>
              <ShieldCheck /> {t("home.purposeTechnology")}
            </span>
          </div>
        </div>
        <section className="section container about" id="sobre">
          <div>
            <p className="eyebrow">{t("home.who")}</p>
            <h2>
              {t("home.futureTourism")}
              <br />
              {t("home.startsWith")}
              <br />
              <em>{t("home.alreadyHere")}</em>
            </h2>
          </div>
          <div className="about-copy">
            <p className="lead">{t("home.aboutLead")}</p>
            <p>{t("home.aboutFirst")}</p>
            <p>{t("home.aboutSecond")}</p>
            <a className="text-link" href="#caminho">
              {t("home.aboutLink")} <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <section className="solutions section" id="solucoes">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("home.techEyebrow")}</p>
                <h2>
                  {t("home.moreConnection")}
                  <br />
                  <em>{t("home.humanManagement")}</em>
                </h2>
              </div>
              <p>{t("home.techIntro")}</p>
            </div>
            <div className="solution-grid">
              {solutions.map(({ icon: Icon, number, titleKey, textKey }) => (
                <article className="solution-card" key={number}>
                  <div className="card-top">
                    <Icon size={29} strokeWidth={1.4} />
                    <span>{number}</span>
                  </div>
                  <h3>{t(titleKey)}</h3>
                  <p>{t(textKey)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="section container journey" id="caminho">
          <div>
            <p className="eyebrow">{t("home.journeyEyebrow")}</p>
            <h2>
              {t("home.journeyStart")}
              <br />
              <em>{t("home.journeyHorizon")}</em>
            </h2>
            <p className="journey-intro">{t("home.journeyIntro")}</p>
            <a className="button button-dark" href="#contato">
              {t("home.journeyCta")} <ArrowUpRight size={18} />
            </a>
          </div>
          <ol className="timeline">
            <li>
              <span className="timeline-number">01</span>
              <div>
                <span className="stage-label">{t("home.stageStart")}</span>
                <h3>{t("home.stageListen")}</h3>
                <p>{t("home.stageListenText")}</p>
              </div>
            </li>
            <li>
              <span className="timeline-number">02</span>
              <div>
                <span className="stage-label">{t("home.stageFocus")}</span>
                <h3>{t("home.stageOrganize")}</h3>
                <p>{t("home.stageOrganizeText")}</p>
              </div>
            </li>
            <li>
              <span className="timeline-number">03</span>
              <div>
                <span className="stage-label">{t("home.stageFuture")}</span>
                <h3>{t("home.stageConnect")}</h3>
                <p>{t("home.stageConnectText")}</p>
              </div>
            </li>
          </ol>
        </section>
        <section className="contact-section section" id="contato">
          <div className="container contact-layout">
            <div>
              <p className="eyebrow light">{t("home.contactEyebrow")}</p>
              <h2>
                {t("home.contactTitleFirst")}
                <br />
                {t("home.contactTitleSecond")}
                <br />
                <em>{t("home.contactTitleThird")}</em>
              </h2>
              <p>{t("home.contactDescription")}</p>
              <span className="contact-location">
                <MapPin size={18} /> {t("home.contactLocation")}
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
