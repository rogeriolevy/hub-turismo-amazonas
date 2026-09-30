/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation keeps these institutional routes server rendered. */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PlatformBrand } from "@/components/platform/brand";
import { ModuleSwitcher } from "@/components/platform/shared";
export function Brand() {
  return <PlatformBrand />;
}
export function Header() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Navegação principal" className="portal-nav">
            <Link href="/hospedagens">Hospedagens</Link>
            <Link href="/passeios">Passeios</Link>
            <a href="/#sobre">Sobre a Hub</a>
          </nav>
          <div className="header-tools">
            <ModuleSwitcher />
            <Link className="header-cta" href="/minha-conta">
              Minha conta <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Brand />
          <p>Da Amazônia, para novas conexões.</p>
          <a href="/privacidade">Privacidade</a>
          <a href="/admin">Área administrativa</a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Hub Turismo Amazonas</span>
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
        </div>
      </div>
    </footer>
  );
}
