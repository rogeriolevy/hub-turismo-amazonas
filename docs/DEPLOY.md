# Publicação da versão Node.js

Esta versão não foi publicada. O site Sites existente permanece disponível. Escolher hospedagem e endereço antes da transição. Não é necessário usar Cloudflare, D1 ou Drizzle.

Decisão atual do proprietário: seguir somente com uso local. Existe uma VPS Hostinger, mas domínio, sistema operacional e ocupação do servidor ainda não foram verificados. Este documento permanece como referência futura; nenhum acesso ou alteração na VPS foi realizado. Consulte docs/USO-LOCAL.md para a etapa atual.

## Requisitos

Um servidor Linux ou serviço gerenciado com Node.js 22 LTS, disco local persistente, HTTPS e processo Node contínuo. Executar uma única instância. Não guardar SQLite em filesystem efêmero ou compartilhamento de rede. Instalar dependências e compilar no sistema de destino; não copiar node_modules do Windows para Linux.

Um serviço gerenciado com volume persistente reduz manutenção de servidor. Em uma VPS, o operador administra atualizações, TLS, proxy, processo e backups. Os arquivos infra/ são modelos para a segunda opção.

## Instalação

1. Disponibilizar o código em /opt/hub-turismo, com usuário de serviço sem privilégios.
2. Executar npm ci e npm run setup.
3. Ajustar .env.local: SITE_URL=https://seu-dominio, DATABASE_PATH=/var/lib/hub-turismo/hub.sqlite, ADMIN_EMAILS=rogerio1kg@gmail.com. Manter o segredo gerado ou provisionar segredo aleatório com ao menos 32 caracteres.
4. Criar o diretório de dados com acesso somente ao usuário do serviço.
5. Se usar o Nginx fornecido, definir TRUST_PROXY_IP_HEADER=x-real-ip. O proxy deve sobrescrever o cabeçalho; não aceitar x-forwarded-for enviado diretamente pelo visitante. O Node permanece vinculado a 127.0.0.1.
6. Executar npm run db:migrate e npm run admin:create. Definir senha forte no terminal.
7. Executar verificações e npm run build. SITE_URL deve estar correto durante o build, pois páginas públicas e metadados são pré-renderizados.
8. Configurar serviço a partir de infra/hub-turismo.service e proxy TLS a partir de infra/nginx.conf, substituindo domínio e caminhos de certificado. Certificados não são fornecidos.
9. Iniciar o serviço. Testar página pública, envio de contato, login, logout e bloqueio de /api/admin/contatos sem sessão. API anônima deve responder 401.

O comando npm start mantém o Node em loopback na porta 3005. O proxy publica a porta HTTPS. O exemplo não instala pacotes de sistema nem configura domínio automaticamente.

A ampliação 0.3.0 permanece destinada à validação local. Antes de abrir o cadastro e os painéis empresariais na internet, implementar confirmação/recuperação de e-mail, homologar a matriz de permissões e as regras de reservas com as empresas, revisar paginação/limites de consulta e testar o fluxo entre duas empresas distintas. A recuperação atual depende do terminal e da verificação manual de identidade. Consulte PLATAFORMA.md para os limites funcionais, incluindo o registro local de estadia sem integração oficial de FNRH.

## Backup e restauração

npm run db:backup usa a API de backup SQLite para criar cópia consistente mesmo com WAL ativo. Os backups contêm dados pessoais, hashes de senha e sessões: proteger como o banco original. Copiar para armazenamento externo protegido e aplicar política de retenção aprovada.

Para agendamento em Linux, adaptar infra/hub-backup.service e infra/hub-backup.timer. Eles não estão ativados nesta entrega. O destino padrão /var/backups/hub-turismo deve existir e pertencer ao usuário do serviço. Configurar cópia externa; backup no mesmo disco não protege contra perda da máquina.

Restauração:

1. Executar npm run db:restore -- caminho/backup.sqlite /var/lib/hub-turismo/restaurado.sqlite. O destino deve ser novo.
2. Parar o serviço, preservar o banco anterior e ajustar DATABASE_PATH para o arquivo restaurado.
3. Antes de reabrir ao público, encerrar sessões restauradas: usar npm run admin:password para administradores e npm run account:password -- EMAIL para demais contas, ou realizar manutenção controlada da tabela de sessões com o serviço parado. Conferir também se usuários/permissões refletem a situação atual; restaurar um backup pode reintroduzir vínculos revogados depois dele.
4. Executar npm run db:migrate, reiniciar e verificar saúde, mensagens e login.

Testar periodicamente em diretório separado. Não copiar somente o arquivo principal de um banco aberto em WAL; usar o comando de backup.

## Atualizações e retorno

Fazer backup antes da migração. Parar o serviço para alterações de esquema; instalar a versão validada, executar migrações e build com configuração correta e reiniciar. Verificar /api/health e os fluxos essenciais.

Se houver falha, restaurar código anterior e banco compatível, em arquivo separado. Não executar versões antigas sobre esquema incompatível.

## Transição do site atual

O endereço chatgpt.site e o login delegado do Sites não são transferidos automaticamente. A nova publicação recebe o endereço fornecido pelo provedor ou domínio próprio. Preservar o site atual até validar a nova instalação.

Caso existam mensagens na produção, planejar exportação e importação de contacts com todos os campos de consentimento, idempotência e datas, comparar contagens e impedir perdas durante a troca. Este procedimento depende dos dados reais e ainda não foi executado. Não importar cookies ou sessões da plataforma.

Atualizar aviso de privacidade com provedor/localização e canais empresariais confirmados antes da publicação. Não inventar informações.

## CI/CD

O workflow verifica o projeto em GitHub Actions e produz evidência dos testes. A publicação é manual e documentada nesta fase, pois o destino ainda não foi escolhido. Não há integração de deploy ou credenciais de provedor configuradas. Automatizar CD somente após definir hospedagem e uma forma segura de retorno.
