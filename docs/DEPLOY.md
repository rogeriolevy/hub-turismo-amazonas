# Publicação da versão Node.js

## Estado publicado

A versão 0.12.11 está publicada na VPS com Docker Compose, PostgreSQL e Nginx em `https://hubamazonas.vps12233.panel.icontainer.site`. Em 04/11/2026, HTTPS validou sem erro de certificado; `/api/health` respondeu HTTP 200 com `status=ok`, `version=0.12.11` e `database=postgresql`. Web, worker e PostgreSQL estão saudáveis. O link `/opt/hub-turismo/current` aponta para `/opt/hub-turismo/release-0.12.11`; a release 0.12.10 permanece disponível para retorno.

Na plataforma, o cabeçalho oferece links para os seis módulos turísticos e destaca a página ativa; Sobre a Hub e Contato ficam somente na área institucional e não aparecem no rodapé da plataforma. As páginas `/plataforma`, `/hospedagens` e `/navegacao` foram verificadas por HTTPS; o item Navegação recebeu `aria-current="page"`. A página institucional mantém Sobre/Contato, e a grade Maués ↔ Parintins aparece em Navegação. O heartbeat do worker foi atualizado e as contagens agregadas da base após a publicação foram `users=2`, `bookings=0`, `booking_reminders=0`, `cadastur_entries=42`, `cadastur_imports=6` e `catalog_media=1`.

Antes da publicação 0.12.11, um backup PostgreSQL foi copiado para este computador, conferido por SHA-256 e restaurado em banco isolado. A restauração confirmou `users=2`, `bookings=0`, `booking_reminders=0` e `cadastur_entries=42`. O arquivo está em `%LOCALAPPDATA%\HubTurismo\Backups\hub-20261104T213535Z-2422434\hub-20261104T213535Z-2422434.dump`; o SHA-256 é `6eb2ebf7c27ee633fe3d0eaf85b50af1e7c38517b976206e1d81b052e7485753`. Consulte o [runbook de backup local e recuperação](BACKUP-RECUPERACAO.md).

As releases 0.12.6 a 0.12.11 permanecem preservadas; a 0.12.10 é a versão anterior elegível para retorno. A imagem 0.12.11 foi construída exclusivamente no Docker da VPS. Nenhum schema ou volume foi alterado e a importação SQLite→PostgreSQL não foi repetida. Consulte a [baseline de proveniência](../.planning/phases/01-baseline-e-candidata/01-BASELINE.md), o [registro da versão 0.12.10](releases/0.12.10.md) e a [proveniência da 0.12.11](releases/0.12.11.md).

O serviço Sites existente permanece independente da VPS. A origem oficial foi confirmada e validada em uma transferência descartável antes da publicação. Consulte também [USO-LOCAL.md](USO-LOCAL.md) para continuar usando a instalação local.

Para copiar o backup da VPS para este computador por SSH e ensaiar a restauração isolada, consulte o [runbook de backup local e recuperação](BACKUP-RECUPERACAO.md). A exportação sozinha não libera publicação; checksum, ensaio e preflight continuam obrigatórios.

## Limpeza Cadastur de outros municípios

O procedimento `infra/apply-cadastur-maues-cleanup.ps1`, introduzido durante a preparação da 0.12.8, permanece disponível na release atual. A limpeza aprovada já foi aplicada: o preflight remoto confirmou o backup mais recente e as contagens esperadas, a transação deixou 42 registros Cadastur de Maués e zero fora, e preservou as seis importações históricas. O script permanece como procedimento auditável para futuras execuções; sem parâmetros, apenas consulta e imprime contagens agregadas.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\apply-cadastur-maues-cleanup.ps1
```

Para uma futura limpeza autorizada, só depois de BACK-01 concluído passe também `-Apply -ConfirmOffsiteBackupValidated -ValidatedBackupFile 'hub-AAAAMMDDTHHMMSSZ-123.dump' -ValidatedBackupSha256 '<sha256-validado>'`. O script pede uma confirmação digitada no terminal e usa o alias SSH existente `hub-turismo-vps`; ele não inicia Docker local nem reinicia serviços.

## Requisitos

Para o alvo atual, uma VPS Linux com Docker Engine, Docker Compose plugin, domínio e HTTPS. Execute uma única instância web inicialmente. O volume PostgreSQL fica persistente e não recebe tráfego público. A alternativa nativa em Node.js 22 e SQLite está descrita mais abaixo; não copie `node_modules` do Windows para Linux.

Um serviço gerenciado com volume persistente reduz manutenção de servidor. Em uma VPS, o operador administra atualizações, TLS, proxy, processo e backups. Os arquivos infra/ são modelos para a segunda opção.

## Preparar acesso SSH

Para iniciar a instalação, organize: endereço IP ou hostname da VPS, porta SSH (22 se não foi alterada), usuário com acesso administrativo, domínio que apontará para o servidor e uma chave pública autorizada nesse usuário. A sessão de implantação usa a chave privada que já está neste computador; não a copie para o repositório nem a envie por mensagem. Somente o arquivo público (`.pub`) deve ser instalado em `~/.ssh/authorized_keys` no servidor.

No Windows PowerShell, é possível preparar a chave pública mesmo antes de a VPS estar provisionada:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\prepare-ssh.ps1 -CreateKeyOnly
```

O modo `-CreateKeyOnly` cria `~\.ssh\hub-turismo-vps` com Ed25519 e pede uma frase-senha; se o par já existir, ele o preserva e mostra a chave pública existente. Para usar uma chave privada que esteja em outro caminho, informe `-IdentityFile 'C:\caminho\da\chave'`. Se houver um `.pub` ao lado dela, o assistente compara as impressões digitais dos arquivos sem desbloquear a privada; também aceita `-PublicKeyFile 'C:\caminho\da\chave.pub'` quando a pública estiver em outro local. Se não houver arquivo público, ele deriva a pública da privada e `ssh-keygen` pode solicitar a frase-senha local. Essa conferência identifica a chave pública associada ao arquivo; o primeiro login SSH ainda valida a frase-senha e a assinatura da chave privada. O assistente não grava nem move a chave privada. Se a validação falhar, o `config` não é alterado. Esse modo não precisa de hostname ou usuário e não altera o `config` SSH. Cadastre somente a chave pública em `~/.ssh/authorized_keys` para a conta do servidor usando o console do provedor ou outro acesso autorizado.

Quando souber o hostname/IP e o usuário SSH, execute o assistente sem `-CreateKeyOnly`. Ele reutiliza o par completo padrão, cria um novo se ainda não houver nenhum, ou usa uma chave alternativa informada com `-IdentityFile`. Valida a porta e acrescenta o alias `hub-turismo-vps` ao `config` sem substituir configurações existentes. Se o par padrão estiver incompleto, a chave alternativa falhar na validação, ou se um bloco atual já cobrir o alias, ele interrompe sem sobrescrever arquivos. Depois do cadastro da chave pública, teste com `ssh hub-turismo-vps`. Para uma porta diferente de 22, informe `-Port 2222` (substituindo pelo valor da VPS).

A chave privada permanece neste computador e não deve ser copiada ao repositório nem enviada por mensagem. Quando o acesso estiver pronto, bastam hostname/IP, porta, usuário, caminho local da chave privada e domínio para continuar; não inclua a frase-senha nem o conteúdo da chave privada. A conta de servidor deve permitir instalar Docker/Compose, configurar Nginx/TLS e administrar o serviço; o procedimento de publicação usa uma conta Linux `hub` e não requer login SSH direto como `root`.

Para consultar containers, volumes, permissões das releases, heartbeat, timer e arquivos de backup sem alterar a VPS, execute `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\inspect-vps-operations.ps1 -IdentityFile 'C:\caminho\da\chave'`. O script exige uma entrada prévia do host em `known_hosts`, usa a fingerprint já confiada por OpenSSH e consulta somente o projeto Compose `hub-turismo`; apresenta os nomes e destinos dos volumes montados, o alvo do link `current`, modos/contagens de escrita em cada release e as permissões do arquivo `vps.env`, sem ler seus valores. Também confere a presença dos pares de dump/manifesto e, para o dump mais recente, o SHA-256 e se `pg_restore --list` consegue ler o índice. Para salvar a saída localmente sem sobrescrever um arquivo, acrescente `-OutputLogPath "$env:TEMP\hub-operations.log"` e escolha um nome ainda não usado. O log contém a saída do diagnóstico, não a frase-senha digitada no prompt do OpenSSH. Essa checagem não restaura o banco nem valida todos os blocos de dados; faça um ensaio separado em banco descartável antes de depender do backup.

Antes de reconstruir ou transferir o código, gere um snapshot de fontes com `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\package-source-snapshot.ps1`. O ZIP e o sidecar `.sha256` ficam em `tmp/`; o manifesto registra a versão, o `HEAD`, o estado do checkout e o hash de cada arquivo incluído. O empacotador ignora dados SQLite, backups, uploads, segredos locais, chaves privadas, dependências e arquivos temporários, e remove somente a pasta que criou se a validação do ZIP falhar. Esse pacote preserva o código para reconstrução; não substitui o backup do banco nem o histórico Git.

## Alvo atual: VPS com PostgreSQL

O runner PostgreSQL aplica primeiro as migrações compartilhadas de `db/migrations` e depois as exclusivas de `db/postgres-migrations`, cada uma com checksum versionado em `schema_migrations`. Um advisory lock serializa os processos; se outro processo mantiver o lock por mais de dois minutos, a inicialização falha explicitamente e o serviço não inicia sobre um schema incerto. A primeira migração PostgreSQL registra a função `hub_normalize_label`, instala `pg_trgm` e cria índices GIN para as buscas de hospedagens, passeios e conteúdo Hub sem vínculo Cadastur. `pg_trgm` é uma extensão trusted; a role da aplicação, proprietária do banco, pode instalá-la com privilégio `CREATE` no próprio banco ([documentação PostgreSQL](https://www.postgresql.org/docs/18/pgtrgm.html)).

O Compose mantém uma instância da aplicação e uma do PostgreSQL na mesma rede Docker. Somente a aplicação publica a porta `3005` no loopback do host para o Nginx; o PostgreSQL não publica uma porta. A aplicação usa uma conta PostgreSQL própria, sem privilégios de superusuário, e migra o esquema na inicialização. A conta administrativa do banco fica restrita ao bootstrap e aos scripts de backup/restauração. Imagens de catálogo são gravadas em `catalog_media`. Os serviços têm logs locais limitados a cinco arquivos de 10 MB por container e prazos de encerramento para permitir que a aplicação e o PostgreSQL tratem `SIGTERM`. O Dockerfile tem etapas separadas de build e runtime e usa `output: "standalone"` do Next.js: a imagem final inclui o servidor compilado, dependências rastreadas e arquivos de servidor necessários para inicialização e migrações, sem levar o código-fonte da interface nem as dependências de desenvolvimento. A imagem PostgreSQL está fixada em `postgres:18.6-alpine` para que uma nova instalação reproduza a versão homologada; atualizações menores devem alterar essa tag após revisão e validação da aplicação.

O projeto Compose tem nome fixo `hub-turismo` em `infra/compose.vps.yaml`; scripts operacionais e comandos deste guia também passam `-p hub-turismo`. Preserve esse nome ao operar as releases: ele mantém os volumes persistentes do PostgreSQL associados ao mesmo projeto quando o diretório da versão muda.

Cada versão de aplicação recebe uma etiqueta local versionada no formato `hub-turismo-amazonas:<APP_VERSION>`. Mantenha `APP_VERSION` em `infra/vps.env` alinhada a `package.json`; `npm run check:vps-release` confere o arquivo de exemplo no repositório e a CI constrói a imagem pelo mesmo Compose da VPS. Não reutilize etiquetas de versões anteriores: mantenha a imagem anterior para possibilitar retorno do código, respeitando a compatibilidade do schema PostgreSQL.

1. Instale Docker Engine e Docker Compose plugin no servidor Linux. Configure o DNS e HTTPS no Nginx usando `infra/nginx.conf`, substituindo `hub.example.com` pelo domínio escolhido. O redirecionamento HTTP usa esse nome canônico configurado no servidor.
2. Copie `infra/vps.env.example` para `infra/vps.env`, substitua todos os exemplos e restrinja o arquivo com `chmod 600 infra/vps.env`. Esse arquivo está excluído do Git e do contexto Docker. Gere senhas hexadecimais distintas para `POSTGRES_PASSWORD` e `HUB_DB_PASSWORD` (`openssl rand -hex 32`); a senha da conta de aplicação entra na URL PostgreSQL e precisa ser URL-safe. `POSTGRES_USER` é a conta administrativa usada por bootstrap e backup/restauração; a aplicação conecta como `HUB_DB_USER`, uma conta sem `SUPERUSER`, `CREATEDB` ou `CREATEROLE`, proprietária somente do banco da Hub. `OSM_NOMINATIM_URL` e `OSM_OVERPASS_URL` podem ser trocados por endpoints compatíveis sem reconstruir a imagem; mantenha provedores HTTPS e respeite seus limites de uso.

   No checkout local, valide o arquivo ignorado sem exibir valores secretos com `npm run check:vps-env`. Antes de iniciar o banco no servidor, valide novamente a configuração e as permissões, além da interpolação do Compose:

   ```sh
   docker run --rm --network none --env-file infra/vps.env \
     -v "$PWD/scripts/check-vps-env.mjs:/check-vps-env.mjs:ro" \
     -v "$PWD/infra/vps.env:/vps.env:ro" \
     -v "$PWD/package.json:/package.json:ro" \
     node:22-bookworm-slim node /check-vps-env.mjs /vps.env /package.json
   docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml config --quiet
   ```

   A pré-checagem recusa valores de exemplo, chaves de teste do Turnstile, versão de imagem diferente do `package.json`, senhas de banco fracas/iguais, contas PostgreSQL iguais, combinações SMTP inválidas, ativação de e-mail de reserva sem SMTP e permissões amplas no arquivo de ambiente. O container da checagem não tem acesso à rede.
   Para confirmação e recuperação de conta, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` com um serviço transacional autorizado para o domínio. A porta 587 usa STARTTLS; a 465 usa TLS implícito. Mantenha `REQUIRE_EMAIL_VERIFICATION=false` enquanto houver contas migradas ainda não confirmadas; a aplicação recusa exigir confirmação sem SMTP configurado. Para avisos de reserva, defina `BOOKING_EMAIL_NOTIFICATIONS=true` somente depois de testar o SMTP. O serviço Compose `booking-email-worker` consome a fila e pode ser acompanhado com `docker compose -p hub-turismo logs -f booking-email-worker`; o healthcheck também marca o container como não saudável se o heartbeat ficar ausente ou vencido. Isso sinaliza falha, mas não reinicia sozinho um processo que continua ativo. Os logs não incluem dados do hóspede. Uma falha depois da aceitação pelo SMTP pode resultar em repetição.

3. Para preservar os dados locais, pare o servidor local e gere um backup consistente com `npm run db:backup`. Compare a origem e a cópia com `npm run db:verify-snapshot -- data/hub.sqlite "CAMINHO_DO_BACKUP.sqlite"`; o comando lê os dois arquivos, verifica integridade e chaves estrangeiras, compara esquema e todas as linhas por tabela, e imprime apenas contagens e um fingerprint. Copie o arquivo `.sqlite`, seu manifesto `.sqlite.media.json` e `public/uploads/catalog/` à VPS por um canal protegido. O manifesto preserva as datas de criação originais das imagens e vincula os hashes das imagens ao hash do banco. Não copie o banco SQLite aberto nem envie segredos pelo Git. O importador aceita backups desde a migração `010_catalog_media.sql`; as colunas de guia ausentes antes de `018_guide_member_assignment.sql` entram como `NULL`, a tabela de notificações ausente antes de `019_user_notifications.sql` começa vazia e a tabela de lembretes ausente antes de `022_booking_reminders.sql` também começa vazia. Se as tabelas de notificações ou lembretes existirem na origem, seus estados são transferidos com reservas e contas. A outbox de e-mail é estado operacional e não é copiada, evitando replay de mensagens antigas.
4. Na VPS, inicie apenas o banco: `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml up -d postgres`. Em um volume PostgreSQL novo, o script de inicialização cria a conta da aplicação e transfere a propriedade do banco para ela. Esse script só roda na criação de um volume vazio. Para atualizar um volume existente, mantenha em `POSTGRES_USER` a conta administrativa original e a senha correspondente, faça um backup com `bash infra/backup-postgres.sh`, pare a aplicação com `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml stop web` e execute `bash infra/migrate-postgres-app-role.sh`. A migração cria ou ajusta a conta de aplicação e transfere, somente no banco de `POSTGRES_DB`, o schema `public` e seus objetos de aplicação. Ela não usa `REASSIGN OWNED` e não altera objetos de outros bancos. Se a conta de aplicação já possuir outro banco ou associação a outros papéis, o script aborta para revisão. Depois construa a imagem: `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml build web`.
5. Com a aplicação parada, aplique o esquema como `HUB_DB_USER`: `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml run --rm --no-deps web npm run db:migrate:postgres`. Em volume novo, não execute a migração de propriedade; a inicialização já fez essa etapa. Em volume existente, conclua a migração de propriedade antes desta migração de esquema.
6. A importação SQLite só se aplica à primeira migração para um banco PostgreSQL vazio. Se esse banco já contém dados da aplicação, não execute o importador. Para a primeira migração, faça a prévia do importador montando o backup, o manifesto e a pasta de imagens em um container temporário somente leitura:

   ```sh
   docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml run --rm --no-deps --user 0:0 \
     -v /caminho/seguro/hub.sqlite:/transfer/hub.sqlite:ro \
     -v /caminho/seguro/hub.sqlite.media.json:/transfer/hub.sqlite.media.json:ro \
     -v /caminho/seguro/catalog:/transfer/uploads:ro \
     web node --experimental-strip-types scripts/transfer-sqlite-postgres.ts \
     /transfer/hub.sqlite --uploads=/transfer/uploads
   ```

   Depois de conferir as contagens, repita o mesmo comando acrescentando `--apply`. Se não houver imagens, monte uma pasta vazia como `/transfer/uploads`; se o diretório não existir, o importador aborta para evitar ignorar uma montagem esquecida. Todas as tabelas de dados no schema PostgreSQL da aplicação precisam estar vazias; o ledger `schema_migrations` é preservado. O script aborta diante de registros pré-existentes ou incompatibilidade de esquema. O container temporário usa root somente para ler arquivos de backup protegidos; o serviço web continua como usuário `node`.

7. Inicie a aplicação com `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml up -d web booking-email-worker`. Na 0.12.1 ou posterior, confira `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml ps postgres web booking-email-worker`: após a janela inicial, os três serviços devem aparecer saudáveis. O estado saudável do worker confirma apenas um heartbeat recente; não prova entrega SMTP. Antes de apontar o domínio, confirme o serviço, a versão e o mecanismo PostgreSQL localmente com `npm run verify:vps-health -- http://127.0.0.1:3005`. Depois da troca de DNS, execute `npm run verify:vps-health` para verificar o domínio canônico. O endpoint de saúde responde 503 se o perfil VPS pedir mídia em PostgreSQL, mas o processo tiver aberto SQLite. O comando tenta novamente por até 12 vezes e não imprime valores secretos. Em seguida, confira catálogo, login e fluxos de administração. Antes de habilitar contas de guia migradas, a administração deve revisar os perfis de guia e associar cada conta ao cadastro correto em `/painel/plataforma/acessos`; sem vínculo, a agenda fica bloqueada.

O importador preserva contas e hashes de senha, contatos, empresas, reservas e notificações, registros Cadastur, conteúdo editorial, auditoria e imagens. Lê os registros em lotes de até 100 e transfere cada imagem separadamente, mantendo o uso de memória limitado sem dividir a transação no PostgreSQL. A prévia valida integridade estrutural e referências estrangeiras das tabelas transferidas, MIME, assinatura, Base64 e tamanho das imagens armazenadas no SQLite, além de conferir as referências do catálogo e as imagens locais. O manifesto obrigatório é vinculado ao hash SHA-256 do banco; o importador confere nome, tamanho, MIME e hash de cada arquivo e aplica a data original registrada antes da cópia para a VPS. As imagens também são conferidas novamente antes da inserção. A origem permanece em uma transação de leitura para comparar contagens e evitar misturar estados diferentes do backup. Sessões, chaves JWT, desafios de verificação, limites de requisição, caches temporários e a outbox de e-mail não são transferidos. O importador também recusa qualquer tabela SQLite sem regra explícita de transferência ou exclusão; ao adicionar uma tabela em uma versão futura, revise essa regra antes de migrar. O primeiro login na VPS deve criar novas sessões. Faça a transferência uma única vez para um PostgreSQL recém-migrado e vazio.

A CI audita vulnerabilidades altas ou críticas na árvore de dependências de produção antes de verificar a versão. As dependências exclusivas de desenvolvimento também são auditadas durante a instalação; alertas nelas devem ser analisados sem degradar a versão principal do Next.js para contornar uma dependência transitiva. Ela também percorre os imports executáveis dos componentes de navegador e bloqueia referências a `server/` ou `db/`. A CI executa uma transferência de dados sintéticos em SQLite e PostgreSQL descartáveis. Ela confere que a prévia não grava, compara as contagens depois da transferência, verifica hashes de credencial, vínculos e reescrita das referências de imagens locais, confirma que sessões antigas ficam de fora e recusa reaplicar dados sobre tabelas preenchidas. Esse cenário automatizado não substitui a conferência dos dados reais durante a homologação da VPS.

Execute `bash infra/backup-postgres.sh` para gerar um dump PostgreSQL protegido e seu manifesto `ARQUIVO.dump.sha256`. A restauração confere o hash antes de criar o banco de destino. Copie os dois arquivos juntos para armazenamento fora da VPS; dumps antigos sem manifesto continuam aceitos, com aviso e validação estrutural do formato PostgreSQL. O padrão conserva 14 dias de dumps e manifestos locais; `BACKUP_RETENTION_DAYS` pode ajustar esse prazo.

Para configurar uma VPS com releases em `/opt/hub-turismo/release-VERSÃO`, execute `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\configure-vps-backups.ps1 -IdentityFile 'C:\caminho\da\chave'`. O helper usa `known_hosts` e exige confirmação estrita do host. Ele identifica a release dos containers ativos, confere PostgreSQL/web/worker, remove permissão de escrita para grupo e outros da árvore de código, protege `infra/vps.env` como `hub:hub`/`600`, cria o link `/opt/hub-turismo/current` se estiver ausente, gera um dump, confere checksum e índice, restaura para um banco novo `hub_restore_...` e instala/ativa o timer diário às 03:00. Instala também `/opt/hub-turismo/backup-postgres-active.sh`, wrapper estável que resolve o link `current` uma vez no início do backup para manter scripts, Compose e ambiente na mesma release. O site e o banco principal não são reiniciados ou alterados; o banco de ensaio fica disponível para conferência. Se as unidades systemd ou o wrapper já existirem com conteúdo diferente, o helper para sem sobrescrevê-los. Depois de cada nova release saudável, atualize o link `current` atomicamente. A cópia fora da VPS continua necessária para recuperação de falha do servidor.

Após a nova release passar pela verificação de saúde, atualize o link como root, ajustando a versão. Remova escrita de grupo/outros e mantenha `vps.env` restrito; o wrapper de backup recusa executar se essas condições falharem. O comando abaixo troca o destino do link de forma atômica:

```sh
release=/opt/hub-turismo/release-0.12.11
chmod -R go-w "$release"
chown hub:hub "$release/infra/vps.env"
chmod 600 "$release/infra/vps.env"
ln -s "$release" /opt/hub-turismo/current.next &&
  mv -Tf /opt/hub-turismo/current.next /opt/hub-turismo/current
```

O timer usa `infra/hub-postgres-backup.service` e `infra/hub-postgres-backup.timer`. Para conferir o próximo agendamento e o último resultado, use `systemctl list-timers --all hub-postgres-backup.timer` e `systemctl status hub-postgres-backup.service`; confira também o SHA-256 e ensaie a restauração em um banco descartável antes de depender do backup.

Para ensaiar uma restauração sem substituir o banco em uso, execute `bash infra/restore-postgres.sh /var/backups/hub-turismo/ARQUIVO.dump hub_restore_20261013`. O destino precisa ser um nome novo e diferente do banco configurado para a aplicação: o script verifica o SHA-256 quando há manifesto, valida o arquivo, cria o banco de restauração sob a propriedade de `HUB_DB_USER`, recusa o banco principal e qualquer destino já existente e remove o banco parcial recém-criado se a restauração falhar. A aplicação continua ligada ao banco original; valide o banco restaurado antes de alterar `POSTGRES_DB`/`DATABASE_URL` para uma recuperação real. Os exemplos assumem o usuário Linux `hub`, membro do grupo `docker`, e caminhos de instalação em `/opt/hub-turismo`.

Para a situação específica da Vercel, incluindo a pré-checagem que bloqueia dados em filesystem efêmero, consulte [docs/VERCEL.md](VERCEL.md).

## Instalação nativa alternativa (Node.js + SQLite)

Esta seção mantém a opção local/monoinstância SQLite. Para a nova VPS PostgreSQL, use a seção anterior. O esquema e o importador também foram exercitados em um PostgreSQL descartável, e a aplicação respondeu ao endpoint de saúde conectada a esse banco. Essa validação não substitui a homologação na VPS nem o teste de restauração do backup real.

1. Disponibilizar o código em /opt/hub-turismo, com usuário de serviço sem privilégios.
2. Executar npm ci e npm run setup.
3. Ajustar .env.local: SITE_URL=https://seu-dominio, DATABASE_PATH=/var/lib/hub-turismo/hub.sqlite, ADMIN_EMAILS=rogerio1kg@gmail.com. Manter o segredo gerado ou provisionar segredo aleatório com ao menos 32 caracteres. Criar um widget Cloudflare Turnstile para o domínio e definir TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY; login e cadastro ficam bloqueados em produção sem as duas chaves.

Em desenvolvimento (`npm run dev`), quando as duas chaves estiverem vazias, a aplicação usa credenciais públicas de teste do Turnstile. Elas aprovam o desafio sem verificar se a pessoa é um robô. Para validação real, informe chaves próprias do domínio. O servidor verifica cada token com a chave secreta; não coloque essa chave no navegador.

4. Criar o diretório de dados com acesso somente ao usuário do serviço.
5. Se usar o Nginx fornecido, definir TRUST_PROXY_IP_HEADER=x-real-ip. O proxy deve sobrescrever o cabeçalho; não aceitar x-forwarded-for enviado diretamente pelo visitante. O Node permanece vinculado a 127.0.0.1.
6. Executar npm run db:migrate e npm run admin:create. Definir senha forte no terminal. A migração cria a tabela JWKS usada para guardar as chaves do JWT; mantenha o banco em armazenamento persistente.
7. Executar verificações e npm run build. SITE_URL deve estar correta no ambiente do serviço porque os metadados canônicos, links absolutos e sitemap usam essa origem; o sitemap é gerado dinamicamente a partir do banco.
8. Configurar serviço a partir de infra/hub-turismo.service e proxy TLS a partir de infra/nginx.conf, substituindo domínio e caminhos de certificado. Certificados não são fornecidos.
9. Iniciar o serviço. Testar página pública, envio de contato, login, logout e bloqueio de /api/admin/contatos sem sessão. API anônima deve responder 401.

O comando npm start mantém o Node em loopback na porta 3005. O proxy publica a porta HTTPS. O exemplo não instala pacotes de sistema nem configura domínio automaticamente.

A confirmação de e-mail, o reenvio do link e a recuperação de senha estão disponíveis quando SMTP é configurado. Nenhum provedor nem credencial SMTP foi configurado nesta entrega, então esses fluxos ainda precisam de homologação no ambiente real. Antes de abrir os painéis empresariais na internet, validar a matriz de permissões, a associação explícita das contas de guia e os fluxos de reserva com as empresas. Consulte [PLATAFORMA.md](PLATAFORMA.md) para os limites funcionais, incluindo o registro local de estadia sem integração oficial de FNRH.

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

Fazer backup antes da migração. Atualizar `package.json` e `APP_VERSION` em `infra/vps.env` para a mesma versão nova; o preflight recusa divergência. Parar o serviço para alterações de esquema, construir a imagem com `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml build web`, aplicar migrações e reiniciar. Verifique `/api/health`: exija HTTP 200, `status: "ok"`, `database: "postgresql"` e `version` correspondente à release pretendida. Cada versão fica em uma etiqueta própria e a imagem anterior deve ser preservada. Depois de corrigir uma falha terminal, reabra as entregas com `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml run --rm --no-deps booking-email-worker node --experimental-strip-types scripts/retry-failed-booking-email.ts --confirm`.

Se houver falha de aplicação e o schema continuar compatível, volte `APP_VERSION` à versão anterior em `infra/vps.env` e execute `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml up -d --no-build web booking-email-worker`. Se o schema não for compatível, restaure o dump em um banco separado e só então aponte a versão anterior para esse banco. Não execute versões antigas sobre esquema incompatível. Ao retornar da 0.12.0 para a 0.11.0, mantenha a tabela 022 e os demais dados do schema; a versão anterior a ignora e deixa de gerar lembretes. As versões 0.10.0 e 0.9.0 não alteram o schema; o retorno ao binário 0.9.0 mantém o heartbeat e apenas remove a atualização automática do painel. Versões 0.8.0 ou anteriores podem ignorar as tabelas 021 e 022, que devem permanecer no banco.

## Transição do site atual

O endereço chatgpt.site e o login delegado do Sites não são transferidos automaticamente. A nova publicação recebe o endereço fornecido pelo provedor ou domínio próprio. Preservar o site atual até validar a nova instalação.

Caso existam mensagens na produção, planejar exportação e importação de contacts com todos os campos de consentimento, idempotência e datas, comparar contagens e impedir perdas durante a troca. Este procedimento depende dos dados reais e ainda não foi executado. Não importar cookies ou sessões da plataforma.

Atualizar aviso de privacidade com provedor/localização e canais empresariais confirmados antes da publicação. Não inventar informações.

## CI/CD

O workflow verifica o projeto em GitHub Actions, incluindo sintaxe dos scripts operacionais, validação da interpolação do Compose com valores de exemplo e build da imagem VPS sem publicação em registry; o serviço PostgreSQL de CI usa a mesma versão menor fixada pelo Compose. A publicação atual foi manual na VPS; ainda não há CD ou credenciais de deploy no GitHub. Automatize a publicação somente depois de validar o backup PostgreSQL e o retorno para uma versão anterior.
