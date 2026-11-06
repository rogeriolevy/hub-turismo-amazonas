[CmdletBinding()]
param(
  [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA "HubTurismo\Backups"),
  [switch]$TestOnly,
  [string]$FixtureRoot,
  [string]$FakeBin
)

$ErrorActionPreference = "Stop"
$sshAlias = "hub-turismo-vps"
$remoteBackupDirectory = "/var/backups/hub-turismo"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$temporaryRoot = [System.IO.Path]::GetFullPath($env:TEMP)
if ($TestOnly) {
  if ([string]::IsNullOrWhiteSpace($FixtureRoot) -or [string]::IsNullOrWhiteSpace($FakeBin)) { throw "TEST_FIXTURE_ARGUMENTS_REQUIRED" }
  $fixtureRootResolved = (Resolve-Path -LiteralPath $FixtureRoot -ErrorAction Stop).Path
  $fixtureMarker = Join-Path $fixtureRootResolved ".hub-vps-backup-attestation-fixture"
  if (-not (Test-Path -LiteralPath $fixtureMarker -PathType Leaf) -or (Get-Content -LiteralPath $fixtureMarker -Raw).Trim() -cne "hub-vps-backup-attestation-fixture-v1") { throw "TEST_FIXTURE_SENTINEL_INVALID" }
  $fakeBinResolved = (Resolve-Path -LiteralPath $FakeBin -ErrorAction Stop).Path
  if (-not $fakeBinResolved.StartsWith($fixtureRootResolved + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "FAKE_BIN_OUTSIDE_FIXTURE" }
  $ssh = Join-Path $fakeBinResolved "ssh.cmd"; $scp = Join-Path $fakeBinResolved "scp.cmd"
  foreach ($fake in @($ssh, $scp)) { if (-not (Test-Path -LiteralPath $fake -PathType Leaf) -or -not (Get-Content -LiteralPath $fake -Raw).Contains("hub-vps-backup-attestation-fake-v1")) { throw "FAKE_COMMAND_INVALID" } }
  $sshAlias = "fixture-vps"
} elseif (-not [string]::IsNullOrWhiteSpace($FixtureRoot) -or -not [string]::IsNullOrWhiteSpace($FakeBin)) {
  throw "TEST_FLAGS_FORBIDDEN_IN_PRODUCTION_MODE"
} else {
  $ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
  $scp = (Get-Command scp.exe -ErrorAction Stop).Source
}

$backupParent = Split-Path -Parent ([System.IO.Path]::GetFullPath($BackupDirectory))
if (-not (Test-Path -LiteralPath $backupParent -PathType Container)) {
  [System.IO.Directory]::CreateDirectory($backupParent) | Out-Null
}
if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
  [System.IO.Directory]::CreateDirectory($BackupDirectory) | Out-Null
}
$backupRoot = (Resolve-Path -LiteralPath $BackupDirectory -ErrorAction Stop).Path
$localAppRoot = Join-Path $env:LOCALAPPDATA "HubTurismo"
$receiptDirectory = Join-Path $localAppRoot "BackupReceipts"
if (-not (Test-Path -LiteralPath $receiptDirectory -PathType Container)) {
  [System.IO.Directory]::CreateDirectory($receiptDirectory) | Out-Null
}
$receiptDirectory = (Resolve-Path -LiteralPath $receiptDirectory -ErrorAction Stop).Path

function Set-PrivateDirectoryAcl {
  param([Parameter(Mandatory = $true)][string]$Path)
  if ($TestOnly) { return }
  $identitySid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $icacls = (Get-Command icacls.exe -ErrorAction Stop).Source
  $aclArguments = @(
    $Path,
    "/inheritance:r",
    "/grant:r",
    ("*{0}:(OI)(CI)F" -f $identitySid),
    "*S-1-5-18:(OI)(CI)F",
    "*S-1-5-32-544:(OI)(CI)F"
  )
  & $icacls @aclArguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível restringir as permissões da pasta de backup: $Path"
  }
}

Set-PrivateDirectoryAcl -Path $backupRoot
Set-PrivateDirectoryAcl -Path $receiptDirectory

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

if (Test-PathWithinDirectory -CandidatePath $backupRoot -DirectoryPath $repositoryRoot) {
  throw "A cópia local precisa ficar fora do repositório: $backupRoot"
}
if (Test-PathWithinDirectory -CandidatePath $backupRoot -DirectoryPath $temporaryRoot) {
  throw "A pasta de backup não pode estar dentro da área temporária do Windows."
}
if ((Test-PathWithinDirectory -CandidatePath $receiptDirectory -DirectoryPath $backupRoot) -or
    (Test-PathWithinDirectory -CandidatePath $backupRoot -DirectoryPath $receiptDirectory)) {
  throw "O recibo independente precisa permanecer fora da pasta dos dumps."
}
foreach ($protectedRoot in @($backupRoot, $receiptDirectory)) {
  $protectedItem = Get-Item -LiteralPath $protectedRoot -Force
  if (($protectedItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "As pastas locais de backup e recibo não podem ser links ou junctions: $protectedRoot"
  }
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

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
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

$remoteMetadataScript = @'
set -euo pipefail
backup_directory=/var/backups/hub-turismo
candidate="$(find "$backup_directory" -maxdepth 1 -type f -name 'hub-*.dump' -printf '%T@ %f\n' | sort -nr | sed -n '1p' | cut -d' ' -f2-)"
if [[ ! "$candidate" =~ ^hub-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]]; then
  echo "Não há dump recente com nome esperado no diretório local de backups." >&2
  exit 1
fi
backup_path="$backup_directory/$candidate"
checksum_path="$backup_path.sha256"
source_receipt_path="${backup_path%.dump}.source.json"
source_receipt_checksum_path="$source_receipt_path.sha256"
if [[ ! -f "$backup_path" || -L "$backup_path" || ! -s "$backup_path" || ! -f "$checksum_path" || -L "$checksum_path" || ! -f "$source_receipt_path" || -L "$source_receipt_path" || ! -s "$source_receipt_path" || ! -f "$source_receipt_checksum_path" || -L "$source_receipt_checksum_path" ]]; then
  echo "O dump ou seu manifesto não existe, está vazio ou não é um arquivo regular." >&2
  exit 1
fi
expected_checksum="$(tr -d '\r\n' < "$checksum_path")"
actual_checksum="$(sha256sum < "$backup_path" | awk '{ print $1 }')"
if [[ ! "$expected_checksum" =~ ^[a-fA-F0-9]{64}$ || "$actual_checksum" != "$expected_checksum" ]]; then
  echo "O SHA-256 do dump na VPS não corresponde ao manifesto." >&2
  exit 1
fi
source_receipt_sha256="$(sha256sum < "$source_receipt_path" | awk '{ print $1 }')"
source_receipt_expected="$(tr -d '\r\n' < "$source_receipt_checksum_path")"
if [[ ! "$source_receipt_sha256" =~ ^[a-fA-F0-9]{64}$ || "$source_receipt_sha256" != "$source_receipt_expected" ]]; then
  echo "O recibo de origem não corresponde ao manifesto SHA-256." >&2
  exit 1
fi
file_size="$(stat -c '%s' -- "$backup_path")"
if [[ ! "$file_size" =~ ^[0-9]+$ || "$file_size" -lt 1 ]]; then
  echo "O tamanho informado para o dump é inválido." >&2
  exit 1
fi
printf '%s|%s|%s|%s|%s\n' "$candidate" "$actual_checksum" "$file_size" "$(basename -- "$source_receipt_path")" "$source_receipt_sha256"
'@
$remoteMetadataCommand = ConvertTo-RemoteBashCommand -Script $remoteMetadataScript
Write-Output "Localizando o dump recente e validando o manifesto na VPS via $sshAlias."
Write-Output "Se o OpenSSH pedir, desbloqueie a chave no prompt local; nenhuma credencial é enviada ao script."
$remoteMetadataLines = Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, $remoteMetadataCommand) -Description "A leitura do backup na VPS" -CaptureOutput
$remoteMetadata = (@($remoteMetadataLines | ForEach-Object { $_.ToString() }) -join "").Trim()
$metadataParts = $remoteMetadata -split "\|"
if ($metadataParts.Count -ne 5) {
  throw "A VPS não retornou os metadados esperados do dump; nenhum arquivo local foi publicado."
}
$backupFileName = $metadataParts[0]
$remoteHash = $metadataParts[1].ToLowerInvariant()
$remoteSize = 0L
$sourceReceiptFileName = $metadataParts[3]
$sourceReceiptSha256 = $metadataParts[4].ToLowerInvariant()
if ($backupFileName -notmatch '^hub-(\d{8}T\d{6}Z)-\d+\.dump$') {
  throw "O nome do backup na VPS não corresponde ao formato esperado."
}
$backupTimestampUtc = $Matches[1]
if ($remoteHash -notmatch '^[a-f0-9]{64}$' -or
    -not [long]::TryParse($metadataParts[2], [ref]$remoteSize) -or
    $remoteSize -lt 1) {
  throw "Os metadados do backup na VPS são inválidos; nenhum arquivo foi publicado."
}
if ($sourceReceiptFileName -cne ($backupFileName -replace '\.dump$', '.source.json') -or $sourceReceiptSha256 -notmatch '^[a-f0-9]{64}$') {
  throw "O recibo de origem anunciado pela VPS não corresponde ao dump selecionado."
}
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($backupFileName)
$finalDirectory = Join-Path $backupRoot $baseName
$temporarySyncDirectory = Join-Path $backupRoot (".$baseName.partial-" + [guid]::NewGuid().ToString("N"))
$receiptPath = Join-Path $receiptDirectory ($backupFileName + ".json")
if (Test-Path -LiteralPath $finalDirectory) {
  throw "O destino já existe; nada foi sobrescrito: $finalDirectory"
}
if (Test-Path -LiteralPath $receiptPath) {
  throw "O recibo já existe; nada foi sobrescrito: $receiptPath"
}

$localTransferDirectory = Join-Path $temporaryRoot ("hub-local-backup-export-" + [guid]::NewGuid().ToString("N"))
$receiptCreated = $false
$published = $false
$temporarySyncCreated = $false
[System.IO.Directory]::CreateDirectory($localTransferDirectory) | Out-Null
Set-PrivateDirectoryAcl -Path $localTransferDirectory
try {
  $localDump = Join-Path $localTransferDirectory $backupFileName
  $localSidecar = $localDump + ".sha256"
  $localSourceReceipt = Join-Path $localTransferDirectory $sourceReceiptFileName
  $localSourceReceiptSidecar = $localSourceReceipt + ".sha256"
  $remoteDump = $sshAlias + ":" + $remoteBackupDirectory + "/" + $backupFileName
  $remoteSidecar = $sshAlias + ":" + $remoteBackupDirectory + "/" + $backupFileName + ".sha256"
  $remoteSourceReceipt = $sshAlias + ":" + $remoteBackupDirectory + "/" + $sourceReceiptFileName
  $remoteSourceReceiptSidecar = $remoteSourceReceipt + ".sha256"
  Write-Output "Baixando o dump e o manifesto para uma pasta temporária local."
  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $remoteDump, $localTransferDirectory) -Description "O download do dump"
  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $remoteSidecar, $localTransferDirectory) -Description "O download do manifesto"
  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $remoteSourceReceipt, $remoteSourceReceiptSidecar, $localTransferDirectory) -Description "O download do recibo de origem"

  if (-not (Test-Path -LiteralPath $localDump -PathType Leaf) -or
      -not (Test-Path -LiteralPath $localSidecar -PathType Leaf) -or
      -not (Test-Path -LiteralPath $localSourceReceipt -PathType Leaf) -or
      -not (Test-Path -LiteralPath $localSourceReceiptSidecar -PathType Leaf) -or
      (Get-Item -LiteralPath $localDump).Length -ne $remoteSize) {
    throw "Os arquivos locais não correspondem ao tamanho e aos caminhos anunciados pela VPS."
  }
  $localHash = Get-Sha256 -Path $localDump
  $sidecarHash = [System.IO.File]::ReadAllText($localSidecar).Trim()
  if ($localHash -ne $remoteHash -or $sidecarHash -notmatch '^[a-fA-F0-9]{64}$' -or $sidecarHash.ToLowerInvariant() -ne $remoteHash) {
    throw "O hash local não corresponde ao manifesto e ao SHA-256 calculado na VPS."
  }
  if ((Get-Sha256 -Path $localSourceReceipt) -ne $sourceReceiptSha256 -or [System.IO.File]::ReadAllText($localSourceReceiptSidecar).Trim().ToLowerInvariant() -ne $sourceReceiptSha256) {
    throw "O recibo de origem local não corresponde ao hash anunciado pela VPS."
  }

  [System.IO.Directory]::CreateDirectory($temporarySyncDirectory) | Out-Null
  Set-PrivateDirectoryAcl -Path $temporarySyncDirectory
  $temporarySyncCreated = $true
  $stagedDump = Join-Path $temporarySyncDirectory $backupFileName
  $stagedSidecar = $stagedDump + ".sha256"
  $stagedSourceReceipt = Join-Path $temporarySyncDirectory $sourceReceiptFileName
  $stagedSourceReceiptSidecar = $stagedSourceReceipt + ".sha256"
  [System.IO.File]::Copy($localDump, $stagedDump, $false)
  [System.IO.File]::Copy($localSidecar, $stagedSidecar, $false)
  [System.IO.File]::Copy($localSourceReceipt, $stagedSourceReceipt, $false)
  [System.IO.File]::Copy($localSourceReceiptSidecar, $stagedSourceReceiptSidecar, $false)
  if ((Get-Sha256 -Path $stagedDump) -ne $remoteHash -or
      [System.IO.File]::ReadAllText($stagedSidecar).Trim().ToLowerInvariant() -ne $remoteHash) {
    throw "A cópia em staging não passou pela verificação SHA-256."
  }
  if ((Get-Sha256 -Path $stagedSourceReceipt) -ne $sourceReceiptSha256 -or [System.IO.File]::ReadAllText($stagedSourceReceiptSidecar).Trim().ToLowerInvariant() -ne $sourceReceiptSha256) { throw "O recibo em staging não passou pela verificação SHA-256." }

  [System.IO.Directory]::CreateDirectory($receiptDirectory) | Out-Null
  $receipt = [ordered]@{
    backupFile = $backupFileName
    sha256 = $remoteHash
    sourceReceiptFile = $sourceReceiptFileName
    sourceReceiptSha256 = $sourceReceiptSha256
    backupTimestampUtc = $backupTimestampUtc
    sourceHostAlias = $sshAlias
  }
  Write-NewUtf8File -Path $receiptPath -Content (($receipt | ConvertTo-Json -Depth 3) + [Environment]::NewLine)
  $receiptCreated = $true

  [System.IO.Directory]::Move($temporarySyncDirectory, $finalDirectory)
  $temporarySyncCreated = $false
  $published = $true
  $publishedDump = Join-Path $finalDirectory $backupFileName
  $publishedSidecar = $publishedDump + ".sha256"
  $publishedSourceReceipt = Join-Path $finalDirectory $sourceReceiptFileName
  if ((Get-Sha256 -Path $publishedDump) -ne $remoteHash -or
      [System.IO.File]::ReadAllText($publishedSidecar).Trim().ToLowerInvariant() -ne $remoteHash) {
    throw "A cópia final não passou pela verificação; ela e o recibo foram preservados para revisão."
  }

  Write-Output "LOCAL_BACKUP_FILE=$publishedDump"
  Write-Output "LOCAL_BACKUP_SHA256=$remoteHash"
  Write-Output "LOCAL_SOURCE_RECEIPT_FILE=$publishedSourceReceipt"
  Write-Output "LOCAL_SOURCE_RECEIPT_SHA256=$sourceReceiptSha256"
  Write-Output "BACKUP_SIZE_BYTES=$remoteSize"
  Write-Output "RECEIPT_FILE=$receiptPath"
  Write-Output "LOCAL_BACKUP_LOCATION=$backupRoot"
  Write-Output "LOCAL_BACKUP_COPY=complete"
} finally {
  if ($temporarySyncCreated -and (Test-Path -LiteralPath $temporarySyncDirectory -PathType Container)) {
    foreach ($stagedPath in @((Join-Path $temporarySyncDirectory $backupFileName), (Join-Path $temporarySyncDirectory ($backupFileName + ".sha256")), (Join-Path $temporarySyncDirectory $sourceReceiptFileName), (Join-Path $temporarySyncDirectory ($sourceReceiptFileName + ".sha256")))) {
      if (Test-Path -LiteralPath $stagedPath -PathType Leaf) {
        Remove-Item -LiteralPath $stagedPath -ErrorAction SilentlyContinue
      }
    }
    try {
      [System.IO.Directory]::Delete($temporarySyncDirectory, $false)
    } catch {
      Write-Warning "A pasta de staging criada por esta execução foi preservada para revisão: $temporarySyncDirectory"
    }
  }
  if ($receiptCreated -and -not $published -and (Test-Path -LiteralPath $receiptPath -PathType Leaf)) {
    Remove-Item -LiteralPath $receiptPath -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $localTransferDirectory -PathType Container) {
    foreach ($localPath in @((Join-Path $localTransferDirectory $backupFileName), (Join-Path $localTransferDirectory ($backupFileName + ".sha256")), (Join-Path $localTransferDirectory $sourceReceiptFileName), (Join-Path $localTransferDirectory ($sourceReceiptFileName + ".sha256")))) {
      if (Test-Path -LiteralPath $localPath -PathType Leaf) {
        Remove-Item -LiteralPath $localPath -ErrorAction SilentlyContinue
      }
    }
    try {
      [System.IO.Directory]::Delete($localTransferDirectory, $false)
    } catch {
      Write-Warning "A pasta temporária criada por esta execução foi preservada para revisão: $localTransferDirectory"
    }
  }
}
