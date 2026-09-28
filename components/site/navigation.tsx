/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation keeps these institutional routes server rendered. */
import { Waves, ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Hub Turismo Amazonas, início">
      <Waves className="brand-mark" size={37} strokeWidth={1.6} />
      <span>
        <strong>
          hub<span className="brand-dot">.</span>
        </strong>
        <span className="brand-caption">TURISMO AMAZONAS</span>
      </span>
    </a>
  );
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
          <nav aria-label="Navegação principal">
            <a href="/#sobre">Quem somos</a>
            <a href="/#solucoes">Soluções</a>
            <a href="/#caminho">Nosso caminho</a>
          </nav>
          <a className="header-cta" href="/#contato">
            Vamos conversar <ArrowUpRight size={17} />
          </a>
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
