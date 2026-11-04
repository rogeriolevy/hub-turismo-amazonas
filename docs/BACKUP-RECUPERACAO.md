# Backup local e recuperação

Este fluxo copia o dump PostgreSQL da VPS para uma pasta protegida neste computador usando SSH. O SHA-256 é comparado na origem e na cópia local; em seguida, a cópia é enviada a uma área temporária da VPS e restaurada em um banco isolado. Nenhum dado de produção é alterado pelo ensaio. A pasta padrão é `%LOCALAPPDATA%\HubTurismo\Backups`; recibos independentes ficam em `%LOCALAPPDATA%\HubTurismo\BackupReceipts`. O backup não é enviado a Drive, OneDrive ou outro serviço.

## Copiar da VPS para este computador

1. Confirme o alias SSH e a conta operacional:

        ssh hub-turismo-vps "id"

   A saída deve identificar a conta `hub`.
2. No PowerShell, na raiz do repositório, execute:

        .\infra\export-vps-backup-to-local.ps1

   Para escolher outra pasta local, defina `$backupRoot = 'D:\HubBackups'` e use `-BackupDirectory $backupRoot` nos dois scripts. A pasta não pode ficar dentro do repositório ou da área temporária do Windows.
3. O script localiza o dump mais recente na VPS, verifica o manifesto SHA-256, baixa o dump e o manifesto por SCP e confere novamente o hash. Ele publica cada cópia em uma pasta nova, protege as permissões locais para a conta atual, SYSTEM e administradores, e recusa sobrescrever um destino ou recibo existente. Guarde os caminhos `LOCAL_BACKUP_FILE` e `RECEIPT_FILE` exibidos.

O dump contém dados de produção, inclusive dados pessoais. Mantenha a cópia e o computador protegidos e não envie esses arquivos por mensagem.

## Ensaiar a restauração isolada

Execute no mesmo PowerShell, usando os caminhos retornados pela exportação:

        $backupRoot = Join-Path $env:LOCALAPPDATA 'HubTurismo\Backups'
        $dump = Join-Path $backupRoot 'hub-AAAA...\hub-AAAA...dump'
        $receipt = Join-Path $env:LOCALAPPDATA 'HubTurismo\BackupReceipts\hub-AAAA...dump.json'
        .\infra\verify-vps-local-backup.ps1 -DownloadedBackupPath $dump -ReceiptPath $receipt -BackupDirectory $backupRoot -ConfirmLocalBackup

O verificador exige que o dump esteja na pasta local protegida, compara o SHA-256 do arquivo com o manifesto `.sha256` e o recibo independente, envia a cópia a um staging único em `/var/tmp` por SSH e usa `infra/restore-postgres.sh` para restaurar em um banco temporário novo `hub_restore_local_...`. O staging e o banco temporário são removidos ao final.

Revise no resultado as contagens agregadas de usuários, reservas, lembretes e entradas Cadastur. Para concluir, devem aparecer `LOCAL_BACKUP_VERIFICATION=passed`, `RESTORE_DATABASE_CLEANUP=ok`, `REMOTE_STAGING_CLEANUP=ok` e as quatro contagens. Guarde o nome do dump, SHA-256 e resultado agregado; não registre nomes de pessoas, detalhes de reservas, credenciais ou conteúdo de `vps.env`.

Se o SSH, o hash, o restore ou a limpeza falhar, mantenha os arquivos locais e interrompa qualquer limpeza de dados ou publicação. Esta cópia protege contra perda apenas da VPS enquanto o arquivo permanecer íntegro neste computador; mantenha também a retenção diária já configurada na VPS.

## Limites de segurança

- O backup diário e sua retenção local na VPS permanecem sob o mecanismo atual.
- Nenhum arquivo em `infra/vps.env` é lido pelo computador local ou impresso nos relatórios.
- O ensaio restaura somente em um banco novo, nunca em produção.
- Falhas preservam o dump local e limitam a limpeza aos arquivos e ao banco identificados pela execução.
- A origem histórica `data/hub.sqlite` não participa deste fluxo.
- Publicações futuras continuam sendo construídas e ativadas na VPS por SSH; não se inicia Docker na estação local.
