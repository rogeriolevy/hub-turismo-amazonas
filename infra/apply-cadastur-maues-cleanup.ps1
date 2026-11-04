[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$ConfirmOffsiteBackupValidated,
  [string]$ValidatedBackupFile,
  [string]$ValidatedBackupSha256
)

$ErrorActionPreference = "Stop"
$sshAlias = "hub-turismo-vps"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$sqlPath = Join-Path $PSScriptRoot "prune-cadastur-outside-maues.sql"
$backupSummaryPath = Join-Path $repositoryRoot ".planning\phases\02-recupera-o-externa\02-02-SUMMARY.md"
$releaseBaselinePath = Join-Path $repositoryRoot ".planning\phases\03-atualiza-o-segura\03-BASELINE.md"
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
Add-Type -AssemblyName System.IO.Compression

if (-not (Test-Path -LiteralPath $sqlPath -PathType Leaf)) {
  throw "Roteiro SQL ausente: $sqlPath"
}

$validatedFile = ""
$validatedHash = ""
$sqlBytes = [System.IO.File]::ReadAllBytes($sqlPath)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
  $sqlHash = [BitConverter]::ToString($sha256.ComputeHash($sqlBytes)).Replace("-", "").ToLowerInvariant()
} finally {
  $sha256.Dispose()
}

if ($Apply) {
  if (-not $ConfirmOffsiteBackupValidated) {
    throw "Aplique somente após BACK-01 passar fora da VPS; acrescente -ConfirmOffsiteBackupValidated e informe o dump e SHA-256 validados."
  }
  if ($ValidatedBackupFile -notmatch '^hub-\d{8}T\d{6}Z-\d+\.dump$') {
    throw "Nome de dump inválido. Use o nome exato do backup cuja cópia externa foi validada."
  }
  if ($ValidatedBackupSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw "SHA-256 inválido. Informe o hash exato da cópia externa validada."
  }
  if (-not (Test-Path -LiteralPath $backupSummaryPath -PathType Leaf)) {
    throw "BACK-01 ainda não está registrado como concluído em $backupSummaryPath."
  }
  $summary = [System.IO.File]::ReadAllText($backupSummaryPath, [System.Text.Encoding]::UTF8)
  if ($summary -notmatch '(?m)^status:\s*complete\s*$') {
    throw "O resumo GSD 02-02 não está marcado como complete. BACK-01 continua pendente."
  }
  foreach ($requiredEvidence in @(
      "OFFSITE_BACKUP_VERIFICATION=passed",
      "RESTORE_DATABASE_CLEANUP=ok",
      "REMOTE_STAGING_CLEANUP=ok",
      "OFFSITE_RESTORE_COUNTS_REVIEWED=true",
      $ValidatedBackupFile,
      $ValidatedBackupSha256.ToLowerInvariant()
    )) {
    if ($summary.IndexOf($requiredEvidence, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
      throw "O resumo 02-02 não registra a evidência exigida: $requiredEvidence"
    }
  }
  $validatedFile = $ValidatedBackupFile
  $validatedHash = $ValidatedBackupSha256.ToLowerInvariant()

  if (-not (Test-Path -LiteralPath $releaseBaselinePath -PathType Leaf)) {
    throw "Baseline da candidata ausente: $releaseBaselinePath"
  }
  $releaseBaseline = [System.IO.File]::ReadAllText($releaseBaselinePath, [System.Text.Encoding]::UTF8)
  $pinnedHashes = [regex]::Match(
    $releaseBaseline,
    '(?m)^- SHA-256 do ZIP 0\.12\.8: `(?<archive>[a-fA-F0-9]{64})`; SHA-256 do manifesto: `(?<manifest>[a-fA-F0-9]{64})`\.$'
  )
  if (-not $pinnedHashes.Success) {
    throw "A baseline não fixa os hashes do ZIP e do manifesto da candidata 0.12.8."
  }
  $expectedArchiveHash = $pinnedHashes.Groups["archive"].Value.ToLowerInvariant()
  $expectedManifestHash = $pinnedHashes.Groups["manifest"].Value.ToLowerInvariant()

  $temporaryRoot = Join-Path $repositoryRoot "tmp"
  $latestCandidate = Get-ChildItem -LiteralPath $temporaryRoot -Directory -Filter "source-snapshot-0.12.8-*" |
    Sort-Object -Property Name -Descending |
    Select-Object -First 1
  if (-not $latestCandidate) {
    throw "Nenhum snapshot de fontes 0.12.8 foi encontrado em $temporaryRoot."
  }
  $candidateArchive = Join-Path $latestCandidate.FullName "hub-turismo-amazonas-0.12.8-source.zip"
  $candidateManifestPath = Join-Path $latestCandidate.FullName "source\SOURCE-MANIFEST.json"
  if (-not (Test-Path -LiteralPath $candidateArchive -PathType Leaf) -or
      -not (Test-Path -LiteralPath "$candidateArchive.sha256" -PathType Leaf) -or
      -not (Test-Path -LiteralPath $candidateManifestPath -PathType Leaf)) {
    throw "O snapshot 0.12.8 mais recente está incompleto: $($latestCandidate.FullName)"
  }
  $candidateArchiveHash = (Get-FileHash -LiteralPath $candidateArchive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($candidateArchiveHash -ne $expectedArchiveHash) {
    throw "O ZIP não corresponde ao SHA-256 fixado em 03-BASELINE.md; revise e fixe uma nova candidata antes da limpeza."
  }
  $candidateSidecar = [System.IO.File]::ReadAllText("$candidateArchive.sha256").Trim()
  if ($candidateSidecar -notmatch "^$candidateArchiveHash  hub-turismo-amazonas-0\.12\.8-source\.zip$") {
    throw "O ZIP do snapshot 0.12.8 mais recente não corresponde ao sidecar SHA-256."
  }
  $candidateManifestHash = (Get-FileHash -LiteralPath $candidateManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($candidateManifestHash -ne $expectedManifestHash) {
    throw "O manifesto não corresponde ao SHA-256 fixado em 03-BASELINE.md; revise e fixe uma nova candidata antes da limpeza."
  }
  $candidateManifest = [System.IO.File]::ReadAllText($candidateManifestPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  if ($candidateManifest.packageVersion -ne "0.12.8") {
    throw "O manifesto local não identifica a candidata 0.12.8."
  }
  foreach ($relativePath in @(
      "package.json",
      "infra/apply-cadastur-maues-cleanup.ps1",
      "infra/prune-cadastur-outside-maues.sql",
      "components/platform/navigation/vessel-schedule.tsx",
      "lib/navigation-data.ts",
      "docs/releases/0.12.8.md"
    )) {
    $entry = $candidateManifest.files | Where-Object { $_.path -ceq $relativePath } | Select-Object -First 1
    if (-not $entry) {
      throw "O snapshot verificado não contém o caminho obrigatório: $relativePath"
    }
    $workingPath = Join-Path $repositoryRoot ($relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $workingPath -PathType Leaf)) {
      throw "A fonte local da candidata está ausente: $relativePath"
    }
    $workingHash = (Get-FileHash -LiteralPath $workingPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($workingHash -ne $entry.sha256) {
      throw "A fonte mudou desde o snapshot validado: $relativePath. Gere e revise outro snapshot antes da limpeza."
    }
  }
}

$countQuery = @'
SELECT 'cadastur_maues=' || COUNT(*)::text FROM cadastur_entries WHERE city = U&'Mau\00E9s'
UNION ALL SELECT 'cadastur_outside=' || COUNT(*)::text FROM cadastur_entries WHERE city IS DISTINCT FROM U&'Mau\00E9s'
UNION ALL SELECT 'cadastur_linked_outside=' || COUNT(*)::text FROM cadastur_entries WHERE city IS DISTINCT FROM U&'Mau\00E9s' AND (company_id IS NOT NULL OR guide_id IS NOT NULL)
UNION ALL SELECT 'guides_total=' || COUNT(*)::text FROM guides
UNION ALL SELECT 'guides_outside_or_unknown=' || COUNT(*)::text FROM guides AS g LEFT JOIN companies AS c ON c.id = g.company_id WHERE c.city IS DISTINCT FROM U&'Mau\00E9s'
UNION ALL SELECT 'companies_outside=' || COUNT(*)::text FROM companies WHERE city IS DISTINCT FROM U&'Mau\00E9s'
UNION ALL SELECT 'catalog_outside=' || COUNT(*)::text FROM catalog_items WHERE city IS DISTINCT FROM U&'Mau\00E9s'
UNION ALL SELECT 'tours_outside=' || COUNT(*)::text FROM tours WHERE city IS DISTINCT FROM U&'Mau\00E9s'
UNION ALL SELECT 'imports_total=' || COUNT(*)::text FROM cadastur_imports
UNION ALL SELECT 'imports_committed=' || COUNT(*)::text FROM cadastur_imports WHERE status = 'committed'
UNION ALL SELECT 'imports_with_payload=' || COUNT(*)::text FROM cadastur_imports WHERE payload IS NOT NULL
'@
$queryB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($countQuery))

$compressedSqlStream = [System.IO.MemoryStream]::new()
$gzipStream = [System.IO.Compression.GZipStream]::new(
  $compressedSqlStream,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $true
)
try {
  $gzipStream.Write($sqlBytes, 0, $sqlBytes.Length)
} finally {
  $gzipStream.Dispose()
}
$sqlGzipB64 = [Convert]::ToBase64String($compressedSqlStream.ToArray())
$compressedSqlStream.Dispose()

$remoteTemplate = @'
set -Eeuo pipefail
operation='__OPERATION__'
validated_backup_file='__VALIDATED_BACKUP_FILE__'
validated_backup_sha256='__VALIDATED_BACKUP_SHA256__'
sql_sha256='__SQL_SHA256__'
counts_sql_b64='__COUNTS_SQL_B64__'
sql_gzip_b64='__SQL_GZIP_B64__'

if [[ "$(id -un)" != "hub" ]]; then
  echo "A operação precisa usar a conta SSH hub." >&2
  exit 1
fi
if [[ "$operation" != "inspect" && "$operation" != "preflight" && "$operation" != "apply" ]]; then
  echo "Modo remoto inválido." >&2
  exit 1
fi

release_directory="$(readlink -e -- /opt/hub-turismo/current)"
case "$release_directory" in
  /opt/hub-turismo/release-*) ;;
  *) echo "A release ativa do Hub não foi encontrada." >&2; exit 1 ;;
esac
if [[ ! -f "$release_directory/infra/vps.env" || -L "$release_directory/infra/vps.env" ]]; then
  echo "O ambiente da release ativa está ausente ou inválido." >&2
  exit 1
fi
app_version="$(awk -F= '$1 == "APP_VERSION" { print $2; exit }' "$release_directory/infra/vps.env")"
if [[ ! "$app_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "APP_VERSION da release ativa está ausente ou inválida." >&2
  exit 1
fi

mapfile -t postgres_ids < <(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}')
if [[ "${#postgres_ids[@]}" -ne 1 ]]; then
  echo "Era esperado exatamente um container PostgreSQL saudável do Hub." >&2
  exit 1
fi
postgres_id="${postgres_ids[0]}"
postgres_state="$(docker inspect --format '{{.State.Status}}' "$postgres_id")"
postgres_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$postgres_id")"
if [[ "$postgres_state" != "running" || "$postgres_health" != "healthy" ]]; then
  echo "PostgreSQL não está saudável: state=$postgres_state health=$postgres_health." >&2
  exit 1
fi

counts_sql="$(printf '%s' "$counts_sql_b64" | base64 -d)"
run_counts() {
  docker exec "$postgres_id" sh -ec \
    'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 --command "$1"' \
    sh "$counts_sql"
}
counts="$(run_counts)"
count_lines=0
while IFS= read -r line; do
  [[ "$line" =~ ^[a-z_]+=[0-9]+$ ]] || {
    echo "A consulta agregada retornou um formato inesperado." >&2
    exit 1
  }
  count_lines=$((count_lines + 1))
done <<< "$counts"
if [[ "$count_lines" -ne 11 ]]; then
  echo "A consulta agregada não retornou as 11 contagens esperadas." >&2
  exit 1
fi

backup_directory=/var/backups/hub-turismo
latest_backup="$(find "$backup_directory" -maxdepth 1 -type f -name 'hub-*.dump' -printf '%T@ %f\n' | sort -nr | sed -n '1p' | cut -d' ' -f2-)"
if [[ ! "$latest_backup" =~ ^hub-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]]; then
  echo "Não há backup local recente com nome esperado." >&2
  exit 1
fi
latest_path="$backup_directory/$latest_backup"
latest_sidecar="$latest_path.sha256"
if [[ ! -f "$latest_path" || -L "$latest_path" || ! -s "$latest_path" || ! -f "$latest_sidecar" || -L "$latest_sidecar" ]]; then
  echo "O backup local mais recente ou seu manifesto está ausente, vazio ou inválido." >&2
  exit 1
fi
latest_sidecar_hash="$(tr -d '\r\n' < "$latest_sidecar")"
latest_backup_sha256="$(sha256sum < "$latest_path" | awk '{ print $1 }')"
if [[ ! "$latest_sidecar_hash" =~ ^[a-fA-F0-9]{64}$ || "$latest_sidecar_hash" != "$latest_backup_sha256" ]]; then
  echo "O backup local mais recente não passou pelo SHA-256." >&2
  exit 1
fi

printf 'CURRENT_RELEASE=%s\n' "$release_directory"
printf 'APP_VERSION=%s\n' "$app_version"
printf '%s\n' "$counts"
printf 'LATEST_BACKUP_FILE=%s\n' "$latest_backup"
printf 'LATEST_BACKUP_SHA256=%s\n' "$latest_backup_sha256"

if [[ "$operation" == "inspect" ]]; then
  echo "INSPECTION=read-only"
  exit 0
fi
if [[ ! "$validated_backup_file" =~ ^hub-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ||
      ! "$validated_backup_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Os metadados do backup externo validado estão fora do formato esperado." >&2
  exit 1
fi
if [[ "$latest_backup" != "$validated_backup_file" || "$latest_backup_sha256" != "$validated_backup_sha256" ]]; then
  echo "O backup mais recente na VPS não é o mesmo dump validado externamente. Atualize a cópia externa antes de aplicar." >&2
  exit 1
fi

require_count() {
  local expected_line="$1"
  if ! grep -Fqx -- "$expected_line" <<< "$counts"; then
    echo "Preflight divergiu de $expected_line; a limpeza foi cancelada." >&2
    exit 1
  fi
}
require_count 'cadastur_maues=42'
require_count 'cadastur_outside=2679'
require_count 'cadastur_linked_outside=0'
require_count 'guides_outside_or_unknown=0'
require_count 'companies_outside=0'
require_count 'catalog_outside=0'
require_count 'tours_outside=0'
require_count 'imports_total=6'
require_count 'imports_committed=6'
require_count 'imports_with_payload=0'
echo "OFFSITE_BACKUP_MATCH=ok"

if [[ "$operation" == "preflight" ]]; then
  echo "CLEANUP_PREFLIGHT=passed; nenhuma linha foi alterada."
  exit 0
fi

if [[ ! "$sql_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo "O hash do roteiro SQL está inválido." >&2
  exit 1
fi
actual_sql_sha256="$(printf '%s' "$sql_gzip_b64" | base64 -d | gzip -dc | sha256sum | awk '{ print $1 }')"
if [[ "$actual_sql_sha256" != "$sql_sha256" ]]; then
  echo "O roteiro SQL enviado não corresponde ao hash local." >&2
  exit 1
fi
printf '%s' "$sql_gzip_b64" | base64 -d | gzip -dc | docker exec -i "$postgres_id" sh -ec \
  'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-psqlrc --quiet --set=ON_ERROR_STOP=1 --file=-'

counts_after="$(run_counts)"
for expected_line in \
  'cadastur_maues=42' \
  'cadastur_outside=0' \
  'cadastur_linked_outside=0' \
  'guides_outside_or_unknown=0' \
  'companies_outside=0' \
  'catalog_outside=0' \
  'tours_outside=0' \
  'imports_total=6' \
  'imports_committed=6' \
  'imports_with_payload=0'; do
  if ! grep -Fqx -- "$expected_line" <<< "$counts_after"; then
    echo "A contagem posterior divergiu de $expected_line. A transação SQL deveria ter feito rollback se o postflight divergiu." >&2
    exit 1
  fi
done
while IFS= read -r line; do
  printf 'AFTER_%s\n' "$line"
done <<< "$counts_after"
echo "CADASTUR_CLEANUP=complete"
'@

function Invoke-RemoteOperation {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("inspect", "preflight", "apply")][string]$Operation,
    [string]$BackupFile = "",
    [string]$BackupSha256 = "",
    [string]$CompressedSql = ""
  )

  $remoteScript = $remoteTemplate
  $remoteScript = $remoteScript.Replace("__OPERATION__", $Operation)
  $remoteScript = $remoteScript.Replace("__VALIDATED_BACKUP_FILE__", $BackupFile)
  $remoteScript = $remoteScript.Replace("__VALIDATED_BACKUP_SHA256__", $BackupSha256)
  $remoteScript = $remoteScript.Replace("__SQL_SHA256__", $sqlHash)
  $remoteScript = $remoteScript.Replace("__COUNTS_SQL_B64__", $queryB64)
  $remoteScript = $remoteScript.Replace("__SQL_GZIP_B64__", $CompressedSql)
  $remoteCommand = "printf '%s' '$([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($remoteScript)))' | base64 -d | bash"
  $arguments = @(
    "-T",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "ForwardAgent=no",
    "-o", "BatchMode=no",
    "-o", "PasswordAuthentication=no",
    "-o", "PreferredAuthentications=publickey",
    "-o", "ConnectTimeout=15",
    $sshAlias,
    $remoteCommand
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
  $ErrorActionPreference = "Continue"
  if ($null -ne $nativePreference) {
    $PSNativeCommandUseErrorActionPreference = $false
  }
  try {
    & $ssh @arguments
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    if ($null -ne $nativePreference) {
      $PSNativeCommandUseErrorActionPreference = $nativePreference.Value
    }
  }
  if ($exitCode -ne 0) {
    throw "A operação SSH ($Operation) terminou com código $exitCode. Confira a saída acima antes de tentar novamente."
  }
}

if (-not $Apply) {
  Write-Output "Inspeção somente leitura via $sshAlias; nenhuma linha será alterada."
  Write-Output "Se solicitado, desbloqueie a chave no prompt local do OpenSSH."
  Invoke-RemoteOperation -Operation "inspect"
  return
}

Write-Output "BACK-01 está marcado como concluído. Revalidando na VPS o backup exato e as contagens antes de pedir confirmação."
Invoke-RemoteOperation -Operation "preflight" -BackupFile $validatedFile -BackupSha256 $validatedHash

$requiredConfirmation = "APLICAR LIMPEZA CADASTUR MAUES 2679"
$confirmation = Read-Host "Para apagar somente os registros Cadastur fora de Maués, digite exatamente: $requiredConfirmation"
if ($confirmation -cne $requiredConfirmation) {
  throw "Confirmação não corresponde. Nenhuma linha foi alterada."
}

Write-Output "Executando a limpeza transacional com o backup externo validado ainda como backup mais recente."
Write-Output "A aplicação e o PostgreSQL não serão reiniciados; a transação aborta se qualquer contagem divergir."
Invoke-RemoteOperation -Operation "apply" -BackupFile $validatedFile -BackupSha256 $validatedHash -CompressedSql $sqlGzipB64
