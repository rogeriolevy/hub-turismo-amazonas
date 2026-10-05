/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation keeps these institutional routes server rendered. */
import type { Metadata } from "next";
import { Header, Footer } from "@/components/site/navigation";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
export const metadata: Metadata = {
  title: "Privacidade",
  alternates: { canonical: "/privacidade" },
};
export default function Privacy() {
  return (
    <>
      <Header />
      <LocalizedTree>
        <main id="conteudo" tabIndex={-1} className="container prose">
          <p className="eyebrow">TRANSPARÊNCIA</p>
          <h1>Seu contato, com cuidado.</h1>
          <p>
            Este aviso explica como os dados enviados no site da Hub Turismo Amazonas são
            utilizados. Atualizado em 3 de outubro de 2026.
          </p>
          <h2>O que você compartilha</h2>
          <p>
            O formulário recebe nome, e-mail, organização (opcional), assunto, mensagem e sua
            autorização de contato. Guardamos a data do envio e a versão deste aviso. Não envie
            documentos, dados de saúde, informações financeiras ou outros dados sensíveis.
          </p>
          <h2>Para que usamos os dados</h2>
          <p>
            Usamos essas informações para compreender sua solicitação e permitir que a equipe
            responda pelo e-mail informado. O envio não inscreve você em publicidade ou newsletter.
            Esta versão registra as mensagens em uma área de acesso restrito; não envia e-mails
            automaticamente.
          </p>
          <h2>Armazenamento e acesso</h2>
          <p>
            Ao criar uma conta, armazenamos seu nome, e-mail, celular brasileiro e uma representação
            protegida da senha. As solicitações de reserva incluem a hospedagem ou saída escolhida,
            período, quantidade de pessoas, observações e situação do pedido. Esses dados são
            acessíveis a você e à equipe autorizada da empresa responsável. A administração da
            plataforma gerencia empresas, permissões e registros de operação.
          </p>
          <p>
            O resumo diário do painel hoteleiro é calculado localmente a partir das reservas e da
            situação dos quartos. Esta função não envia dados de hóspedes a serviços externos de
            inteligência artificial.
          </p>
          <p>
            O registro local de estadia também guarda país e cidade de origem e horários de entrada
            e saída. Ele não transmite informações ao sistema oficial de FNRH. Não recebemos
            pagamentos online nem solicitamos documentos no cadastro desta versão.
          </p>
          <p>
            As mensagens ficam no banco de dados do servidor responsável por esta instalação, com
            acesso limitado a administradores autorizados. Nesta versão local, os dados permanecem
            neste computador. O provedor e a localização do banco serão informados antes da
            publicação desta versão. Registros técnicos e identificadores derivados do e-mail e do
            endereço IP são usados para limitar envios abusivos; o aplicativo não salva o endereço
            IP em texto no cadastro de contato.
          </p>
          <h2>Suas solicitações</h2>
          <p>
            O diretório de turismo apresenta nomes e contatos comerciais divulgados nos dados
            abertos do Ministério do Turismo / Cadastur, com fonte e período de referência. CPF,
            data de nascimento e e-mail de administração do cadastro não são publicados. Para
            corrigir ou retirar um contato do diretório, utilize o formulário abaixo e identifique o
            prestador.
          </p>
          <p>
            Você pode solicitar informações, correção ou exclusão da sua mensagem pelo{" "}
            <a href="/#contato">formulário de contato</a>, selecionando “Privacidade”. A equipe
            poderá pedir confirmação de identidade antes de atender solicitações. As mensagens são
            mantidas enquanto necessárias ao atendimento; a equipe deve revisar e excluir dados que
            não sejam mais necessários.
          </p>
          <h2>Cookies e serviços externos</h2>
          <p>
            O site não inclui publicidade, analytics ou cookies de marketing. As áreas autenticadas
            utilizam cookies de sessão para manter o acesso, além de registrar o IP e o navegador
            das sessões para segurança. A senha é armazenada em formato protegido e não é
            compartilhada com os visitantes. O login e o cadastro usam Cloudflare Turnstile para
            verificar que o envio não é automatizado; o token de verificação e dados técnicos da
            solicitação são enviados à Cloudflare. O formulário público de contato não exige login.
          </p>
          <h2>Sugestões de proximidade</h2>
          <p>
            Ao abrir os detalhes de uma hospedagem, o servidor consulta os serviços públicos
            Nominatim e Overpass do OpenStreetMap para localizar o estabelecimento e buscar pontos
            de interesse em até 2 km. A consulta usa o nome, o endereço comercial e a cidade da
            hospedagem quando esses dados estão disponíveis; não envia a localização nem outros
            dados pessoais do visitante. Os resultados ficam em cache para reduzir consultas
            externas. A distância exibida é aproximada, em linha reta, e o mapa colaborativo pode
            não conter todos os locais. Os dados do OpenStreetMap são atribuídos aos seus
            colaboradores sob a licença ODbL. O uso do serviço Nominatim segue sua{" "}
            <a
              href="https://operations.osmfoundation.org/policies/nominatim/"
              target="_blank"
              rel="noreferrer"
            >
              política de utilização
            </a>
            . Ao clicar em uma categoria ou em um estabelecimento, o Google Maps abre em outra aba
            com a busca e as coordenadas públicas da hospedagem ou do local selecionado. A navegação
            passa a seguir a{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              política de privacidade do Google
            </a>
            .
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
      </LocalizedTree>
      <Footer />
    </>
  );
}
