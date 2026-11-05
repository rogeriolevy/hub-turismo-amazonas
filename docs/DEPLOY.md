# Publicação da versão Node.js

## Estado publicado

A versão 0.12.16 está publicada na VPS com Docker Compose, PostgreSQL e Nginx em `https://hubamazonas.vps12233.panel.icontainer.site`. Em 05/11/2026, `/api/health` respondeu HTTP 200 com `status=ok`, `version=0.12.16` e `database=postgresql`; web, worker e PostgreSQL estão saudáveis. `/opt/hub-turismo/current` aponta para `/opt/hub-turismo/release-0.12.16`. A release 0.12.15 permanece disponível para retorno. Os detalhes de backup, snapshot, imagem, contagens, migrations e retorno estão na [nota da release 0.12.16](releases/0.12.16.md).

Na verificação pública da 0.12.16, `/plataforma` responde HTTP 200 e sua navegação principal lista os seis módulos sem “Início”; `/hospedagens` mostra “Início” antes dos módulos. `/contato` responde HTTP 200, informa que o telefone e e-mail de demonstração são fictícios, mantém o formulário e não transforma os dados em links de chamada, WhatsApp ou e-mail. Os links institucionais “Sobre a Hub” e “Contato” não aparecem na plataforma. A navegação pública `/navegacao` renderiza os quadros Maués → Parintins e Parintins → Maués transcritos da imagem; campos vazios aparecem como “Não informado”.

Uma consulta agregada read-only na produção confirmou `cadastur_maues=42`, `cadastur_outside=0`, `cadastur_linked_outside=0`, `guides_outside_or_unknown=0`, `companies_outside=0`, `catalog_outside=0` e `tours_outside=0`. As seis importações Cadastur históricas permanecem committed e sem payload. Nenhum nome ou contato foi incluído nessa verificação. O worker tinha heartbeat de 5 segundos na verificação pós-publicação.

Antes da ativação 0.12.16, o dump `hub-20261105T224215Z-2923292.dump` foi copiado por SSH para a pasta local protegida, validado por SHA-256 e restaurado em banco isolado. O checksum é `cb4f67ab1ea947712162df4521d8c2a0c124cdbfc0008b5d8cae4dfbfbee01b6`; a restauração confirmou `users=2`, `bookings=0`, `booking_reminders=0` e `cadastur_entries=42`, e limpou banco e staging temporários. A cópia fica em `%LOCALAPPDATA%\HubTurismo\Backups`; o recibo independente fica em `%LOCALAPPDATA%\HubTurismo\BackupReceipts`. Consulte o [runbook de backup local e recuperação](BACKUP-RECUPERACAO.md).

A 0.12.16 foi construída exclusivamente no Docker da VPS a partir do snapshot ancorado ao commit `8ea8b23352705d7f813c5f4f4d80f48d6988051d`, árvore `f6b6865a58945990121fb7fbd4777e13b86dadfb`, cujo ZIP SHA-256 é `ae086a80fb503a87d79a902691bdfc4bd381f847afc63e3308144435847b27cb`. O digest da imagem é `sha256:848c7fdac5410a245efb1eeed742926f9a71a5df60ece3aabca7ae8b2e336f65`. PostgreSQL, volume, dados e as migrations permaneceram iguais; a importação SQLite→PostgreSQL não foi repetida. A release 0.12.15 e sua imagem continuam disponíveis para retorno. Consulte também a [baseline de proveniência](../.planning/phases/01-baseline-e-candidata/01-BASELINE.md), o [registro da versão 0.12.15](releases/0.12.15.md) e a [nota da versão 0.12.16](releases/0.12.16.md).

O serviço Sites existente permanece independente da VPS. A origem oficial foi confirmada e validada em uma transferência descartável antes da publicação. Consulte também [USO-LOCAL.md](USO-LOCAL.md) para continuar usando a instalação local.

Para copiar o backup da VPS para este computador por SSH e ensaiar a restauração isolada, consulte o [runbook de backup local e recuperação](BACKUP-RECUPERACAO.md). A exportação sozinha não libera publicação; checksum, ensaio e preflight continuam obrigatórios.

## Operação da release 0.12.16

O proxy e o PostgreSQL não foram incluídos na atualização. O guard trocou `current` atomicamente e recriou somente `web` e `booking-email-worker` com `--no-deps --no-build`. A verificação comparou o mesmo container/volume PostgreSQL, ledger de migrations e contagens agregadas antes e depois. O rollback não foi acionado; a release 0.12.15 continua disponível. A nota da [release 0.12.16](releases/0.12.16.md) contém o resultado observado.

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

Antes de reconstruir ou transferir o código, gere um snapshot de fontes v4 com `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\package-source-snapshot.ps1`. O ZIP e o sidecar `.sha256` ficam em `tmp/`; o manifesto registra a versão, o commit, a árvore Git e o hash/blob Git de cada arquivo incluído. O empacotador ignora dados SQLite, backups, uploads, segredos locais, chaves privadas, dependências e arquivos temporários. Esse pacote preserva o código para reconstrução; não substitui o backup do banco nem o histórico Git. Para a proveniência aprovada, não use `infra/package-vps-release-bundle.ps1`: esse wrapper faz build/export local e não é o fluxo desta entrega, que valida fontes e constrói a imagem somente na VPS.

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
release=/opt/hub-turismo/release-0.12.12
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

### Proveniência de fontes antes do build remoto

Para gerar uma candidata a partir do repositório local, execute `infra/package-source-snapshot.ps1` depois de aprovar e commitar as fontes. O gerador seleciona arquivos da árvore do commit (`git archive`), compara cada cópia de trabalho diretamente com o blob Git esperado (inclusive quando o índice marca `assume-unchanged`/`skip-worktree`), recusa fontes não rastreadas e gera o manifesto v4 com commit, prova das entradas da árvore e blob por arquivo. Fixe fora do pacote `GitHead`, `GitTree` e `VerifierSha256` diretamente da saída local. O verificador remoto reconstrói os objetos tree e exige que o hash da raiz corresponda à árvore aprovada; assim, trocar ZIP e manifesto juntos não basta para mudar uma fonte.

Transfira para a pasta de staging da VPS o ZIP de fontes, `SOURCE-MANIFEST.json`, o sidecar `<arquivo.zip>.sha256` e o verificador `source/scripts/verify-vps-source-snapshot.mjs`. Não obtenha o hash do verificador do pacote transferido. Antes da validação, confira no host o hash do ZIP e compare o arquivo staged do verificador com o `VerifierSha256` fixado localmente. Execute o verificador v4 dentro da imagem aprovada 0.12.13 da própria VPS, em container sem rede e com staging, verificador e dependências auxiliares somente leitura. Monte o verificador em `/app/scripts/verify-vps-source-snapshot.mjs` para que a resolução do módulo use `/app/node_modules`. Confirme os arquivos de entrada reais de cada dependência; diretórios ou `package.json` parciais não bastam, e `import.meta.resolve()` pode retornar uma URL mesmo quando o arquivo está ausente.

Se a imagem aprovada não incluir `unzipper-esm` ou qualquer arquivo de entrada de uma dependência necessária, pare antes de extrair fontes. Obtenha localmente o tarball de cada pacote e versão exatos registrados em `package-lock.json` com `npm pack --ignore-scripts`, compare o SRI SHA-512 de cada tarball ao campo `integrity` do lockfile e transfira-os separadamente. Confira os mesmos SHA-512 na VPS, valide os caminhos e metadados dos pacotes, extraia-os em diretórios dedicados de staging e monte cada diretório no respectivo caminho `/app/node_modules/<pacote>` como somente leitura. Confirme que todos os imports exigidos pelo verificador estão resolvidos antes da validação v4. Não instale dependências nem altere a imagem aprovada. Exemplo, após preencher os valores coletados localmente e preparar os três pacotes nesta pasta de staging:

```bash
APPROVED_GIT_HEAD=COMMIT_REGISTRADO_PELO_GERADOR
APPROVED_GIT_TREE=ARVORE_REGISTRADA_PELO_GERADOR
APPROVED_VERIFIER_SHA256=HASH_DO_VERIFICADOR_REGISTRADO_LOCALMENTE
VERIFIER_IMAGE=hub-turismo-amazonas:0.12.13
VERIFIER_FILE=verify-vps-source-snapshot.mjs
VERIFIER_UNZIPPER_DIR=unzipper-esm-package
VERIFIER_GRACEFUL_FS_DIR=graceful-fs-package
VERIFIER_NODE_INT64_DIR=node-int64-package
SOURCE_ZIP=hub-turismo-amazonas-0.12.14-source.zip
SOURCE_MANIFEST=SOURCE-MANIFEST.json

printf '%s  %s\n' "$APPROVED_VERIFIER_SHA256" "$VERIFIER_FILE" | sha256sum --check --status || {
  echo 'O verificador staged não corresponde ao hash aprovado localmente.' >&2
  exit 1
}

docker run --pull=never --rm --network none --read-only \
  --mount "type=bind,src=$PWD,dst=/app/tmp/release-audit,readonly" \
  --mount "type=bind,src=$PWD/$VERIFIER_FILE,dst=/app/scripts/verify-vps-source-snapshot.mjs,readonly" \
  --mount "type=bind,src=$PWD/$VERIFIER_UNZIPPER_DIR,dst=/app/node_modules/unzipper-esm,readonly" \
  --mount "type=bind,src=$PWD/$VERIFIER_GRACEFUL_FS_DIR,dst=/app/node_modules/graceful-fs,readonly" \
  --mount "type=bind,src=$PWD/$VERIFIER_NODE_INT64_DIR,dst=/app/node_modules/node-int64,readonly" \
  --entrypoint node "$VERIFIER_IMAGE" \
  /app/scripts/verify-vps-source-snapshot.mjs \
  "/app/tmp/release-audit/$SOURCE_ZIP" \
  "/app/tmp/release-audit/$SOURCE_MANIFEST" \
  "$APPROVED_GIT_HEAD" "$APPROVED_GIT_TREE" --self-check
```

O `sha256sum` do host confere o ZIP e a cópia do verificador contra os hashes fixados localmente e passados separadamente do pacote; o programa validado então confere commit/árvore esperados, cada blob Git, SHA-256, manifesto e conjunto completo de entradas. Só extraia depois de aprovação. Para candidatas comuns sem alteração de schema, extraia na pasta versionada e construa `web` na VPS com o Compose e `infra/vps.env` daquela release. Não rode build/export na estação de trabalho, não instale dependências a partir de fontes ainda não verificadas e não ative durante a preparação da candidata.

Antes de ativar cada release, conclua e registre os seguintes gates, nesta ordem:

1. **Defina uma entrega delimitada por domínio.** Selecione um plano GSD pequeno com IDs de requisitos, critérios de sucesso e evidências de verificação. Não inicie um módulo funcional sem necessidade real, fonte datada e escopo compatível com os limites descritos em `docs/ARQUITETURA-EVOLUTIVA.md`.
2. **Prepare o schema de forma aditiva.** Se houver mudança, adicione uma nova migration numerada. Mantenha SQL compartilhado em `db/migrations/` somente quando compatível com SQLite e PostgreSQL; use `db/postgres-migrations/` quando a migration depender do PostgreSQL. Nunca edite, renomeie ou remova SQL já aplicado; correções entram em outro arquivo numerado. Para releases sem mudança de schema, registre que nenhuma migration foi adicionada.
3. **Execute a proteção de imutabilidade antes de publicar.** Rode `npm run check:migration-immutability -- --base-ref <revisao-base>` com a revisão-base apropriada para a mudança e confirme sucesso. Esse guard offline compara os arquivos SQL existentes com a base; adições novas são permitidas.
4. **Proteja e ensaie o backup antes da ativação por SSH.** Gere/obtenha a cópia PostgreSQL protegida fora da VPS e armazene-a localmente fora do repositório. Confira de forma independente o SHA-256 do conteúdo contra o recibo e o manifesto. Execute `infra/verify-vps-local-backup.ps1` com os caminhos locais e a confirmação exigida para conferir a cópia e ensaiar a restauração em um banco isolado; revise as contagens agregadas e confirme a limpeza do banco temporário. Não prossiga se a cópia, o hash ou a restauração falhar.
5. **Decida a compatibilidade antes da troca.** Verifique se o código da versão anterior suporta o schema resultante. Se não suportar, deixe preparado o caminho para restaurar o backup em um banco separado e aponte a versão anterior somente para esse banco. Não teste essa incompatibilidade em produção.
6. **Ative somente a candidata verificada.** Atualize `package.json` e `APP_VERSION` em `infra/vps.env` para a mesma versão; o preflight recusa divergência. Use o snapshot de fontes e a proveniência documentados acima, transfira os artefatos por SSH e valide-os antes do build remoto. Preserve a imagem anterior. Para alterações de schema, pare os serviços web/worker conforme o procedimento operacional existente, construa a imagem aprovada com `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml build web`, aplique migrations e reinicie apenas os serviços previstos, preservando PostgreSQL e seu volume. Não reimporte SQLite.
7. **Confirme a operação e registre os fatos.** Verifique `/api/health` com HTTP 200, `status: "ok"`, `database: "postgresql"` e `version` correspondente à release pretendida. Confira o heartbeat recente do worker, o ledger de migrations e as contagens de dados agregadas antes/depois. Registre os resultados observados, a proveniência da imagem, a versão anterior preservada e o estado do rollback em `docs/releases/README.md`; nunca copie fatos de uma release anterior.

Cada versão fica em uma etiqueta própria e a imagem anterior deve ser preservada. Releases comuns não alteram migrations aplicadas nem modificam ou reimportam a origem oficial `data/hub.sqlite`. Depois de corrigir uma falha terminal, reabra as entregas com `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml run --rm --no-deps booking-email-worker node --experimental-strip-types scripts/retry-failed-booking-email.ts --confirm`.

Se houver falha de aplicação, primeiro confirme a compatibilidade do código anterior com o schema atual. **Somente se for compatível**, volte `APP_VERSION` à versão anterior em `infra/vps.env` e execute `docker compose -p hub-turismo --env-file infra/vps.env -f infra/compose.vps.yaml up -d --no-build web booking-email-worker`. Se o schema não for compatível, restaure o dump em um banco separado e só então aponte a versão anterior para esse banco por uma troca controlada; não direcione código antigo ao schema atual incompatível. Ao retornar da 0.12.0 para a 0.11.0, mantenha a tabela 022 e os demais dados do schema; a versão anterior a ignora e deixa de gerar lembretes. As versões 0.10.0 e 0.9.0 não alteram o schema; o retorno ao binário 0.9.0 mantém o heartbeat e apenas remove a atualização automática do painel. Versões 0.8.0 ou anteriores podem ignorar as tabelas 021 e 022, que devem permanecer no banco.

## Transição do site atual

O endereço chatgpt.site e o login delegado do Sites não são transferidos automaticamente. A nova publicação recebe o endereço fornecido pelo provedor ou domínio próprio. Preservar o site atual até validar a nova instalação.

Caso existam mensagens na produção, planejar exportação e importação de contacts com todos os campos de consentimento, idempotência e datas, comparar contagens e impedir perdas durante a troca. Este procedimento depende dos dados reais e ainda não foi executado. Não importar cookies ou sessões da plataforma.

Atualizar aviso de privacidade com provedor/localização e canais empresariais confirmados antes da publicação. Não inventar informações.

## CI/CD

O workflow verifica o projeto em GitHub Actions, incluindo sintaxe dos scripts operacionais, validação da interpolação do Compose com valores de exemplo e build da imagem VPS sem publicação em registry; o serviço PostgreSQL de CI usa a mesma versão menor fixada pelo Compose. A publicação atual foi manual na VPS; ainda não há CD ou credenciais de deploy no GitHub. Automatize a publicação somente depois de validar o backup PostgreSQL e o retorno para uma versão anterior.
