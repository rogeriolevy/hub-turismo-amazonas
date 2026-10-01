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
      <main id="conteudo" tabIndex={-1} className="container prose">
        <p className="eyebrow">TRANSPARÊNCIA</p>
        <h1>Seu contato, com cuidado.</h1>
        <p>
          Este aviso explica como os dados enviados no site da Hub Turismo Amazonas são utilizados.
          Atualizado em 1º de outubro de 2026.
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
          Ao criar uma conta, armazenamos seu nome, e-mail e uma representação protegida da senha.
          As solicitações de reserva incluem a hospedagem ou saída escolhida, período, quantidade de
          pessoas, observações e situação do pedido. Esses dados são acessíveis a você e à equipe
          autorizada da empresa responsável. A administração da plataforma gerencia empresas,
          permissões e registros de operação.
        </p>
        <p>
          O registro local de estadia também guarda país e cidade de origem e horários de entrada e
          saída. Ele não transmite informações ao sistema oficial de FNRH. Não recebemos pagamentos
          online nem solicitamos documentos no cadastro desta versão.
        </p>
        <p>
          As mensagens ficam no banco de dados do servidor responsável por esta instalação, com
          acesso limitado a administradores autorizados. Nesta versão local, os dados permanecem
          neste computador. O provedor e a localização serão informados antes da publicação desta
          versão. Registros técnicos e identificadores derivados do e-mail e do endereço IP são
          usados para limitar envios abusivos; o aplicativo não salva o endereço IP em texto no
          cadastro de contato.
        </p>
        <h2>Suas solicitações</h2>
        <p>
          O diretório de turismo apresenta nomes e contatos comerciais divulgados nos dados abertos
          do Ministério do Turismo / Cadastur, com fonte e período de referência. CPF, data de
          nascimento e e-mail de administração do cadastro não são publicados. Para corrigir ou
          retirar um contato do diretório, utilize o formulário abaixo e identifique o prestador.
        </p>
        <p>
          Você pode solicitar informações, correção ou exclusão da sua mensagem pelo{" "}
          <a href="/#contato">formulário de contato</a>, selecionando “Privacidade”. A equipe poderá
          pedir confirmação de identidade antes de atender solicitações. As mensagens são mantidas
          enquanto necessárias ao atendimento; a equipe deve revisar e excluir dados que não sejam
          mais necessários.
        </p>
        <h2>Cookies e serviços externos</h2>
        <p>
          O site não inclui publicidade, analytics ou cookies de marketing. As áreas autenticadas
          utilizam cookies de sessão para manter o acesso, além de registrar o IP e o navegador das
          sessões para segurança. A senha é armazenada em formato protegido e não é compartilhada
          com os visitantes. O formulário público não exige login.
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
