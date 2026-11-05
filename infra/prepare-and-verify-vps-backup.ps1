[CmdletBinding()]
param(
  [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA "HubTurismo\Backups"),
  [switch]$ConfirmLocalBackup
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmLocalBackup) {
  throw "Confirme que a cópia PostgreSQL será armazenada neste computador acrescentando -ConfirmLocalBackup."
}

$exportScript = Join-Path $PSScriptRoot "export-vps-backup-to-local.ps1"
$verifyScript = Join-Path $PSScriptRoot "verify-vps-local-backup.ps1"
foreach ($scriptPath in @($exportScript, $verifyScript)) {
  if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "Script operacional obrigatório ausente: $scriptPath"
  }
}

try {
  $exportOutput = @(& $exportScript -BackupDirectory $BackupDirectory 2>&1)
} catch {
  throw "A exportação do backup local falhou; a verificação e a ativação foram interrompidas. $($_.Exception.Message)"
}

$exportLines = @(
  $exportOutput | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) {
      $_.ToString()
    } else {
      [string]$_
    }
  }
)
$backupMarkers = @($exportLines | Where-Object { $_ -cmatch '^LOCAL_BACKUP_FILE=' })
$receiptMarkers = @($exportLines | Where-Object { $_ -cmatch '^RECEIPT_FILE=' })
if ($backupMarkers.Count -ne 1 -or $receiptMarkers.Count -ne 1) {
  throw "A exportação não retornou exatamente um caminho para o backup e um para o recibo; a verificação e a ativação foram interrompidas."
}

$downloadedBackupPath = $backupMarkers[0].Substring("LOCAL_BACKUP_FILE=".Length)
$receiptPath = $receiptMarkers[0].Substring("RECEIPT_FILE=".Length)
if ([string]::IsNullOrWhiteSpace($downloadedBackupPath) -or
    -not (Test-Path -LiteralPath $downloadedBackupPath -PathType Leaf)) {
  throw "O arquivo de backup indicado pela exportação não existe; a verificação e a ativação foram interrompidas."
}
if ([string]::IsNullOrWhiteSpace($receiptPath) -or
    -not (Test-Path -LiteralPath $receiptPath -PathType Leaf)) {
  throw "O recibo independente indicado pela exportação não existe; a verificação e a ativação foram interrompidas."
}

# A exportação imprime somente metadados e caminhos; o dump nunca é lido para a saída.
$exportLines | ForEach-Object { Write-Output $_ }

& $verifyScript `
  -DownloadedBackupPath $downloadedBackupPath `
  -ReceiptPath $receiptPath `
  -BackupDirectory $BackupDirectory `
  -ConfirmLocalBackup
