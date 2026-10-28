[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SyncDirectory
)

$ErrorActionPreference = "Stop"
$sshAlias = "hub-turismo-vps"
$remoteBackupDirectory = "/var/backups/hub-turismo"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$temporaryRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$scp = (Get-Command scp.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $SyncDirectory -PathType Container)) {
  throw "A pasta sincronizada precisa existir antes da exportação: $SyncDirectory"
}
$syncRoot = (Resolve-Path -LiteralPath $SyncDirectory -ErrorAction Stop).Path
$receiptDirectory = Join-Path $repositoryRoot "tmp\offsite-backup-receipts"

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
if [[ ! -f "$backup_path" || -L "$backup_path" || ! -s "$backup_path" || ! -f "$checksum_path" || -L "$checksum_path" ]]; then
  echo "O dump ou seu manifesto não existe, está vazio ou não é um arquivo regular." >&2
  exit 1
fi
expected_checksum="$(tr -d '\r\n' < "$checksum_path")"
actual_checksum="$(sha256sum < "$backup_path" | awk '{ print $1 }')"
if [[ ! "$expected_checksum" =~ ^[a-fA-F0-9]{64}$ || "$actual_checksum" != "$expected_checksum" ]]; then
  echo "O SHA-256 do dump na VPS não corresponde ao manifesto." >&2
  exit 1
fi
file_size="$(stat -c '%s' -- "$backup_path")"
if [[ ! "$file_size" =~ ^[0-9]+$ || "$file_size" -lt 1 ]]; then
  echo "O tamanho informado para o dump é inválido." >&2
  exit 1
fi
printf '%s|%s|%s\n' "$candidate" "$actual_checksum" "$file_size"
'@
$remoteMetadataCommand = ConvertTo-RemoteBashCommand -Script $remoteMetadataScript
Write-Output "Localizando o dump recente e validando o manifesto na VPS via $sshAlias."
Write-Output "Se o OpenSSH pedir, desbloqueie a chave no prompt local; nenhuma credencial é enviada ao script."
$remoteMetadataLines = Invoke-OpenSsh -Executable $ssh -Arguments @("-T", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=15", $sshAlias, $remoteMetadataCommand) -Description "A leitura do backup na VPS" -CaptureOutput
$remoteMetadata = (@($remoteMetadataLines | ForEach-Object { $_.ToString() }) -join "").Trim()
$metadataParts = $remoteMetadata -split "\|"
if ($metadataParts.Count -ne 3) {
  throw "A VPS não retornou os metadados esperados do dump; nenhum arquivo foi publicado na pasta sincronizada."
}
$backupFileName = $metadataParts[0]
$remoteHash = $metadataParts[1].ToLowerInvariant()
$remoteSize = 0L
if ($backupFileName -notmatch '^hub-(\d{8}T\d{6}Z)-\d+\.dump$') {
  throw "O nome do backup na VPS não corresponde ao formato esperado."
}
$backupTimestampUtc = $Matches[1]
if ($remoteHash -notmatch '^[a-f0-9]{64}$' -or
    -not [long]::TryParse($metadataParts[2], [ref]$remoteSize) -or
    $remoteSize -lt 1) {
  throw "Os metadados do backup na VPS são inválidos; nenhum arquivo foi publicado."
}
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($backupFileName)
$finalDirectory = Join-Path $syncRoot $baseName
$temporarySyncDirectory = Join-Path $syncRoot (".$baseName.partial-" + [guid]::NewGuid().ToString("N"))
$receiptPath = Join-Path $receiptDirectory ($backupFileName + ".json")
if (Test-Path -LiteralPath $finalDirectory) {
  throw "O destino já existe; nada foi sobrescrito: $finalDirectory"
}
if (Test-Path -LiteralPath $receiptPath) {
  throw "O recibo já existe; nada foi sobrescrito: $receiptPath"
}

$localTransferDirectory = Join-Path $temporaryRoot ("hub-offsite-export-" + [guid]::NewGuid().ToString("N"))
$receiptCreated = $false
$published = $false
$temporarySyncCreated = $false
[System.IO.Directory]::CreateDirectory($localTransferDirectory) | Out-Null
try {
  $localDump = Join-Path $localTransferDirectory $backupFileName
  $localSidecar = $localDump + ".sha256"
  $remoteDump = $sshAlias + ":" + $remoteBackupDirectory + "/" + $backupFileName
  $remoteSidecar = $sshAlias + ":" + $remoteBackupDirectory + "/" + $backupFileName + ".sha256"
  Write-Output "Baixando o dump e o manifesto para uma pasta temporária local."
  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $remoteDump, $localTransferDirectory) -Description "O download do dump"
  Invoke-OpenSsh -Executable $scp -Arguments @("-q", $remoteSidecar, $localTransferDirectory) -Description "O download do manifesto"

  if (-not (Test-Path -LiteralPath $localDump -PathType Leaf) -or
      -not (Test-Path -LiteralPath $localSidecar -PathType Leaf) -or
      (Get-Item -LiteralPath $localDump).Length -ne $remoteSize) {
    throw "Os arquivos locais não correspondem ao tamanho e aos caminhos anunciados pela VPS."
  }
  $localHash = Get-Sha256 -Path $localDump
  $sidecarHash = [System.IO.File]::ReadAllText($localSidecar).Trim()
  if ($localHash -ne $remoteHash -or $sidecarHash -notmatch '^[a-fA-F0-9]{64}$' -or $sidecarHash.ToLowerInvariant() -ne $remoteHash) {
    throw "O hash local não corresponde ao manifesto e ao SHA-256 calculado na VPS."
  }

  [System.IO.Directory]::CreateDirectory($temporarySyncDirectory) | Out-Null
  $temporarySyncCreated = $true
  $stagedDump = Join-Path $temporarySyncDirectory $backupFileName
  $stagedSidecar = $stagedDump + ".sha256"
  [System.IO.File]::Copy($localDump, $stagedDump, $false)
  [System.IO.File]::Copy($localSidecar, $stagedSidecar, $false)
  if ((Get-Sha256 -Path $stagedDump) -ne $remoteHash -or
      [System.IO.File]::ReadAllText($stagedSidecar).Trim().ToLowerInvariant() -ne $remoteHash) {
    throw "A cópia em staging não passou pela verificação SHA-256."
  }

  [System.IO.Directory]::CreateDirectory($receiptDirectory) | Out-Null
  $receipt = [ordered]@{
    backupFile = $backupFileName
    sha256 = $remoteHash
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
  if ((Get-Sha256 -Path $publishedDump) -ne $remoteHash -or
      [System.IO.File]::ReadAllText($publishedSidecar).Trim().ToLowerInvariant() -ne $remoteHash) {
    throw "A cópia final não passou pela verificação; ela e o recibo foram preservados para revisão."
  }

  Write-Output "BACKUP_FILE=$publishedDump"
  Write-Output "BACKUP_SHA256=$remoteHash"
  Write-Output "BACKUP_SIZE_BYTES=$remoteSize"
  Write-Output "RECEIPT_FILE=$receiptPath"
  Write-Output "SYNC_CONFIRMATION_REQUIRED=aguarde o cliente e confirme a sincronização antes de baixar uma cópia nova pelo portal."
} finally {
  if ($temporarySyncCreated -and (Test-Path -LiteralPath $temporarySyncDirectory -PathType Container)) {
    foreach ($stagedPath in @((Join-Path $temporarySyncDirectory $backupFileName), (Join-Path $temporarySyncDirectory ($backupFileName + ".sha256")))) {
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
    foreach ($localPath in @((Join-Path $localTransferDirectory $backupFileName), (Join-Path $localTransferDirectory ($backupFileName + ".sha256")))) {
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
