/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation keeps these institutional routes server rendered. */
import type { Metadata } from "next";
import { Header, Footer } from "@/components/site/navigation";
export const metadata: Metadata = {
  title: "Privacidade",
  alternates: { canonical: "/privacidade" },
};
export default function Privacy() {
  return (
    <>
      <Header />
      <main id="conteudo" className="container prose">
        <p className="eyebrow">TRANSPARÊNCIA</p>
        <h1>Seu contato, com cuidado.</h1>
        <p>
          Este aviso explica como os dados enviados no site da Hub Turismo Amazonas são utilizados.
          Atualizado em 28 de setembro de 2026.
        </p>
        <h2>O que você compartilha</h2>
        <p>
          O formulário recebe nome, e-mail, organização (opcional), assunto, mensagem e sua
          autorização de contato. Guardamos a data do envio e a versão deste aviso. Não envie
          documentos, dados de saúde, informações financeiras ou outros dados sensíveis.
        </p>
        <h2>Para que usamos os dados</h2>
        <p>
          Usamos essas informações para compreender sua solicitação e permitir que a equipe responda
          pelo e-mail informado. O envio não inscreve você em publicidade ou newsletter. Esta versão
          registra as mensagens em uma área de acesso restrito; não envia e-mails automaticamente.
        </p>
        <h2>Armazenamento e acesso</h2>
        <p>
          As mensagens ficam em banco de dados na infraestrutura Cloudflare, com acesso limitado a
          administradores autorizados. Provedores de hospedagem podem processar dados em outros
          países. Registros técnicos e identificadores derivados do e-mail e do endereço IP são
          usados para limitar envios abusivos; o aplicativo não salva o endereço IP em texto no
          cadastro de contato.
        </p>
        <h2>Suas solicitações</h2>
        <p>
          Você pode solicitar informações, correção ou exclusão da sua mensagem pelo{" "}
          <a href="/#contato">formulário de contato</a>, selecionando “Privacidade”. A equipe poderá
          pedir confirmação de identidade antes de atender solicitações. As mensagens são mantidas
          enquanto necessárias ao atendimento; a equipe deve revisar e excluir dados que não sejam
          mais necessários.
        </p>
        <h2>Cookies e serviços externos</h2>
        <p>
          O site não inclui publicidade, analytics ou cookies de marketing. A plataforma de
          hospedagem pode utilizar cookies de autenticação e segurança, especialmente nesta versão
          de acesso privado e na área administrativa.
        </p>
        <h2>Sobre esta versão</h2>
        <p>
          A Hub Turismo Amazonas está estruturando seus canais institucionais. Os dados formais da
          organização e o canal específico de privacidade serão incluídos quando definidos.
        </p>
        <a className="button button-dark" href="/#contato">
          Voltar ao contato
        </a>
      </main>
      <Footer />
    </>
  );
}
