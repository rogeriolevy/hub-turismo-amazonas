import type { Locale } from "./locales";

export const interfacePhrases: Record<Exclude<Locale, "pt">, Record<string, string>> = {
  en: {
    "Cadastro de guia vinculado": "Linked guide profile",
    "Guia vinculado:": "Linked guide:",
    "vínculo pendente de configuração": "link pending configuration",
    "Agenda somente dos passeios vinculados ao seu cadastro de guia.":
      "Schedule for tours assigned to your guide profile only.",
    "Não há saídas vinculadas ao seu cadastro de guia.":
      "There are no departures assigned to your guide profile.",
    "A administração precisa vincular sua conta ao cadastro correto de guia.":
      "An administrator must link your account to the correct guide profile.",
    "O cadastro deste quarto é gerenciado pelo gestor do hotel.":
      "The hotel manager maintains this room's record.",
    "A pessoa cria sua conta primeiro. Depois, vincule o e-mail à empresa e ao perfil de trabalho. Para o perfil Guia, selecione também o cadastro público correto.":
      "The person creates an account first. Then link the email to a company and work profile. For the Guide profile, also select the correct public guide record.",
    Módulo: "Module",
    Hospedagens: "Accommodation",
    "Ver conjunto oficial ↗": "View official dataset ↗",
    "1. Escolha a fonte": "1. Choose a source",
    Origem: "Source",
    "Buscar no Ministério do Turismo": "Search the Ministry of Tourism",
    "Enviar arquivo oficial": "Upload an official file",
    "Colar conteúdo CSV": "Paste CSV data",
    "Consultar arquivos do MTur": "Check Ministry of Tourism files",
    "Arquivo / período": "File / period",
    "Selecione um arquivo": "Select a file",
    "Arquivo CSV ou XLSX": "CSV or XLSX file",
    "Até 20 MB. Arquivos XLS devem ser salvos como XLSX. A primeira linha precisa conter os nomes das colunas.":
      "Up to 20 MB. Save XLS files as XLSX. The first row must contain the column names.",
    "Conteúdo CSV": "CSV data",
    "Certificado;Nome;UF;Município": "Certificate;Name;State;Municipality",
    "Copie o cabeçalho e os registros do arquivo de origem. Colunas pessoais serão ignoradas.":
      "Copy the header and records from the source file. Personal data columns will be ignored.",
    "Aba da planilha": "Spreadsheet tab",
    linhas: "rows",
    "Guias PF e PJ precisam ser importados separadamente. Após trocar de aba, leia as colunas novamente.":
      "Individual and business provider tabs must be imported separately. After switching tabs, read the columns again.",
    "Ler colunas": "Read columns",
    "2. Confira as colunas e o recorte": "2. Check the columns and filters",
    "linhas na aba": "rows in tab",
    "Período de referência": "Reference period",
    "Município (opcional)": "Municipality (optional)",
    "Todos os municípios da UF": "All municipalities in the state",
    "Não importar / selecionar": "Do not import / select",
    "O nome fantasia tem prioridade na sugestão. Se estiver vazio, será usado o nome alternativo selecionado. Para guias sem nome fantasia, use o nome do profissional.":
      "The trade name is preferred. If it is blank, the selected alternative name will be used. For guides without a trade name, use the professional's name.",
    "Importar telefone, e-mail, endereço comercial e site divulgados na fonte":
      "Import phone, email, business address, and website listed in the source",
    "Campos com * são obrigatórios. Só estes campos selecionados serão mantidos. Não mapeie informações pessoais em campos cadastrais.":
      "Fields marked * are required. Only selected fields will be kept. Do not map personal information to registry fields.",
    "Gerar prévia": "Generate preview",
    "3. Revise antes de importar": "3. Review before importing",
    "Arquivo obtido diretamente do MTur": "File obtained directly from the Ministry of Tourism",
    "Arquivo fornecido pelo administrador; origem declarada":
      "File supplied by the administrator; source declared",
    Novos: "New",
    Atualizações: "Updates",
    "Sem alteração": "Unchanged",
    Duplicatas: "Duplicates",
    "Fora do recorte": "Outside filters",
    Inválidos: "Invalid",
    Conflitos: "Conflicts",
    "Mais antigos": "Older records",
    "Ver ocorrências (": "View issues (",
    "Linha ": "Row ",
    "Amostra da prévia, até 100 registros": "Preview sample, up to 100 records",
    "Até 100 registros da seleção. A confirmação processa todos os registros válidos contados acima.":
      "Up to 100 selected records. Confirmation processes all valid records counted above.",
    Prestador: "Provider",
    "Situação na fonte": "Source status",
    "Tipo não informado": "Type not provided",
    "Não informada": "Not provided",
    "Nenhum registro válido neste recorte.": "No valid records in these filters.",
    "Confira as colunas, a aba, a UF e as ocorrências antes de tentar novamente.":
      "Check the columns, tab, state, and issues before trying again.",
    "A confirmação grava": "Confirmation saves",
    "registros no diretório interno. A prévia expira em 30 minutos.":
      "records to the internal directory. The preview expires in 30 minutes.",
    "Confirmando importação…": "Confirming import…",
    "Importação concluída. Os registros estão disponíveis para revisão abaixo.":
      "Import complete. The records are available for review below.",
    "Confirmar importação": "Confirm import",
    "Diretório interno · ": "Internal directory · ",
    "Buscar por nome ou município": "Search by name or municipality",
    " registros importados.": " imported records.",
    "Nenhum registro para mostrar.": "No records to display.",
    "Importe uma fonte oficial ou ajuste a busca. Os cadastros operacionais da Hub continuam no menu Empresas.":
      "Import an official source or adjust the search. Hub's operational records remain under Companies.",
    "Prévia das imagens": "Image preview",
    Imagens: "Images",
    "Enviar JPEG, PNG ou WebP (até 5 MB por imagem; limite total de 4 MB na Vercel e 16 MB local) ou informe links HTTPS, um por linha. Até 8 imagens.":
      "Upload JPEG, PNG, or WebP (up to 5 MB per image; 4 MB total on Vercel and 16 MB locally), or enter HTTPS links, one per line. Up to 8 images.",
    "Enviando…": "Uploading…",
    "Enviar imagens": "Upload images",
    "Links e imagens enviadas": "Links and uploaded images",
    "Remover imagem ": "Remove image ",
    "Nome público": "Public name",
    "Endereço curto": "Short URL",
    Município: "Municipality",
    "Tipo ou especialidade": "Type or specialty",
    "Chamada curta": "Short description",
    "Uma frase para apresentar este cadastro.": "A sentence introducing this listing.",
    Apresentação: "Overview",
    "Informações adicionais": "Additional information",
    "Serviços, acessibilidade, horários, estrutura, roteiros ou outras informações úteis.":
      "Services, accessibility, hours, facilities, itineraries, or other useful information.",
    "Endereço ou ponto de atendimento": "Address or service location",
    "Telefone ou WhatsApp": "Phone or WhatsApp",
    "E-mail público": "Public email",
    "Site ou página de contato": "Website or contact page",
    Visibilidade: "Visibility",
    "Rascunho — não aparece no site": "Draft — not shown on the site",
    "Publicado — visível no catálogo": "Published — visible in the catalog",
    "Salvando…": "Saving…",
    "Salvar alterações": "Save changes",
    "Cadastrar conteúdo": "Create listing",
    "Excluindo…": "Deleting…",
    "Excluir do catálogo": "Remove from catalog",
    "NOSSA IDENTIDADE": "OUR IDENTITY",
    "A Amazônia é o nosso ponto de partida.": "The Amazon is where we begin.",
    "As conexões, o caminho.": "Connections are the journey.",
    "A Hub Turismo Amazonas nasceu para aproximar tecnologia, hospitalidade e as pessoas que fazem o turismo acontecer na região.":
      "Hub Turismo Amazonas was created to bring technology, hospitality, and the people who make tourism happen in the region closer together.",
    "Conheça nossa história": "Discover our story",
    "Maués · Amazonas": "Maués · Amazonas",
    "RAÍZES LOCAIS · CONEXÕES QUE VÃO ALÉM": "LOCAL ROOTS · CONNECTIONS THAT GO FURTHER",
    "Da Amazônia, para novas conexões.": "From the Amazon, for new connections.",
    "Amazonas, Brasil": "Amazonas, Brazil",
    "POR QUE CRIAMOS A HUB": "WHY WE CREATED HUB",
    "Uma ideia ampla,": "A broad idea,",
    "um começo possível.": "a practical beginning.",
    "O primeiro foco foi a hospitalidade em Maués.": "Our first focus was hospitality in Maués.",
    "Os documentos de origem imaginaram um Hub de turismo para a Amazônia e definiram um primeiro passo concreto: apoiar a organização diária de hotéis e pousadas.":
      "The original project envisioned a tourism hub for the Amazon and defined a concrete first step: supporting the day-to-day operations of hotels and inns.",
    "A proposta nasceu no contexto de um projeto acadêmico de produto. Em vez de começar tentando resolver toda a viagem de uma vez, o plano priorizou um núcleo de gestão que pudesse acompanhar o percurso da reserva à recepção e à saída do hóspede.":
      "The idea began as an academic product project. Instead of trying to solve an entire trip at once, the plan prioritized a management core covering the journey from booking to reception and guest departure.",
    "Esse começo orienta a Hub até hoje: construir ferramentas úteis para quem recebe, facilitar a descoberta para quem visita e conectar novos serviços conforme o projeto amadurece junto com o território.":
      "That beginning still guides Hub today: building useful tools for hosts, helping visitors discover the region, and connecting new services as the project grows with the community.",
    "Um primeiro passo local para um horizonte amazônico.":
      "A local first step toward an Amazonian horizon.",
    "NOSSO CAMINHO": "OUR JOURNEY",
    "Crescer com foco.": "Grow with focus.",
    "Conectar com cuidado.": "Connect with care.",
    "O projeto começa pelo que pode apoiar o dia a dia e amplia suas conexões sem perder de vista as pessoas e os lugares envolvidos.":
      "The project starts with what can support everyday work and expands its connections while keeping the people and places involved in view.",
    "PONTO DE PARTIDA": "STARTING POINT",
    "Apoiar quem recebe": "Supporting hosts",
    "A proposta original começou pela rotina de hotéis e pousadas: quartos, hóspedes, reservas e o fluxo de recepção.":
      "The original idea started with the daily work of hotels and inns: rooms, guests, bookings, and reception.",
    "CONEXÃO PRESENTE": "CONNECTIONS TODAY",
    "Facilitar a descoberta": "Making discovery easier",
    "Catálogos aproximam visitantes de hospedagens, experiências, gastronomia e outros serviços turísticos.":
      "Catalogs connect visitors with accommodation, experiences, food, and other tourism services.",
    HORIZONTE: "HORIZON",
    "Conectar o destino": "Connecting the destination",
    "A visão de longo prazo é aproximar ainda mais os serviços e as experiências locais, avançando por etapas responsáveis.":
      "Our long-term vision is to bring local services and experiences closer together through responsible, gradual steps.",
    "Missão e visão": "Mission and vision",
    "NOSSA MISSÃO": "OUR MISSION",
    "Criar tecnologia que fortaleça a hospitalidade e as conexões locais.":
      "Create technology that strengthens hospitality and local connections.",
    "Simplificar a rotina de quem recebe e aproximar visitantes dos serviços e das experiências do Amazonas, com ferramentas claras, úteis e responsáveis.":
      "Make daily work easier for hosts and connect visitors with services and experiences in Amazonas through clear, useful, and responsible tools.",
    "NOSSA VISÃO": "OUR VISION",
    "Ser uma ponte digital entre pessoas, negócios e destinos amazônicos.":
      "Be a digital bridge between people, businesses, and Amazonian destinations.",
    "Crescer junto com a região e contribuir para um turismo mais conectado, acolhedor e valorizador de quem vive e trabalha no território.":
      "Grow with the region and contribute to tourism that is more connected, welcoming, and supportive of the people who live and work here.",
    "O QUE NOS GUIA": "WHAT GUIDES US",
    "Valores com": "Values with",
    "raízes e propósito.": "roots and purpose.",
    "São princípios para orientar nossas escolhas de produto, a forma de trabalhar e cada nova conexão que a Hub pretende construir.":
      "These principles guide our product choices, how we work, and every new connection Hub aims to build.",
    "UMA CONSTRUÇÃO EM ETAPAS": "BUILT IN STAGES",
    "Clareza sobre o presente. Responsabilidade com o futuro.":
      "Clarity about today. Responsibility for tomorrow.",
    "Hoje, a plataforma reúne informações turísticas e permite enviar solicitações que dependem da confirmação de cada estabelecimento. Pagamentos on-line e integrações oficiais continuam fora do que está disponível nesta etapa.":
      "Today, the platform brings together tourism information and lets visitors send requests that each provider must confirm. Online payments and official integrations are not part of this stage.",
    "Explore a Hub": "Explore Hub",
    TRANSPARÊNCIA: "TRANSPARENCY",
    "Seu contato, com cuidado.": "Your information, handled with care.",
    "Este aviso explica como os dados enviados no site da Hub Turismo Amazonas são utilizados. Atualizado em 14 de outubro de 2026.":
      "This notice explains how information submitted through the Hub Turismo Amazonas website is used. Updated October 14, 2026.",
    "O que você compartilha": "What you share",
    "O formulário recebe nome, e-mail, organização (opcional), assunto, mensagem e sua autorização de contato. Guardamos a data do envio e a versão deste aviso. Não envie documentos, dados de saúde, informações financeiras ou outros dados sensíveis.":
      "The form collects your name, email, organization (optional), subject, message, and consent to be contacted. We store the submission date and the version of this notice. Do not send documents, health information, financial information, or other sensitive data.",
    "Para que usamos os dados": "How we use the information",
    "Usamos essas informações para compreender sua solicitação e permitir que a equipe responda pelo e-mail informado. O envio não inscreve você em publicidade ou newsletter. Esta versão registra as mensagens em uma área de acesso restrito; não envia e-mails automaticamente.":
      "We use this information to understand your request and let our team reply to the email address provided. Submitting the form does not sign you up for advertising or a newsletter. This version stores messages in a restricted area and does not send emails automatically.",
    "Armazenamento e acesso": "Storage and access",
    "Ao criar uma conta, armazenamos seu nome, e-mail, celular brasileiro e uma representação protegida da senha. As solicitações de reserva incluem a hospedagem ou saída escolhida, período, quantidade de pessoas, observações e situação do pedido. Esses dados são acessíveis a você e à equipe autorizada da empresa responsável. A administração da plataforma gerencia empresas, permissões e registros de operação.":
      "When you create an account, we store your name, email, Brazilian mobile number, and a protected representation of your password. Booking requests include the selected accommodation or departure, dates, party size, notes, and request status. You and the authorized team of the responsible business can access this information. Platform administrators manage businesses, permissions, and operational records.",
    "O resumo diário do painel hoteleiro é calculado localmente a partir das reservas e da situação dos quartos. Esta função não envia dados de hóspedes a serviços externos de inteligência artificial.":
      "The hotel dashboard's daily summary is calculated locally from bookings and room status. This feature does not send guest information to external artificial intelligence services.",
    "O registro local de estadia também guarda país e cidade de origem e horários de entrada e saída. Ele não transmite informações ao sistema oficial de FNRH. Não recebemos pagamentos online nem solicitamos documentos no cadastro desta versão.":
      "The local stay record also stores the guest's country and city of origin and check-in and check-out times. It does not send information to the official FNRH system. This version does not process online payments or request identity documents during registration.",
    "As mensagens ficam no banco de dados do servidor responsável por esta instalação, com acesso limitado a administradores autorizados. Nesta versão local, os dados permanecem neste computador. O provedor e a localização do banco serão informados antes da publicação desta versão. Registros técnicos e identificadores derivados do e-mail e do endereço IP são usados para limitar envios abusivos; o aplicativo não salva o endereço IP em texto no cadastro de contato.":
      "Messages are stored in the database on the server responsible for this installation, with access limited to authorized administrators. In this local version, data remains on this computer. The database provider and location will be disclosed before this version is published. Technical records and identifiers derived from email and IP address help limit abusive submissions; the app does not store the contact form's IP address in plain text.",
    "Suas solicitações": "Your requests",
    "Você pode solicitar informações, correção ou exclusão da sua mensagem pelo":
      "You can request information, correction, or deletion of your message through the",
    "O diretório de turismo apresenta nomes e contatos comerciais divulgados nos dados abertos do Ministério do Turismo / Cadastur, com fonte e período de referência. CPF, data de nascimento e e-mail de administração do cadastro não são publicados. Para corrigir ou retirar um contato do diretório, utilize o formulário abaixo e identifique o prestador.":
      "The tourism directory displays business names and contact details published in open data from the Ministry of Tourism / Cadastur, with its source and reference period. Brazilian tax IDs, dates of birth, and registry administrator emails are not published. To correct or remove a directory contact, use the form below and identify the provider.",
    "formulário de contato": "contact form",
    "selecionando “Privacidade”. A equipe poderá pedir confirmação de identidade antes de atender solicitações. As mensagens são mantidas enquanto necessárias ao atendimento; a equipe deve revisar e excluir dados que não sejam mais necessários.":
      "and select “Privacy.” The team may ask you to verify your identity before handling a request. Messages are kept while needed to respond; the team should review and delete data that is no longer needed.",
    "Cookies e serviços externos": "Cookies and external services",
    "O site não inclui publicidade, analytics ou cookies de marketing. As áreas autenticadas utilizam cookies de sessão para manter o acesso, além de registrar o IP e o navegador das sessões para segurança. A senha é armazenada em formato protegido e não é compartilhada com os visitantes. O login e o cadastro usam Cloudflare Turnstile para verificar que o envio não é automatizado; o token de verificação e dados técnicos da solicitação são enviados à Cloudflare. O formulário público de contato não exige login.":
      "The site does not use advertising, analytics, or marketing cookies. Signed-in areas use session cookies to maintain access and record session IP addresses and browsers for security. Passwords are stored in protected form and are never shared with visitors. Login and registration use Cloudflare Turnstile to check that submissions are not automated; the verification token and technical request data are sent to Cloudflare. The public contact form does not require a login.",
    "Sugestões de proximidade": "Nearby suggestions",
    "A seção envia ao Nominatim o nome, o endereço público e o município da hospedagem para localizar o ponto e consulta o Overpass/OpenStreetMap para encontrar estabelecimentos próximos. O servidor guarda os resultados em cache no banco para reduzir chamadas e apresenta distâncias aproximadas. A localização do visitante não é enviada a esses serviços. As chamadas ao Nominatim seguem a":
      "The section sends the accommodation's name, public address, and city to Nominatim to locate it and queries Overpass/OpenStreetMap to find nearby businesses. The server caches results in the database to reduce repeat requests and shows approximate distances. The visitor's location is not sent to these services. Nominatim requests follow the",
    "política de uso do Nominatim": "Nominatim usage policy",
    ". Os dados são atribuídos ao": ". Data is attributed to",
    ". Quando você abre uma busca, a referência pública da hospedagem e a categoria consultada são enviadas ao Google Maps, que segue sua":
      ". When you open a search, the public accommodation reference and searched category are sent to Google Maps, which follows its",
    "política de privacidade do Google": "Google Privacy Policy",
    "Sobre esta versão": "About this version",
    "A Hub Turismo Amazonas está estruturando seus canais institucionais. Os dados formais da organização e o canal específico de privacidade serão incluídos quando definidos.":
      "Hub Turismo Amazonas is setting up its institutional channels. The organization's formal details and a dedicated privacy contact will be added once they are established.",
    "Voltar ao contato": "Back to contact",
    "← Minha conta": "← My account",
    PREFERÊNCIAS: "PREFERENCES",
    "Configurações da conta": "Account settings",
    "Gerencie seus dados, sua imagem de perfil e os acessos da sua conta.":
      "Manage your information, profile image, and account access.",
    "Opções da conta": "Account options",
    "Dados do perfil": "Profile details",
    "Altere seu nome e confira o e-mail de acesso.":
      "Change your name and review your sign-in email.",
    "Escolha uma das seis ilustrações disponíveis.":
      "Choose one of the six available illustrations.",
    "Acompanhe as solicitações enviadas aos estabelecimentos.":
      "Track requests sent to businesses.",
    "Consulte como os dados da sua conta são tratados.":
      "Learn how your account information is handled.",
    "Sessão ativa": "Active session",
    "Conectado como": "Signed in as",
    "Encerre a sessão quando terminar de usar o site.":
      "Sign out when you are done using the site.",
  },
  es: {
    "Cadastro de guia vinculado": "Perfil de guía vinculado",
    "Guia vinculado:": "Guía vinculada:",
    "vínculo pendente de configuração": "vínculo pendiente de configuración",
    "Agenda somente dos passeios vinculados ao seu cadastro de guia.":
      "Agenda solo de las excursiones vinculadas a tu perfil de guía.",
    "Não há saídas vinculadas ao seu cadastro de guia.":
      "No hay salidas vinculadas a tu perfil de guía.",
    "A administração precisa vincular sua conta ao cadastro correto de guia.":
      "La administración debe vincular tu cuenta al perfil de guía correcto.",
    "O cadastro deste quarto é gerenciado pelo gestor do hotel.":
      "El registro de esta habitación lo gestiona el gerente del hotel.",
    "A pessoa cria sua conta primeiro. Depois, vincule o e-mail à empresa e ao perfil de trabalho. Para o perfil Guia, selecione também o cadastro público correto.":
      "La persona crea una cuenta primero. Después, vincula el correo electrónico a una empresa y a un perfil de trabajo. Para el perfil Guía, selecciona también el registro público correcto.",
    Módulo: "Módulo",
    Hospedagens: "Alojamientos",
    "Ver conjunto oficial ↗": "Ver conjunto oficial ↗",
    "1. Escolha a fonte": "1. Elige la fuente",
    Origem: "Origen",
    "Buscar no Ministério do Turismo": "Buscar en el Ministerio de Turismo",
    "Enviar arquivo oficial": "Subir archivo oficial",
    "Colar conteúdo CSV": "Pegar datos CSV",
    "Consultar arquivos do MTur": "Consultar archivos del Ministerio de Turismo",
    "Arquivo / período": "Archivo / período",
    "Selecione um arquivo": "Selecciona un archivo",
    "Arquivo CSV ou XLSX": "Archivo CSV o XLSX",
    "Até 20 MB. Arquivos XLS devem ser salvos como XLSX. A primeira linha precisa conter os nomes das colunas.":
      "Hasta 20 MB. Guarda los archivos XLS como XLSX. La primera fila debe contener los nombres de las columnas.",
    "Conteúdo CSV": "Datos CSV",
    "Certificado;Nome;UF;Município": "Certificado;Nombre;Estado;Municipio",
    "Copie o cabeçalho e os registros do arquivo de origem. Colunas pessoais serão ignoradas.":
      "Copia el encabezado y los registros del archivo de origen. Se ignorarán las columnas con datos personales.",
    "Aba da planilha": "Pestaña de la hoja de cálculo",
    linhas: "filas",
    "Guias PF e PJ precisam ser importados separadamente. Após trocar de aba, leia as colunas novamente.":
      "Los guías como personas y empresas deben importarse por separado. Después de cambiar de pestaña, vuelve a leer las columnas.",
    "Ler colunas": "Leer columnas",
    "2. Confira as colunas e o recorte": "2. Revisa las columnas y los filtros",
    "Período de referência": "Período de referencia",
    "Município (opcional)": "Municipio (opcional)",
    "Todos os municípios da UF": "Todos los municipios del estado",
    "Não importar / selecionar": "No importar / seleccionar",
    "O nome fantasia tem prioridade na sugestão. Se estiver vazio, será usado o nome alternativo selecionado. Para guias sem nome fantasia, use o nome do profissional.":
      "Se prioriza el nombre comercial. Si está vacío, se usará el nombre alternativo seleccionado. Para guías sin nombre comercial, usa el nombre del profesional.",
    "Importar telefone, e-mail, endereço comercial e site divulgados na fonte":
      "Importar el teléfono, correo, dirección comercial y sitio web publicados en la fuente",
    "Campos com * são obrigatórios. Só estes campos selecionados serão mantidos. Não mapeie informações pessoais em campos cadastrais.":
      "Los campos con * son obligatorios. Solo se conservarán estos campos seleccionados. No asignes datos personales a los campos del registro.",
    "Gerar prévia": "Generar vista previa",
    "3. Revise antes de importar": "3. Revisa antes de importar",
    "Arquivo obtido diretamente do MTur": "Archivo obtenido directamente del Ministerio de Turismo",
    "Arquivo fornecido pelo administrador; origem declarada":
      "Archivo proporcionado por el administrador; origen declarado",
    Novos: "Nuevos",
    Atualizações: "Actualizaciones",
    "Sem alteração": "Sin cambios",
    Duplicatas: "Duplicados",
    "Fora do recorte": "Fuera de los filtros",
    Inválidos: "No válidos",
    Conflitos: "Conflictos",
    "Mais antigos": "Más antiguos",
    "Amostra da prévia, até 100 registros": "Muestra de vista previa, hasta 100 registros",
    "Até 100 registros da seleção. A confirmação processa todos os registros válidos contados acima.":
      "Hasta 100 registros seleccionados. La confirmación procesa todos los registros válidos contados arriba.",
    Prestador: "Proveedor",
    "Situação na fonte": "Estado en la fuente",
    "Tipo não informado": "Tipo no informado",
    "Não informada": "No informada",
    "Nenhum registro válido neste recorte.": "No hay registros válidos con estos filtros.",
    "Confira as colunas, a aba, a UF e as ocorrências antes de tentar novamente.":
      "Revisa las columnas, la pestaña, el estado y las incidencias antes de volver a intentarlo.",
    "A confirmação grava": "La confirmación guarda",
    "registros no diretório interno. A prévia expira em 30 minutos.":
      "registros en el directorio interno. La vista previa caduca en 30 minutos.",
    "Confirmando importação…": "Confirmando importación…",
    "Importação concluída. Os registros estão disponíveis para revisão abaixo.":
      "Importación completada. Los registros están disponibles para revisión a continuación.",
    "Confirmar importação": "Confirmar importación",
    "Diretório interno · ": "Directorio interno · ",
    "Buscar por nome ou município": "Buscar por nombre o municipio",
    "Nenhum registro para mostrar.": "No hay registros para mostrar.",
    "Importe uma fonte oficial ou ajuste a busca. Os cadastros operacionais da Hub continuam no menu Empresas.":
      "Importa una fuente oficial o ajusta la búsqueda. Los registros operativos de Hub siguen en el menú Empresas.",
    "Prévia das imagens": "Vista previa de imágenes",
    Imagens: "Imágenes",
    "Enviar JPEG, PNG ou WebP (até 5 MB por imagem; limite total de 4 MB na Vercel e 16 MB local) ou informe links HTTPS, um por linha. Até 8 imagens.":
      "Sube JPEG, PNG o WebP (hasta 5 MB por imagen; límite total de 4 MB en Vercel y 16 MB en local), o indica enlaces HTTPS, uno por línea. Hasta 8 imágenes.",
    "Enviando…": "Subiendo…",
    "Enviar imagens": "Subir imágenes",
    "Links e imagens enviadas": "Enlaces e imágenes subidas",
    "Remover imagem ": "Eliminar imagen ",
    "Nome público": "Nombre público",
    "Endereço curto": "Dirección corta",
    Município: "Municipio",
    "Tipo ou especialidade": "Tipo o especialidad",
    "Chamada curta": "Descripción breve",
    "Uma frase para apresentar este cadastro.": "Una frase para presentar este registro.",
    Apresentação: "Presentación",
    "Informações adicionais": "Información adicional",
    "Serviços, acessibilidade, horários, estrutura, roteiros ou outras informações úteis.":
      "Servicios, accesibilidad, horarios, instalaciones, itinerarios u otra información útil.",
    "Endereço ou ponto de atendimento": "Dirección o punto de atención",
    "Telefone ou WhatsApp": "Teléfono o WhatsApp",
    "E-mail público": "Correo público",
    "Site ou página de contato": "Sitio web o página de contacto",
    Visibilidade: "Visibilidad",
    "Rascunho — não aparece no site": "Borrador — no aparece en el sitio",
    "Publicado — visível no catálogo": "Publicado — visible en el catálogo",
    "Salvando…": "Guardando…",
    "Salvar alterações": "Guardar cambios",
    "Cadastrar conteúdo": "Crear contenido",
    "Excluindo…": "Eliminando…",
    "Excluir do catálogo": "Eliminar del catálogo",
    "NOSSA IDENTIDADE": "NUESTRA IDENTIDAD",
    "A Amazônia é o nosso ponto de partida.": "La Amazonía es nuestro punto de partida.",
    "As conexões, o caminho.": "Las conexiones son el camino.",
    "A Hub Turismo Amazonas nasceu para aproximar tecnologia, hospitalidade e as pessoas que fazem o turismo acontecer na região.":
      "Hub Turismo Amazonas nació para acercar la tecnología, la hospitalidad y a las personas que hacen posible el turismo en la región.",
    "Conheça nossa história": "Conoce nuestra historia",
    "Maués · Amazonas": "Maués · Amazonas",
    "RAÍZES LOCAIS · CONEXÕES QUE VÃO ALÉM": "RAÍCES LOCALES · CONEXIONES QUE VAN MÁS ALLÁ",
    "Da Amazônia, para novas conexões.": "Desde la Amazonía, hacia nuevas conexiones.",
    "Amazonas, Brasil": "Amazonas, Brasil",
    "POR QUE CRIAMOS A HUB": "POR QUÉ CREAMOS HUB",
    "Uma ideia ampla,": "Una idea amplia,",
    "um começo possível.": "un comienzo posible.",
    "O primeiro foco foi a hospitalidade em Maués.":
      "El primer enfoque fue la hospitalidad en Maués.",
    "Os documentos de origem imaginaram um Hub de turismo para a Amazônia e definiram um primeiro passo concreto: apoiar a organização diária de hotéis e pousadas.":
      "Los documentos de origen imaginaron un Hub de turismo para la Amazonía y definieron un primer paso concreto: apoyar la organización diaria de hoteles y alojamientos.",
    "A proposta nasceu no contexto de um projeto acadêmico de produto. Em vez de começar tentando resolver toda a viagem de uma vez, o plano priorizou um núcleo de gestão que pudesse acompanhar o percurso da reserva à recepção e à saída do hóspede.":
      "La propuesta nació en el contexto de un proyecto académico de producto. En lugar de intentar resolver todo el viaje de una vez, el plan priorizó un núcleo de gestión que acompañara el proceso desde la reserva hasta la recepción y la salida del huésped.",
    "Esse começo orienta a Hub até hoje: construir ferramentas úteis para quem recebe, facilitar a descoberta para quem visita e conectar novos serviços conforme o projeto amadurece junto com o território.":
      "Ese comienzo sigue orientando a Hub: crear herramientas útiles para quienes reciben, facilitar el descubrimiento a quienes visitan y conectar nuevos servicios a medida que el proyecto crece junto con el territorio.",
    "Um primeiro passo local para um horizonte amazônico.":
      "Un primer paso local hacia un horizonte amazónico.",
    "NOSSO CAMINHO": "NUESTRO CAMINO",
    "Crescer com foco.": "Crecer con enfoque.",
    "Conectar com cuidado.": "Conectar con cuidado.",
    "O projeto começa pelo que pode apoiar o dia a dia e amplia suas conexões sem perder de vista as pessoas e os lugares envolvidos.":
      "El proyecto empieza por lo que puede apoyar el día a día y amplía sus conexiones sin perder de vista a las personas y los lugares involucrados.",
    "PONTO DE PARTIDA": "PUNTO DE PARTIDA",
    "Apoiar quem recebe": "Apoyar a quienes reciben",
    "A proposta original começou pela rotina de hotéis e pousadas: quartos, hóspedes, reservas e o fluxo de recepção.":
      "La propuesta original comenzó con la rutina de hoteles y alojamientos: habitaciones, huéspedes, reservas y recepción.",
    "CONEXÃO PRESENTE": "CONEXIÓN PRESENTE",
    "Facilitar a descoberta": "Facilitar el descubrimiento",
    "Catálogos aproximam visitantes de hospedagens, experiências, gastronomia e outros serviços turísticos.":
      "Los catálogos acercan a los visitantes a alojamientos, experiencias, gastronomía y otros servicios turísticos.",
    HORIZONTE: "HORIZONTE",
    "Conectar o destino": "Conectar el destino",
    "A visão de longo prazo é aproximar ainda mais os serviços e as experiências locais, avançando por etapas responsáveis.":
      "La visión a largo plazo es acercar aún más los servicios y las experiencias locales, avanzando por etapas responsables.",
    "Missão e visão": "Misión y visión",
    "NOSSA MISSÃO": "NUESTRA MISIÓN",
    "Criar tecnologia que fortaleça a hospitalidade e as conexões locais.":
      "Crear tecnología que fortalezca la hospitalidad y las conexiones locales.",
    "Simplificar a rotina de quem recebe e aproximar visitantes dos serviços e das experiências do Amazonas, com ferramentas claras, úteis e responsáveis.":
      "Simplificar la rutina de quienes reciben y acercar a los visitantes a los servicios y experiencias de Amazonas con herramientas claras, útiles y responsables.",
    "NOSSA VISÃO": "NUESTRA VISIÓN",
    "Ser uma ponte digital entre pessoas, negócios e destinos amazônicos.":
      "Ser un puente digital entre personas, negocios y destinos amazónicos.",
    "Crescer junto com a região e contribuir para um turismo mais conectado, acolhedor e valorizador de quem vive e trabalha no território.":
      "Crecer junto con la región y contribuir a un turismo más conectado y acogedor, que valore a quienes viven y trabajan en el territorio.",
    "O QUE NOS GUIA": "LO QUE NOS GUÍA",
    "Valores com": "Valores con",
    "raízes e propósito.": "raíces y propósito.",
    "São princípios para orientar nossas escolhas de produto, a forma de trabalhar e cada nova conexão que a Hub pretende construir.":
      "Son principios que orientan nuestras decisiones de producto, nuestra forma de trabajar y cada nueva conexión que Hub pretende construir.",
    "UMA CONSTRUÇÃO EM ETAPAS": "UNA CONSTRUCCIÓN POR ETAPAS",
    "Clareza sobre o presente. Responsabilidade com o futuro.":
      "Claridad sobre el presente. Responsabilidad con el futuro.",
    "Hoje, a plataforma reúne informações turísticas e permite enviar solicitações que dependem da confirmação de cada estabelecimento. Pagamentos on-line e integrações oficiais continuam fora do que está disponível nesta etapa.":
      "Hoy, la plataforma reúne información turística y permite enviar solicitudes que cada establecimiento debe confirmar. Los pagos en línea y las integraciones oficiales aún no están disponibles en esta etapa.",
    "Explore a Hub": "Explora Hub",
    TRANSPARÊNCIA: "TRANSPARENCIA",
    "Seu contato, com cuidado.": "Tu información, tratada con cuidado.",
    "Este aviso explica como os dados enviados no site da Hub Turismo Amazonas são utilizados. Atualizado em 14 de outubro de 2026.":
      "Este aviso explica cómo se utilizan los datos enviados en el sitio de Hub Turismo Amazonas. Actualizado el 14 de octubre de 2026.",
    "O que você compartilha": "Qué compartes",
    "O formulário recebe nome, e-mail, organização (opcional), assunto, mensagem e sua autorização de contato. Guardamos a data do envio e a versão deste aviso. Não envie documentos, dados de saúde, informações financeiras ou outros dados sensíveis.":
      "El formulario recibe tu nombre, correo, organización (opcional), asunto, mensaje y autorización para contactarte. Guardamos la fecha del envío y la versión de este aviso. No envíes documentos, datos de salud, información financiera ni otros datos sensibles.",
    "Para que usamos os dados": "Para qué usamos los datos",
    "Usamos essas informações para compreender sua solicitação e permitir que a equipe responda pelo e-mail informado. O envio não inscreve você em publicidade ou newsletter. Esta versão registra as mensagens em uma área de acesso restrito; não envia e-mails automaticamente.":
      "Usamos esta información para entender tu solicitud y permitir que el equipo responda al correo indicado. El envío no te suscribe a publicidad ni a boletines. Esta versión guarda los mensajes en un área de acceso restringido y no envía correos automáticamente.",
    "Armazenamento e acesso": "Almacenamiento y acceso",
    "Ao criar uma conta, armazenamos seu nome, e-mail, celular brasileiro e uma representação protegida da senha. As solicitações de reserva incluem a hospedagem ou saída escolhida, período, quantidade de pessoas, observações e situação do pedido. Esses dados são acessíveis a você e à equipe autorizada da empresa responsável. A administração da plataforma gerencia empresas, permissões e registros de operação.":
      "Al crear una cuenta, almacenamos tu nombre, correo, número de celular brasileño y una representación protegida de la contraseña. Las solicitudes de reserva incluyen el alojamiento o salida elegidos, fechas, cantidad de personas, observaciones y estado de la solicitud. Tú y el equipo autorizado de la empresa responsable pueden acceder a estos datos. La administración de la plataforma gestiona empresas, permisos y registros operativos.",
    "O resumo diário do painel hoteleiro é calculado localmente a partir das reservas e da situação dos quartos. Esta função não envia dados de hóspedes a serviços externos de inteligência artificial.":
      "El resumen diario del panel hotelero se calcula localmente a partir de las reservas y el estado de las habitaciones. Esta función no envía datos de huéspedes a servicios externos de inteligencia artificial.",
    "O registro local de estadia também guarda país e cidade de origem e horários de entrada e saída. Ele não transmite informações ao sistema oficial de FNRH. Não recebemos pagamentos online nem solicitamos documentos no cadastro desta versão.":
      "El registro local de estancia también guarda el país y la ciudad de origen y los horarios de entrada y salida. No transmite información al sistema oficial de FNRH. En esta versión no recibimos pagos en línea ni solicitamos documentos al registrarse.",
    "As mensagens ficam no banco de dados do servidor responsável por esta instalação, com acesso limitado a administradores autorizados. Nesta versão local, os dados permanecem neste computador. O provedor e a localização do banco serão informados antes da publicação desta versão. Registros técnicos e identificadores derivados do e-mail e do endereço IP são usados para limitar envios abusivos; o aplicativo não salva o endereço IP em texto no cadastro de contato.":
      "Los mensajes se guardan en la base de datos del servidor responsable de esta instalación, con acceso limitado a administradores autorizados. En esta versión local, los datos permanecen en este equipo. El proveedor y la ubicación de la base de datos se informarán antes de publicar esta versión. Los registros técnicos e identificadores derivados del correo y la dirección IP se usan para limitar envíos abusivos; la aplicación no guarda la dirección IP en texto sin formato en el registro de contacto.",
    "Suas solicitações": "Tus solicitudes",
    "Você pode solicitar informações, correção ou exclusão da sua mensagem pelo":
      "Puedes solicitar información, corrección o eliminación de tu mensaje mediante el",
    "O diretório de turismo apresenta nomes e contatos comerciais divulgados nos dados abertos do Ministério do Turismo / Cadastur, com fonte e período de referência. CPF, data de nascimento e e-mail de administração do cadastro não são publicados. Para corrigir ou retirar um contato do diretório, utilize o formulário abaixo e identifique o prestador.":
      "El directorio turístico presenta nombres y contactos comerciales publicados en los datos abiertos del Ministerio de Turismo / Cadastur, con su fuente y período de referencia. No se publican CPF, fechas de nacimiento ni correos de administración del registro. Para corregir o retirar un contacto, usa el formulario e identifica al proveedor.",
    "formulário de contato": "formulario de contacto",
    "selecionando “Privacidade”. A equipe poderá pedir confirmação de identidade antes de atender solicitações. As mensagens são mantidas enquanto necessárias ao atendimento; a equipe deve revisar e excluir dados que não sejam mais necessários.":
      "y selecciona “Privacidad”. El equipo puede pedir que confirmes tu identidad antes de atender la solicitud. Los mensajes se conservan mientras sean necesarios para responder; el equipo debe revisar y eliminar los datos que ya no hagan falta.",
    "Cookies e serviços externos": "Cookies y servicios externos",
    "O site não inclui publicidade, analytics ou cookies de marketing. As áreas autenticadas utilizam cookies de sessão para manter o acesso, além de registrar o IP e o navegador das sessões para segurança. A senha é armazenada em formato protegido e não é compartilhada com os visitantes. O login e o cadastro usam Cloudflare Turnstile para verificar que o envio não é automatizado; o token de verificação e dados técnicos da solicitação são enviados à Cloudflare. O formulário público de contato não exige login.":
      "El sitio no incluye publicidad, analítica ni cookies de marketing. Las áreas autenticadas usan cookies de sesión para mantener el acceso y registran la IP y el navegador de las sesiones por seguridad. La contraseña se guarda de forma protegida y no se comparte con visitantes. El inicio de sesión y el registro usan Cloudflare Turnstile para comprobar que el envío no sea automatizado; el token de verificación y los datos técnicos de la solicitud se envían a Cloudflare. El formulario público de contacto no requiere iniciar sesión.",
    "Sugestões de proximidade": "Sugerencias cercanas",
    "A seção envia ao Nominatim o nome, o endereço público e o município da hospedagem para localizar o ponto e consulta o Overpass/OpenStreetMap para encontrar estabelecimentos próximos. O servidor guarda os resultados em cache no banco para reduzir chamadas e apresenta distâncias aproximadas. A localização do visitante não é enviada a esses serviços. As chamadas ao Nominatim seguem a":
      "La sección envía al Nominatim el nombre, la dirección pública y el municipio del alojamiento para localizarlo y consulta Overpass/OpenStreetMap para encontrar establecimientos cercanos. El servidor guarda los resultados en caché en la base de datos para reducir consultas repetidas y muestra distancias aproximadas. La ubicación del visitante no se envía a esos servicios. Las consultas a Nominatim siguen la",
    "política de uso do Nominatim": "política de uso de Nominatim",
    ". Os dados são atribuídos ao": ". Los datos se atribuyen a",
    ". Quando você abre uma busca, a referência pública da hospedagem e a categoria consultada são enviadas ao Google Maps, que segue sua":
      ". Al abrir una búsqueda, la referencia pública del alojamiento y la categoría consultada se envían a Google Maps, que se rige por su",
    "política de privacidade do Google": "Política de Privacidad de Google",
    "Sobre esta versão": "Sobre esta versión",
    "A Hub Turismo Amazonas está estruturando seus canais institucionais. Os dados formais da organização e o canal específico de privacidade serão incluídos quando definidos.":
      "Hub Turismo Amazonas está organizando sus canales institucionales. Los datos formales de la organización y un canal específico de privacidad se incluirán cuando estén definidos.",
    "Voltar ao contato": "Volver al contacto",
    "← Minha conta": "← Mi cuenta",
    PREFERÊNCIAS: "PREFERENCIAS",
    "Configurações da conta": "Configuración de la cuenta",
    "Gerencie seus dados, sua imagem de perfil e os acessos da sua conta.":
      "Gestiona tus datos, tu imagen de perfil y los accesos de tu cuenta.",
    "Opções da conta": "Opciones de la cuenta",
    "Dados do perfil": "Datos del perfil",
    "Altere seu nome e confira o e-mail de acesso.":
      "Cambia tu nombre y consulta el correo de acceso.",
    "Escolha uma das seis ilustrações disponíveis.":
      "Elige una de las seis ilustraciones disponibles.",
    "Acompanhe as solicitações enviadas aos estabelecimentos.":
      "Sigue las solicitudes enviadas a los establecimientos.",
    "Consulte como os dados da sua conta são tratados.":
      "Consulta cómo se tratan los datos de tu cuenta.",
    "Sessão ativa": "Sesión activa",
    "Conectado como": "Conectado como",
    "Encerre a sessão quando terminar de usar o site.":
      "Cierra la sesión cuando termines de usar el sitio.",
  },
};
