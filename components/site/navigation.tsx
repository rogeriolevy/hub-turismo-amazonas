import {
  ArrowUpRight,
  BedDouble,
  BriefcaseBusiness,
  Compass,
  MapPinned,
  Ship,
  Sparkles,
  UtensilsCrossed,
  UserRound,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { PlatformBrand } from "@/components/platform/brand";
import { AccountMenu } from "@/components/site/account-menu";
import { avatarKeyFromImage, defaultAvatarForUser } from "@/lib/profile-avatars";
import { getSession } from "@/server/admin";
import "./navigation.css";

const destinations = [
  { href: "/hospedagens", label: "Hospedagens", icon: BedDouble },
  { href: "/gastronomia", label: "Gastronomia", icon: UtensilsCrossed },
  { href: "/passeios", label: "Passeios", icon: Compass },
  { href: "/guias", label: "Guias", icon: MapPinned },
  { href: "/agencias", label: "Agências", icon: BriefcaseBusiness },
  { href: "/servicos", label: "Serviços turísticos", icon: Sparkles },
  { href: "/navegacao", label: "Navegação", icon: Ship },
];

const primaryLinks = [...destinations, { href: "/sobre", label: "Sobre a Hub", icon: Waves }];

const hubLinks = [
  { href: "/sobre", label: "Sobre a Hub" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/painel/contato", label: "Área administrativa" },
];

export function Brand() {
  return <PlatformBrand />;
}
export async function Header() {
  const session = await getSession().catch(() => null);
  const avatar = session
    ? (avatarKeyFromImage(session.user.image) ?? defaultAvatarForUser(session.user.id))
    : null;

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header site-header--compact">
        <div className="container header-inner">
          <Brand />
          <nav className="header-primary-nav" aria-label="Navegação principal">
            {primaryLinks.map(({ href, label, icon: Icon }) => (
              <Link className="header-primary-link" href={href} key={href}>
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {session && avatar ? (
            <AccountMenu name={session.user.name} email={session.user.email} avatar={avatar} />
          ) : (
            <Link
              className="header-account"
              href="/minha-conta"
              aria-label="Acessar minha conta"
              title="Acessar minha conta"
            >
              <UserRound size={18} aria-hidden="true" />
              <span>Acessar minha conta</span>
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
export function Footer({ photoCredit = true }: { photoCredit?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-map">
          <section className="footer-about" aria-label="Hub Turismo Amazonas">
            <Brand />
            <p>Da Amazônia, para novas conexões.</p>
            <Link className="footer-contact" href="/#contato">
              Fale com a Hub <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </section>
          <nav className="footer-links" aria-label="Explore o Amazonas">
            <h2>Explore o Amazonas</h2>
            <div className="footer-link-grid">
              {destinations.map(({ href, label, icon: Icon }) => (
                <Link className="footer-link" href={href} key={href}>
                  <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Hub Turismo Amazonas</span>
          <nav className="footer-meta-links" aria-label="Informações do site">
            <Link href="/minha-conta">Minha conta</Link>
            {hubLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          {photoCredit && (
            <span>
              Foto:{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Amazon17_(5641020319).jpg"
                target="_blank"
                rel="noreferrer"
              >
                Neil Palmer / CIAT
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/2.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 2.0
              </a>{" "}
              · Recorte e compressão.
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
