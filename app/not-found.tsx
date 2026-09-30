/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation keeps these institutional routes server rendered. */
import { Header, Footer } from "@/components/site/navigation";
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="container prose">
        <p className="eyebrow">PÁGINA NÃO ENCONTRADA</p>
        <h1>Vamos encontrar outro caminho.</h1>
        <p>O endereço que você procurou não existe neste site.</p>
        <a className="button button-dark" href="/">
          Voltar ao início
        </a>
      </main>
      <Footer />
    </>
  );
}
