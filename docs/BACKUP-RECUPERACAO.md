# Backup externo e recuperação

Este procedimento prepara uma cópia do backup PostgreSQL local da VPS para uma pasta sincronizada escolhida pelo operador e comprova a restauração de um novo download em um banco isolado. Ele não configura uma conta Drive/OneDrive, não usa APIs ou credenciais de nuvem, não muda o banco de produção e não publica releases.

## Preparar a cópia

1. Quando houver uma pasta privada sincronizada disponível, confirme que o SSH configurado continua funcionando com ssh hub-turismo-vps "id". A conta deve ser hub.
2. No PowerShell aberto na raiz do repositório, rode:

        .\infra\export-vps-backup-to-sync.ps1 -SyncDirectory 'C:\caminho\da\pasta\sincronizada'

3. O script baixa o dump mais recente e seu manifesto .sha256 da VPS, confirma o SHA-256 na origem e na estação e publica ambos em uma nova subpasta da pasta escolhida. O recibo independente fica em tmp\offsite-backup-receipts\, fora da pasta sincronizada. Destinos e recibos existentes não são sobrescritos.
4. Aguarde o cliente Drive/OneDrive indicar que os arquivos foram sincronizados. A mensagem SYNC_CONFIRMATION_REQUIRED é um checkpoint, não uma confirmação automática do serviço.

O dump contém dados de produção, inclusive dados pessoais. Use somente uma pasta privada sob controle do operador e não envie esses arquivos por mensagem.

## Baixar e ensaiar a recuperação

1. Pelo portal web do serviço escolhido, baixe o dump e o arquivo .sha256 para um diretório local separado da pasta sincronizada. Mantenha o nome original de ambos.
2. Revise que o portal mostra a sincronização concluída. Execute `infra/verify-vps-offsite-backup.ps1` no PowerShell, informando o caminho da cópia recém-baixada, a mesma pasta sincronizada usada na exportação e o recibo da etapa anterior. O verificador recusa cópias ou recibos que ainda estejam dentro da pasta sincronizada:

        .\infra\verify-vps-offsite-backup.ps1 -DownloadedBackupPath 'C:\caminho\Downloads\hub-AAAA...dump' -SyncDirectory 'C:\caminho\da\pasta\sincronizada' -ReceiptPath '.\tmp\offsite-backup-receipts\hub-AAAA...dump.json' -ConfirmFreshDownload

3. O verificador compara os bytes baixados com o SHA-256 do recibo independente e do manifesto. Depois envia a cópia a um staging único em /var/tmp, valida o formato PostgreSQL pelo restorer existente e restaura para um banco temporário novo hub_restore_offsite_....
4. O script consulta somente as contagens agregadas de usuários, reservas, lembretes e entradas Cadastur. Depois remove somente o banco temporário que criou e os arquivos do próprio staging. Confira no resultado RESTORE_DATABASE_CLEANUP=ok, REMOTE_STAGING_CLEANUP=ok e as quatro contagens. Se a limpeza do banco falhar, a saída identifica o nome do banco temporário para revisão; não remova outro banco.
5. Guarde como evidência o nome e tamanho do dump, o SHA-256, o horário, as contagens agregadas e o resultado da limpeza. Não registre nomes de pessoas, dados de reservas, credenciais ou conteúdo de vps.env.

Se a cópia nova, o sidecar, o recibo ou o indicador de sincronização não estiver disponível, interrompa o procedimento e mantenha BACK-01 pendente. Não considere o arquivo local na pasta sincronizada como prova de cópia externa e não publique uma release até o ensaio independente passar.

## Limites de segurança

- O backup diário e sua retenção local na VPS permanecem sob o mecanismo atual.
- Nenhum arquivo em infra/vps.env é lido pelo computador local ou impresso nos relatórios.
- A restauração recusa o banco de produção e qualquer destino já existente.
- Falhas preservam o dump externo e limitam a limpeza aos arquivos e ao banco identificados pela execução.
- A origem histórica data/hub.sqlite não participa deste fluxo.
