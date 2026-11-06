# Backup local e recuperação

Este fluxo copia o dump PostgreSQL da VPS para uma pasta protegida neste computador usando SSH. O SHA-256 é comparado na origem e na cópia local; em seguida, a cópia é enviada a uma área temporária da VPS e restaurada em um banco isolado. Nenhum dado de produção é alterado pelo ensaio. A pasta padrão é `%LOCALAPPDATA%\HubTurismo\Backups`; recibos independentes ficam em `%LOCALAPPDATA%\HubTurismo\BackupReceipts`. O backup não é enviado a Drive, OneDrive ou outro serviço.

## Copiar da VPS para este computador

1. Confirme o alias SSH e a conta operacional:

        ssh hub-turismo-vps "id"

   A saída deve identificar a conta `hub`.
2. No PowerShell, na raiz do repositório, execute:

        .\infra\export-vps-backup-to-local.ps1

   Para escolher outra pasta local, defina `$backupRoot = 'D:\HubBackups'` e use `-BackupDirectory $backupRoot` nos dois scripts. A pasta não pode ficar dentro do repositório ou da área temporária do Windows.
3. O script localiza o conjunto mais recente de quatro arquivos na VPS (dump, manifesto, recibo de origem e manifesto do recibo), verifica os SHA-256 na origem, baixa cada arquivo por SCP e confere novamente os hashes. Ele publica cada cópia em uma pasta nova, protege as permissões locais para a conta atual, SYSTEM e administradores, e recusa sobrescrever um destino ou recibo existente. Guarde os marcadores `LOCAL_BACKUP_FILE`, `RECEIPT_FILE`, `LOCAL_SOURCE_RECEIPT_FILE` e `LOCAL_SOURCE_RECEIPT_SHA256` exibidos.

O dump contém dados de produção, inclusive dados pessoais. Mantenha a cópia e o computador protegidos e não envie esses arquivos por mensagem.

## Ensaiar a restauração isolada

Execute o fluxo suportado no mesmo PowerShell. Ele encadeia exportação e verificação e exige os dois valores da atestação da candidata que será ativada:

        $backupRoot = Join-Path $env:LOCALAPPDATA 'HubTurismo\Backups'
        $candidateAttestationPath = '/opt/hub-turismo/attestations/candidate-X.Y.Z.env'
        $candidateAttestationSha256 = '...SHA-256 de 64 caracteres da atestação candidata...'
        .\infra\prepare-and-verify-vps-backup.ps1 `
          -BackupDirectory $backupRoot `
          -CandidateAttestationPath $candidateAttestationPath `
          -CandidateAttestationSha256 $candidateAttestationSha256 `
          -ConfirmLocalBackup

O fluxo usa os caminhos de dump, recibo independente e recibo de origem retornados pela exportação; não os substitua manualmente. Ele exige que o dump esteja na pasta local protegida, compara os SHA-256 do dump e do recibo de origem com os manifestos e o recibo independente, envia a cópia a um staging único em `/var/tmp` por SSH e usa `infra/restore-postgres.sh` para restaurar em um banco temporário novo `hub_restore_local_...`. O staging e o banco temporário são removidos ao final.

Para concluir, devem aparecer `LOCAL_BACKUP_VERIFICATION=passed`, `RESTORE_SOURCE_COMPARISON=match`, `RESTORE_DATABASE_CLEANUP=ok`, `REMOTE_STAGING_CLEANUP=ok`, `BACKUP_ATTESTATION_REMOTE_PATH`, `BACKUP_ATTESTATION_SHA256` e `BACKUP_ATTESTATION_EXPIRES_AT_UTC`. A comparação só passa com paridade exata entre o mapa canônico completo de contagens da fonte e da restauração, e com o mesmo `SOURCE_LEDGER_SHA256`; não reduza essa conferência a uma lista fixa de tabelas. Guarde o nome do dump, SHA-256, mapa/ledger verificados e resultado agregado; não registre nomes de pessoas, detalhes de reservas, credenciais ou conteúdo de `vps.env`.

Se o SSH, o hash, o restore ou a limpeza falhar, mantenha os arquivos locais e interrompa qualquer limpeza de dados ou publicação. Esta cópia protege contra perda apenas da VPS enquanto o arquivo permanecer íntegro neste computador; mantenha também a retenção diária já configurada na VPS.

## Evidência para ativação

Depois do ensaio íntegro, guarde os marcadores `BACKUP_ATTESTATION_REMOTE_PATH`, `BACKUP_ATTESTATION_SHA256` e `BACKUP_ATTESTATION_EXPIRES_AT_UTC` do mesmo run, junto de `CandidateAttestationPath` e `CandidateAttestationSha256` usados no comando. A ativação requer esses argumentos, comprova a comparação fonte/restauração e as limpezas, e recusa atestado expirado ou ligado a outra candidata. Não reutilize evidência de uma release anterior.

## Limites de segurança

- O backup diário e sua retenção local na VPS permanecem sob o mecanismo atual.
- Nenhum arquivo em `infra/vps.env` é lido pelo computador local ou impresso nos relatórios.
- O ensaio restaura somente em um banco novo, nunca em produção.
- Falhas preservam o dump local e limitam a limpeza aos arquivos e ao banco identificados pela execução.
- A origem histórica `data/hub.sqlite` não participa deste fluxo.
- Publicações futuras continuam sendo construídas e ativadas na VPS por SSH; não se inicia Docker na estação local.
