[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DownloadedBackupPath,
  [Parameter(Mandatory = $true)]
  [string]$ReceiptPath,
  [switch]$ConfirmFreshDownload
)

$ErrorActionPreference = "Stop"
$sshAlias = "hub-turismo-vps"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$receiptDirectory = Join-Path $repositoryRoot "tmp\offsite-backup-receipts"
$temporaryRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$scp = (Get-Command scp.exe -ErrorAction Stop).Source

if (-not $ConfirmFreshDownload) {
  throw "Confirme o download novo pelo portal acrescentando -ConfirmFreshDownload. Um arquivo na pasta sincronizada não comprova a recuperação externa."
}
if (-not (Test-Path -LiteralPath $DownloadedBackupPath -PathType Leaf)) {
  throw "A cópia recém-baixada não foi encontrada: $DownloadedBackupPath"
}
if (-not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
  throw "O recibo local de origem não foi encontrado: $ReceiptPath"
}
$downloadedBackup = (Resolve-Path -LiteralPath $DownloadedBackupPath -ErrorAction Stop).Path
$receiptFile = (Resolve-Path -LiteralPath $ReceiptPath -ErrorAction Stop).Path
$receiptRoot = (Resolve-Path -LiteralPath $receiptDirectory -ErrorAction Stop).Path.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
if (-not $receiptFile.StartsWith($receiptRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "O recibo deve estar dentro de $receiptDirectory."
}
$downloadedDirectory = Split-Path -Parent $downloadedBackup
$downloadedName = Split-Path -Leaf $downloadedBackup
$downloadedSidecar = Join-Path $downloadedDirectory ($downloadedName + ".sha256")
if ($downloadedName -notmatch '^hub-\d{8}T\d{6}Z-\d+\.dump$') {
  throw "O nome da cópia baixada não corresponde ao formato de backup Hub esperado."
}
if (-not (Test-Path -LiteralPath $downloadedSidecar -PathType Leaf) -or (Get-Item -LiteralPath $downloadedBackup).Length -lt 1) {
  throw "A cópia baixada precisa ser não vazia e estar acompanhada pelo arquivo .sha256 correspondente."
}

try {
  $receipt = [System.IO.File]::ReadAllText($receiptFile) | ConvertFrom-Json -ErrorAction Stop
} catch {
  throw "O recibo local não contém JSON válido: $receiptFile"
}
if ($receipt.backupFile -cne $downloadedName -or
    $receipt.sourceHostAlias -cne $sshAlias -or
    $receipt.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or
    $receipt.backupTimestampUtc -notmatch '^\d{8}T\d{6}Z$') {
  throw "O recibo não corresponde ao nome, host ou formato de hash da cópia baixada."
}
$downloadedHash = (Get-FileHash -LiteralPath $downloadedBackup -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
$sidecarHash = [System.IO.File]::ReadAllText($downloadedSidecar).Trim()
$receiptHash = ([string]$receipt.sha256).ToLowerInvariant()
if ($downloadedHash -ne $receiptHash -or
    $sidecarHash -notmatch '^[a-fA-F0-9]{64}$' -or
    $sidecarHash.ToLowerInvariant() -ne $receiptHash) {
  throw "A cópia baixada não corresponde ao SHA-256 independente do recibo e do manifesto."
}

function Invoke-OpenSsh {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Description,
    [switch]$CaptureOutput
  )

  $previousPreference = $ErrorActionPreference
  $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
  $ErrorActionPreference = "Continue"
  if ($null -ne $nativePreference) {
    $PSNativeCommandUseErrorActionPreference = $false
  }
  try {
    if ($CaptureOutput) {
      $nativeOutput = @(& $Executable @Arguments)
      $nativeExitCode = $LASTEXITCODE
    } else {
      & $Executable @Arguments
      $nativeExitCode = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $previousPreference
    if ($null -ne $nativePreference) {
      $PSNativeCommandUseErrorActionPreference = $nativePreference.Value
    }
  }

  if ($nativeExitCode -ne 0) {
    throw "$Description terminou com código $nativeExitCode."
  }
  if ($CaptureOutput) {
    return ,$nativeOutput
  }
}

function ConvertTo-RemoteBashCommand {
  param([Parameter(Mandatory = $true)][string]$Script)
  $encodedScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
  return "printf '%s' '$encodedScript' | base64 -d | bash"
}

function Write-NewUtf8File {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $encoding = [System.Text.UTF8Encoding]::new($false)
  $bytes = $encoding.GetBytes($Content)
  $stream = [System.IO.File]::Open(
    $Path,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
  } finally {
    $stream.Dispose()
  }
}

$databaseTimestamp = [DateTime]::UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'", [Globalization.CultureInfo]::InvariantCulture)
$databaseNonce = [guid]::NewGuid().ToString("N").Substring(0, 8)
$restoreDatabase = "hub_restore_offsite_" + $databaseTimestamp + "_" + $databaseNonce
$stageToken = [guid]::NewGuid().ToString("N").Substring(0, 16)
$remoteStage = "/var/tmp/hub-offsite-$stageToken"
$localStage = Join-Path $temporaryRoot ("hub-offsite-verify-" + [guid]::NewGuid().ToString("N"))
$remoteStageCreated = $false
$remoteRestoreStarted = $false
[System.IO.Directory]::CreateDirectory($localStage) | Out-Null

$remoteRestoreScript = @'
set -Eeuo pipefail
stage="/var/tmp/hub-offsite-__STAGE_TOKEN__"
dump_name='__DUMP_NAME__'
restore_database='__DATABASE_NAME__'
expected_hash='__EXPECTED_HASH__'
database_created=0
postgres_container_id=""

if [[ "$(id -un)" != "hub" ]]; then
  echo "O ensaio precisa ser executado pela conta hub." >&2
  exit 1
fi
if [[ "$stage" != "/var/tmp/hub-offsite-__STAGE_TOKEN__" || ! -d "$stage" || -L "$stage" ]]; then
  echo "O staging remoto não corresponde à pasta criada para esta execução." >&2
  exit 1
fi
if [[ ! "$dump_name" =~ ^hub-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ||
      ! "$restore_database" =~ ^hub_restore_offsite_[0-9]{8}T[0-9]{6}Z_[a-f0-9]{8}$ ||
      ! "$expected_hash" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Os identificadores do ensaio estão fora dos formatos permitidos." >&2
  exit 1
fi

cleanup() {
  status=$?
  trap - EXIT
  cleanup_failed=0
  if (( database_created == 1 )); then
    if [[ -z "$postgres_container_id" ]]; then
      postgres_container_id="$(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1 || true)"
    fi
    if [[ -n "$postgres_container_id" ]] &&
       docker exec "$postgres_container_id" sh -ec 'exec dropdb --username "$POSTGRES_USER" --maintenance-db "$POSTGRES_DB" "$1"' sh "$restore_database"; then
      echo "RESTORE_DATABASE_CLEANUP=ok"
      database_created=0
    else
      echo "RESTORE_DATABASE_CLEANUP=failed; identifique e remova somente o banco $restore_database após confirmar sua origem." >&2
      cleanup_failed=1
    fi
  fi
  if [[ -f "$stage/$dump_name" && ! -L "$stage/$dump_name" ]]; then
    rm -f -- "$stage/$dump_name" || cleanup_failed=1
  fi
  if [[ -f "$stage/$dump_name.sha256" && ! -L "$stage/$dump_name.sha256" ]]; then
    rm -f -- "$stage/$dump_name.sha256" || cleanup_failed=1
  fi
  if [[ -f "$stage/restore-offsite.sh" && ! -L "$stage/restore-offsite.sh" ]]; then
    rm -f -- "$stage/restore-offsite.sh" || cleanup_failed=1
  fi
  if ! rmdir -- "$stage"; then
    echo "REMOTE_STAGING_CLEANUP=failed; revise somente $stage." >&2
    cleanup_failed=1
  else
    echo "REMOTE_STAGING_CLEANUP=ok"
  fi
  if (( status == 0 && cleanup_failed != 0 )); then
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT

if [[ ! -f "$stage/$dump_name" || -L "$stage/$dump_name" ||
      ! -s "$stage/$dump_name" || ! -f "$stage/$dump_name.sha256" ||
      -L "$stage/$dump_name.sha256" ]]; then
  echo "O dump ou o manifesto enviado ao staging está ausente, vazio ou inválido." >&2
  exit 1
fi
sidecar_hash="$(tr -d '\r\n' < "$stage/$dump_name.sha256")"
actual_hash="$(sha256sum < "$stage/$dump_name" | awk '{ print $1 }')"
if [[ "$sidecar_hash" != "$expected_hash" || "$actual_hash" != "$expected_hash" ]]; then
  echo "O SHA-256 do arquivo remoto não corresponde ao recibo e ao manifesto." >&2
  exit 1
fi

release_directory="$(readlink -e -- /opt/hub-turismo/current)"
case "$release_directory" in
  /opt/hub-turismo/release-*) ;;
  *) echo "A release ativa do Hub não foi encontrada." >&2; exit 1 ;;
esac
restore_script="$release_directory/infra/restore-postgres.sh"
if [[ ! -f "$restore_script" || -L "$restore_script" ]]; then
  echo "O restorer PostgreSQL da release ativa está ausente ou inválido." >&2
  exit 1
fi

echo "Validando o formato PostgreSQL e restaurando somente em $restore_database."
bash "$restore_script" "$stage/$dump_name" "$restore_database"
database_created=1
postgres_container_id="$(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1)"
if [[ -z "$postgres_container_id" ]]; then
  echo "O container PostgreSQL do Hub não está em execução para a leitura agregada." >&2
  exit 1
fi
restore_sql="$(cat <<'SQL'
SELECT 'users=' || count(*) FROM "user";
SELECT 'bookings=' || count(*) FROM bookings;
SELECT 'booking_reminders=' || count(*) FROM booking_reminders;
SELECT 'cadastur_entries=' || count(*) FROM cadastur_entries;
SQL
)"
restore_counts="$(docker exec "$postgres_container_id" sh -ec \
  'exec psql --username "$HUB_DB_USER" --dbname "$1" --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 --command "$2"' \
  sh "$restore_database" "$restore_sql")"
count_lines=0
while IFS= read -r count_line; do
  if [[ ! "$count_line" =~ ^(users|bookings|booking_reminders|cadastur_entries)=[0-9]+$ ]]; then
    echo "A consulta agregada retornou uma linha fora do formato esperado." >&2
    exit 1
  fi
  count_lines=$((count_lines + 1))
done <<< "$restore_counts"
if [[ "$count_lines" -ne 4 ]]; then
  echo "A consulta agregada não retornou as quatro contagens esperadas." >&2
  exit 1
fi
printf '%s\n' "$restore_counts"
echo "RESTORE_DATABASE=$restore_database"
echo "RESTORE_DATABASE_CLEANUP=pending"
'@
$remoteRestoreScript = $remoteRestoreScript.Replace("__STAGE_TOKEN__", $stageToken)
$remoteRestoreScript = $remoteRestoreScript.Replace("__DUMP_NAME__", $downloadedName)
$remoteRestoreScript = $remoteRestoreScript.Replace("__DATABASE_NAME__", $restoreDatabase)
$remoteRestoreScript = $remoteRestoreScript.Replace("__EXPECTED_HASH__", $receiptHash)
$localRestoreScript = Join-Path $localStage "restore-offsite.sh"

try {
  Write-NewUtf8File -Path $localRestoreScript -Content $remoteRestoreScript
  $createStageScript = @'
set -euo pipefail
if [[ "$(id -un)" != "hub" ]]; then
  echo "A criação de staging precisa usar a conta hub." >&2
  exit 1
fi
mkdir -m 700 -- "/var/tmp/hub-offsite-__STAGE_TOKEN__"
'@
  $createStageScript = $createStageScript.Replace("__STAGE_TOKEN__", $stageToken)
  $createStageCommand = ConvertTo-RemoteBashCommand -Script $createStageScript
  Write-Output "Verificando os arquivos baixados recentemente e o recibo SHA-256 local."
  Write-Output "Confirmação recebida: o dump veio de um novo download pelo portal do provedor."
  Write-Output "Criando staging remoto exclusivo e restaurando em banco temporário isolado."
  Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, $createStageCommand) -Description "A criação do staging remoto"
  $remoteStageCreated = $true

  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $downloadedBackup, $downloadedSidecar, $localRestoreScript, ($sshAlias + ":" + $remoteStage + "/")) -Description "O envio da cópia baixada ao staging remoto"
  $remoteRestoreStarted = $true
  try {
    Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, "bash '$remoteStage/restore-offsite.sh'") -Description "O ensaio de restauração isolada"
  } catch {
    Write-Warning ("O roteiro remoto foi iniciado ou a conexão foi interrompida. Confira a saída do SSH para a limpeza do banco {0} e revise somente o staging {1}." -f $restoreDatabase, $remoteStage)
    throw
  }
  Write-Output "OFFSITE_BACKUP_VERIFICATION=passed"
  Write-Output "OFFSITE_BACKUP_SHA256=$receiptHash"
  Write-Output "OFFSITE_RESTORE_COUNTS_REVIEW_REQUIRED=true"
} finally {
  if ($remoteStageCreated -and -not $remoteRestoreStarted) {
    $cleanupScript = @'
set -euo pipefail
stage="/var/tmp/hub-offsite-__STAGE_TOKEN__"
if [[ "$stage" == "/var/tmp/hub-offsite-__STAGE_TOKEN__" && -d "$stage" && ! -L "$stage" ]]; then
  for file in '__DUMP_NAME__' '__DUMP_NAME__.sha256' 'restore-offsite.sh'; do
    if [[ -f "$stage/$file" && ! -L "$stage/$file" ]]; then
      rm -f -- "$stage/$file"
    fi
  done
  rmdir -- "$stage"
fi
'@
    $cleanupScript = $cleanupScript.Replace("__STAGE_TOKEN__", $stageToken)
    $cleanupScript = $cleanupScript.Replace("__DUMP_NAME__", $downloadedName)
    try {
      $cleanupCommand = ConvertTo-RemoteBashCommand -Script $cleanupScript
      Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, $cleanupCommand) -Description "A limpeza do staging remoto"
    } catch {
      Write-Warning ("A limpeza do staging pode exigir revisão manual somente em {0}: {1}" -f $remoteStage, $_.Exception.Message)
    }
  }
  if (Test-Path -LiteralPath $localRestoreScript -PathType Leaf) {
    Remove-Item -LiteralPath $localRestoreScript -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $localStage -PathType Container) {
    try {
      [System.IO.Directory]::Delete($localStage, $false)
    } catch {
      Write-Warning "A pasta temporária criada por esta execução foi preservada para revisão: $localStage"
    }
  }
}
