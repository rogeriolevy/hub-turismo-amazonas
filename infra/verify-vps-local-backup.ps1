[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DownloadedBackupPath,
  [Parameter(Mandatory = $true)]
  [string]$ReceiptPath,
  [Parameter(Mandatory = $true)]
  [string]$SourceReceiptPath,
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-fA-F0-9]{64}$')]
  [string]$CandidateAttestationSha256,
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^/opt/hub-turismo/attestations/candidate-[0-9]+\.[0-9]+\.[0-9]+\.env$')]
  [string]$CandidateAttestationPath,
  [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA "HubTurismo\Backups"),
  [switch]$ConfirmLocalBackup
)

$ErrorActionPreference = "Stop"
$sshAlias = "hub-turismo-vps"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$temporaryRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$scp = (Get-Command scp.exe -ErrorAction Stop).Source
$localAppRoot = Join-Path $env:LOCALAPPDATA "HubTurismo"
$backupRoot = (Resolve-Path -LiteralPath $BackupDirectory -ErrorAction Stop).Path
$receiptDirectory = (Resolve-Path -LiteralPath (Join-Path $localAppRoot "BackupReceipts") -ErrorAction Stop).Path

if (-not $ConfirmLocalBackup) {
  throw "Confirme que a cópia local foi recebida por SSH e está armazenada neste computador acrescentando -ConfirmLocalBackup."
}
if (-not (Test-Path -LiteralPath $DownloadedBackupPath -PathType Leaf)) {
  throw "A cópia recém-baixada não foi encontrada: $DownloadedBackupPath"
}
if (-not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
  throw "O recibo local de origem não foi encontrado: $ReceiptPath"
}
if (-not (Test-Path -LiteralPath $SourceReceiptPath -PathType Leaf)) {
  throw "O recibo de origem do snapshot não foi encontrado: $SourceReceiptPath"
}
$downloadedBackup = (Resolve-Path -LiteralPath $DownloadedBackupPath -ErrorAction Stop).Path
$receiptFile = (Resolve-Path -LiteralPath $ReceiptPath -ErrorAction Stop).Path
$sourceReceiptFile = (Resolve-Path -LiteralPath $SourceReceiptPath -ErrorAction Stop).Path
function Test-PathWithinDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$CandidatePath,
    [Parameter(Mandatory = $true)][string]$DirectoryPath
  )
  $separatorChars = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $candidateFullPath = [System.IO.Path]::GetFullPath($CandidatePath).TrimEnd($separatorChars)
  $directoryFullPath = [System.IO.Path]::GetFullPath($DirectoryPath).TrimEnd($separatorChars)
  if ([string]::Equals($candidateFullPath, $directoryFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }
  $directoryPrefix = $directoryFullPath + [System.IO.Path]::DirectorySeparatorChar
  return $candidateFullPath.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}
if (-not (Test-PathWithinDirectory -CandidatePath $downloadedBackup -DirectoryPath $backupRoot)) {
  throw "A cópia precisa estar dentro da pasta local protegida $backupRoot."
}
if (-not (Test-PathWithinDirectory -CandidatePath $receiptFile -DirectoryPath $receiptDirectory)) {
  throw "O recibo deve estar dentro de $receiptDirectory."
}
if (-not (Test-PathWithinDirectory -CandidatePath $sourceReceiptFile -DirectoryPath $backupRoot)) {
  throw "O recibo de origem precisa acompanhar o dump dentro da pasta local protegida."
}
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
if (Test-PathWithinDirectory -CandidatePath $downloadedBackup -DirectoryPath $repositoryRoot) {
  throw "A cópia precisa ficar fora do repositório para não ser incluída em um pacote de release."
}
if (Test-PathWithinDirectory -CandidatePath $backupRoot -DirectoryPath $temporaryRoot) {
  throw "A pasta de backup não pode estar dentro da área temporária do Windows."
}
foreach ($protectedRoot in @($backupRoot, $receiptDirectory)) {
  $protectedItem = Get-Item -LiteralPath $protectedRoot -Force
  if (($protectedItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "As pastas locais de backup e recibo não podem ser links ou junctions: $protectedRoot"
  }
}
$downloadedDirectory = Split-Path -Parent $downloadedBackup
$downloadedName = Split-Path -Leaf $downloadedBackup
$downloadedSidecar = Join-Path $downloadedDirectory ($downloadedName + ".sha256")
$sourceReceiptSidecar = $sourceReceiptFile + ".sha256"
if ($downloadedName -notmatch '^hub-\d{8}T\d{6}Z-\d+\.dump$') {
  throw "O nome da cópia baixada não corresponde ao formato de backup Hub esperado."
}
if (-not (Test-Path -LiteralPath $downloadedSidecar -PathType Leaf) -or (Get-Item -LiteralPath $downloadedBackup).Length -lt 1) {
  throw "A cópia baixada precisa ser não vazia e estar acompanhada pelo arquivo .sha256 correspondente."
}
if (-not (Test-Path -LiteralPath $sourceReceiptSidecar -PathType Leaf)) { throw "O recibo de origem precisa estar acompanhado por seu manifesto SHA-256." }

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
$sourceReceiptHash = (Get-FileHash -LiteralPath $sourceReceiptFile -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
$sourceReceiptSidecarHash = [System.IO.File]::ReadAllText($sourceReceiptSidecar).Trim().ToLowerInvariant()
if ($receipt.sourceReceiptFile -cne (Split-Path -Leaf $sourceReceiptFile) -or
    $receipt.sourceReceiptSha256 -cne $sourceReceiptHash -or
    $sourceReceiptSidecarHash -cne $sourceReceiptHash) { throw "O recibo independente, o recibo de origem e seu manifesto não descrevem o mesmo snapshot." }
try {
  $sourceRecord = [System.IO.File]::ReadAllText($sourceReceiptFile) | ConvertFrom-Json -ErrorAction Stop
} catch { throw "O recibo de origem não contém JSON canônico válido." }
if ($sourceRecord.schema -cne 'hub-postgres-source-v1' -or $sourceRecord.ledgerSha256 -notmatch '^[a-f0-9]{64}$' -or $sourceRecord.releaseVersion -notmatch '^\d+\.\d+\.\d+$') { throw "O recibo de origem não contém a forma canônica esperada." }

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
$restoreDatabase = "hub_restore_local_" + $databaseTimestamp + "_" + $databaseNonce
$stageToken = [guid]::NewGuid().ToString("N").Substring(0, 16)
$remoteStage = "/var/tmp/hub-local-backup-$stageToken"
$localStage = Join-Path $temporaryRoot ("hub-local-backup-verify-" + [guid]::NewGuid().ToString("N"))
$remoteStageCreated = $false
$remoteRestoreStarted = $false
[System.IO.Directory]::CreateDirectory($localStage) | Out-Null

$remoteRestoreScript = @'
set -Eeuo pipefail
stage="/var/tmp/hub-local-backup-__STAGE_TOKEN__"
dump_name='__DUMP_NAME__'
restore_database='__DATABASE_NAME__'
expected_hash='__EXPECTED_HASH__'
source_name='__SOURCE_NAME__'
expected_source_hash='__EXPECTED_SOURCE_HASH__'
database_created=0
postgres_container_id=""

if [[ "$(id -un)" != "hub" ]]; then
  echo "O ensaio precisa ser executado pela conta hub." >&2
  exit 1
fi
if [[ "$stage" != "/var/tmp/hub-local-backup-__STAGE_TOKEN__" || ! -d "$stage" || -L "$stage" ]]; then
  echo "O staging remoto não corresponde à pasta criada para esta execução." >&2
  exit 1
fi
if [[ ! "$dump_name" =~ ^hub-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ||
      ! "$restore_database" =~ ^hub_restore_local_[0-9]{8}T[0-9]{6}Z_[a-f0-9]{8}$ ||
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
  if [[ -f "$stage/restore-local-backup.sh" && ! -L "$stage/restore-local-backup.sh" ]]; then
    rm -f -- "$stage/restore-local-backup.sh" || cleanup_failed=1
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
if [[ ! "$source_name" =~ ^hub-[0-9]{8}T[0-9]{6}Z-[0-9]+\.source\.json$ || ! -f "$stage/$source_name" || -L "$stage/$source_name" || ! -f "$stage/$source_name.sha256" || -L "$stage/$source_name.sha256" ]]; then
  echo "O recibo de origem enviado ao staging está ausente ou inválido." >&2
  exit 1
fi
[[ "$(sha256sum < "$stage/$source_name" | awk '{print $1}')" == "$expected_source_hash" && "$(tr -d '\r\n' < "$stage/$source_name.sha256")" == "$expected_source_hash" ]] || { echo "O recibo de origem enviado ao staging não corresponde ao hash esperado." >&2; exit 1; }
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
COMPOSE_PROJECT_NAME=hub-turismo HUB_ENV_FILE="$release_directory/infra/vps.env" \
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
web_container_id="$(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=web' --format '{{.ID}}' | head -n 1)"
[[ -n "$web_container_id" ]] || { echo "O container web não está disponível para a comparação canônica." >&2; exit 1; }
restore_database_url="$(docker exec "$web_container_id" node -e 'const value=process.env.DATABASE_URL; if (!value) process.exit(2); const url=new URL(value); url.pathname="/"+process.argv[1]; process.stdout.write(url.toString())' "$restore_database")" || { echo "Não foi possível derivar a conexão isolada." >&2; exit 1; }
restored_capture="$(printf 'COMPLETE\n' | docker exec -i -e DATABASE_URL="$restore_database_url" "$web_container_id" node /app/scripts/capture-postgres-backup-source.mjs)" || { echo "A captura canônica do restore falhou." >&2; exit 1; }
restored_record="$(sed -n 's/^SOURCE_RECORD=//p' <<< "$restored_capture")"
[[ "$(grep -Ec '^SOURCE_RECORD=' <<< "$restored_capture")" == 1 && -n "$restored_record" ]] || { echo "A captura do restore não retornou um único recibo canônico." >&2; exit 1; }
node -e 'const fs=require("fs"); const [source, restored]=process.argv.slice(1).map(JSON.parse); if (JSON.stringify(source.counts)!==JSON.stringify(restored.counts) || source.ledgerSha256!==restored.ledgerSha256) process.exit(1);' "$(cat "$stage/$source_name")" "$restored_record" || { echo "A restauração não corresponde exatamente ao snapshot de origem." >&2; exit 1; }
echo "RESTORE_SOURCE_COMPARISON=match"
printf '%s\n' "$restore_counts"
echo "RESTORE_DATABASE=$restore_database"
echo "RESTORE_DATABASE_CLEANUP=pending"
'@
$remoteRestoreScript = $remoteRestoreScript.Replace("__STAGE_TOKEN__", $stageToken)
$remoteRestoreScript = $remoteRestoreScript.Replace("__DUMP_NAME__", $downloadedName)
$remoteRestoreScript = $remoteRestoreScript.Replace("__DATABASE_NAME__", $restoreDatabase)
$remoteRestoreScript = $remoteRestoreScript.Replace("__EXPECTED_HASH__", $receiptHash)
$remoteRestoreScript = $remoteRestoreScript.Replace("__SOURCE_NAME__", (Split-Path -Leaf $sourceReceiptFile))
$remoteRestoreScript = $remoteRestoreScript.Replace("__EXPECTED_SOURCE_HASH__", $sourceReceiptHash)
$localRestoreScript = Join-Path $localStage "restore-local-backup.sh"

try {
  Write-NewUtf8File -Path $localRestoreScript -Content $remoteRestoreScript
  $createStageScript = @'
set -euo pipefail
if [[ "$(id -un)" != "hub" ]]; then
  echo "A criação de staging precisa usar a conta hub." >&2
  exit 1
fi
mkdir -m 700 -- "/var/tmp/hub-local-backup-__STAGE_TOKEN__"
'@
  $createStageScript = $createStageScript.Replace("__STAGE_TOKEN__", $stageToken)
  $createStageCommand = ConvertTo-RemoteBashCommand -Script $createStageScript
  Write-Output "Verificando a cópia local recebida por SSH e o recibo SHA-256 independente."
  Write-Output "Confirmação recebida: o dump está armazenado neste computador fora da VPS."
  Write-Output "Criando staging remoto exclusivo e restaurando em banco temporário isolado."
  Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, $createStageCommand) -Description "A criação do staging remoto"
  $remoteStageCreated = $true

  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $downloadedBackup, $downloadedSidecar, $sourceReceiptFile, $sourceReceiptSidecar, $localRestoreScript, ($sshAlias + ":" + $remoteStage + "/")) -Description "O envio da cópia baixada ao staging remoto"
  $remoteRestoreStarted = $true
  try {
    $restoreOutput = Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, "bash '$remoteStage/restore-local-backup.sh'") -Description "O ensaio de restauração isolada" -CaptureOutput
  } catch {
    Write-Warning ("O roteiro remoto foi iniciado ou a conexão foi interrompida. Confira a saída do SSH para a limpeza do banco {0} e revise somente o staging {1}." -f $restoreDatabase, $remoteStage)
    throw
  }
  $restoreLines = @($restoreOutput | ForEach-Object { [string]$_ })
  foreach ($requiredMarker in @("RESTORE_SOURCE_COMPARISON=match", "RESTORE_DATABASE_CLEANUP=ok", "REMOTE_STAGING_CLEANUP=ok")) {
    if (@($restoreLines | Where-Object { $_ -ceq $requiredMarker }).Count -ne 1) { throw "O ensaio não confirmou $requiredMarker; nenhum atestado de ativação foi criado." }
  }
  $candidateReadScript = @'
set -euo pipefail
candidate='__CANDIDATE_PATH__'
expected='__CANDIDATE_SHA256__'
[[ -f "$candidate" && ! -L "$candidate" && "$(stat -c '%a' "$candidate")" == 600 ]] || exit 1
actual="$(sha256sum < "$candidate" | awk '{print $1}')"
[[ "$actual" == "$expected" ]] || exit 1
version="$(awk -F= '$1=="PACKAGE_VERSION" {print $2}' "$candidate")"
image="$(awk -F= '$1=="IMAGE_ID" {print $2}' "$candidate")"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && -n "$image" ]] || exit 1
printf '%s|%s\n' "$version" "$image"
'@
  $candidateReadScript = $candidateReadScript.Replace("__CANDIDATE_PATH__", $CandidateAttestationPath).Replace("__CANDIDATE_SHA256__", $CandidateAttestationSha256.ToLowerInvariant())
  $candidateMetadata = @(Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, (ConvertTo-RemoteBashCommand -Script $candidateReadScript)) -Description "A leitura do atestado candidato" -CaptureOutput)
  if ($candidateMetadata.Count -ne 1 -or $candidateMetadata[0] -notmatch '^[0-9]+\.[0-9]+\.[0-9]+\|.+$') { throw "O atestado candidato não contém os campos medidos esperados." }
  $candidateParts = $candidateMetadata[0] -split '\|', 2
  $issuedAt = [DateTime]::UtcNow
  $expiresAt = $issuedAt.AddMinutes(60)
  $attestationDirectory = Join-Path $receiptDirectory "BackupActivationAttestations"
  [System.IO.Directory]::CreateDirectory($attestationDirectory) | Out-Null
  Set-PrivateDirectoryAcl -Path $attestationDirectory
  $attestationFile = Join-Path $attestationDirectory ("backup-" + $downloadedName + ".env")
  $sourceCountsJson = $sourceRecord.counts | ConvertTo-Json -Compress
  $attestation = @(
    "CANDIDATE_ATTESTATION_PATH=$CandidateAttestationPath",
    "CANDIDATE_ATTESTATION_SHA256=$($CandidateAttestationSha256.ToLowerInvariant())",
    "CANDIDATE_VERSION=$($candidateParts[0])",
    "CANDIDATE_IMAGE_ID=$($candidateParts[1])",
    "DUMP_FILE=$downloadedName",
    "DUMP_SHA256=$receiptHash",
    "SOURCE_RECEIPT_FILE=$(Split-Path -Leaf $sourceReceiptFile)",
    "SOURCE_RECEIPT_SHA256=$sourceReceiptHash",
    "SOURCE_COUNTS=$sourceCountsJson",
    "SOURCE_LEDGER_SHA256=$($sourceRecord.ledgerSha256)",
    "RESTORE_SOURCE_COMPARISON=match",
    "RESTORE_DATABASE_CLEANUP=ok",
    "REMOTE_STAGING_CLEANUP=ok",
    "ISSUED_AT_UTC=$($issuedAt.ToString('o'))",
    "EXPIRES_AT_UTC=$($expiresAt.ToString('o'))"
  ) -join [Environment]::NewLine
  Write-NewUtf8File -Path $attestationFile -Content ($attestation + [Environment]::NewLine)
  $attestationHash = (Get-FileHash -LiteralPath $attestationFile -Algorithm SHA256).Hash.ToLowerInvariant()
  $remoteAttestationPath = "/opt/hub-turismo/attestations/backup-" + $attestationHash + ".env"
  $remoteAttestationScript = "set -euo pipefail; test ! -e '$remoteAttestationPath' -a ! -L '$remoteAttestationPath'; install -o hub -g hub -m 600 /dev/stdin '$remoteAttestationPath'; test `"`$(sha256sum < '$remoteAttestationPath' | awk '{print `$1}')`" = '$attestationHash'"
  $remoteAttestationCommand = "printf '%s' '" + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([System.IO.File]::ReadAllText($attestationFile))) + "' | base64 -d | bash -c " + [Management.Automation.Language.CodeGeneration]::QuoteArgument($remoteAttestationScript)
  Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, $remoteAttestationCommand) -Description "A publicação do atestado de backup"
  Write-Output "LOCAL_BACKUP_VERIFICATION=passed"
  Write-Output "OFFSITE_BACKUP_VERIFICATION=passed"
  Write-Output "OFFSITE_BACKUP_SHA256=$receiptHash"
  Write-Output "OFFSITE_RESTORE_COUNTS_REVIEW_REQUIRED=true"
  Write-Output "BACKUP_ATTESTATION_REMOTE_PATH=$remoteAttestationPath"
  Write-Output "BACKUP_ATTESTATION_SHA256=$attestationHash"
  Write-Output "BACKUP_ATTESTATION_EXPIRES_AT_UTC=$($expiresAt.ToString('o'))"
} finally {
  if ($remoteStageCreated -and -not $remoteRestoreStarted) {
    $cleanupScript = @'
set -euo pipefail
stage="/var/tmp/hub-local-backup-__STAGE_TOKEN__"
if [[ "$stage" == "/var/tmp/hub-local-backup-__STAGE_TOKEN__" && -d "$stage" && ! -L "$stage" ]]; then
  for file in '__DUMP_NAME__' '__DUMP_NAME__.sha256' 'restore-local-backup.sh'; do
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
