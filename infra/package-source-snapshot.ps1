[CmdletBinding()]
param(
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$temporaryRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "tmp"))
if (-not (Test-Path -LiteralPath $temporaryRoot -PathType Container)) {
  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
}

function Assert-ContainedPath {
  param(
    [string]$Parent,
    [string]$Child,
    [string]$Description
  )

  $resolvedParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $resolvedChild = [System.IO.Path]::GetFullPath($Child)
  $parentPath = $resolvedParent.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  if ($resolvedChild -ne $parentPath -and -not $resolvedChild.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Description precisa ficar dentro de tmp: $resolvedChild"
  }
}

$packageInfo = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$packageInfo.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Versão inválida em package.json: $version"
}

if (-not $OutputDirectory) {
  $OutputDirectory = $temporaryRoot
}
$requestedOutput = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDirectory))
}
Assert-ContainedPath -Parent $temporaryRoot -Child $requestedOutput -Description "A pasta de saída"
if (-not (Test-Path -LiteralPath $requestedOutput -PathType Container)) {
  New-Item -ItemType Directory -Path $requestedOutput | Out-Null
}
$outputItem = Get-Item -LiteralPath $requestedOutput -Force
if (($outputItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "A pasta de saída não pode ser um link ou junction: $requestedOutput"
}
$outputRoot = (Resolve-Path -LiteralPath $requestedOutput).Path
Assert-ContainedPath -Parent $temporaryRoot -Child $outputRoot -Description "A pasta de saída resolvida"

$timestamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$snapshotName = "source-snapshot-$version-$timestamp"
$snapshotDirectory = Join-Path $outputRoot $snapshotName
$stageDirectory = Join-Path $outputRoot ".source-snapshot-$version-$timestamp-$([Guid]::NewGuid().ToString('N')).tmp"
Assert-ContainedPath -Parent $temporaryRoot -Child $snapshotDirectory -Description "O destino final"
Assert-ContainedPath -Parent $temporaryRoot -Child $stageDirectory -Description "A pasta temporária"
if (Test-Path -LiteralPath $snapshotDirectory) {
  throw "O destino do snapshot já existe; aguarde um segundo e tente novamente: $snapshotDirectory"
}

$stageSource = Join-Path $stageDirectory "source"
$ownedTemporary = $false
try {
  New-Item -ItemType Directory -Path $stageSource -Force | Out-Null
  $ownedTemporary = $true
  Assert-ContainedPath -Parent $temporaryRoot -Child (Resolve-Path -LiteralPath $stageDirectory).Path -Description "A pasta temporária resolvida"

  $excludedPathPattern = '(^|/)(\.git|node_modules|\.next|tmp|data|backups|output|coverage|test-results|public/uploads|\.planning|\.codex|\.agents|\.sites-runtime|\.vercel|\.ssh|secrets|credentials)(/|$)|(^|/)\.env[^/]*$|(^|/)[^/]+\.env$|(^|/)\.npmrc$|(^|/)(authorized_keys|known_hosts)$|(^|/)(id_rsa|id_ed25519|id_ecdsa|id_dsa)(\.pub)?$|(^|/)[^/]*\.(sqlite|pem|key|p12|pfx|ppk|crt|p7b|secret)([-.].*)?$'
  $gitPaths = @(& git -C $repoRoot -c core.quotepath=false ls-files --cached --others --exclude-standard)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível listar as fontes pelo Git."
  }
  $gitStatusLines = @(& git -C $repoRoot -c core.quotepath=false status --porcelain=v1 --untracked-files=all --no-renames)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível capturar o estado Git das fontes."
  }
  $trackedPaths = @(& git -C $repoRoot -c core.quotepath=false ls-files --cached)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível identificar as fontes rastreadas pelo Git."
  }

  $gitStatusByPath = @{}
  foreach ($line in $gitStatusLines) {
    if ($line.Length -lt 4) {
      continue
    }
    $statusCode = $line.Substring(0, 2)
    $statusPath = $line.Substring(3).Replace('\', '/')
    $gitStatusByPath[$statusPath] = $statusCode
  }
  $trackedPathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($trackedPath in $trackedPaths) {
    [void]$trackedPathSet.Add(([string]$trackedPath).Replace('\', '/'))
  }

  $sourceFiles = [System.Collections.Generic.List[object]]::new()
  foreach ($gitPath in ($gitPaths | Sort-Object -Unique)) {
    $relativePath = ([string]$gitPath).Replace('\', '/')
    if ($relativePath -match $excludedPathPattern) {
      continue
    }
    if ([System.IO.Path]::IsPathRooted($relativePath) -or ($relativePath -split '/') -contains '..') {
      throw "Caminho de fonte inválido: $relativePath"
    }

    $sourcePath = Join-Path $repoRoot ($relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      continue
    }
    $resolvedSourcePath = (Resolve-Path -LiteralPath $sourcePath).Path
    Assert-ContainedPath -Parent $repoRoot -Child $resolvedSourcePath -Description "A fonte"
    $sourceItem = Get-Item -LiteralPath $sourcePath -Force
    if (($sourceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Links simbólicos não são incluídos no snapshot: $relativePath"
    }

    $rawStatus = if ($gitStatusByPath.ContainsKey($relativePath)) { [string]$gitStatusByPath[$relativePath] } else { "  " }
    $statusLabel = if ($rawStatus -eq "??") {
      "untracked"
    } elseif ($rawStatus.Contains('U')) {
      "conflicted"
    } elseif ($rawStatus.Contains('A')) {
      "added"
    } elseif ($rawStatus.Contains('R')) {
      "renamed"
    } elseif ($rawStatus.Contains('M')) {
      "modified"
    } else {
      "tracked"
    }

    $targetPath = Join-Path $stageSource ($relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    $targetParent = Split-Path -Parent $targetPath
    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath
    $fileHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $sourceFiles.Add(
      [ordered]@{
        path          = $relativePath
        sha256        = $fileHash
        bytes         = $sourceItem.Length
        gitStatus     = $rawStatus
        gitStatusLabel = $statusLabel
        gitTracked    = $trackedPathSet.Contains($relativePath)
      }
    )
  }

  if ($sourceFiles.Count -eq 0) {
    throw "Nenhum arquivo de fonte foi selecionado para o snapshot."
  }

  $gitHead = (& git -C $repoRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível identificar o commit base do snapshot."
  }
  $manifest = [ordered]@{
    format                 = "hub-source-snapshot-v1"
    createdAtUtc           = [DateTime]::UtcNow.ToString("o")
    packageVersion         = $version
    gitHead                = $gitHead
    gitStatusLineCount     = $gitStatusLines.Count
    gitWorkingTreeClean    = ($gitStatusLines.Count -eq 0)
    excludedPathPattern    = $excludedPathPattern
    sourceFileCount        = $sourceFiles.Count
    files                  = $sourceFiles
  }
  $manifestPath = Join-Path $stageSource "SOURCE-MANIFEST.json"
  [System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifest | ConvertTo-Json -Depth 8),
    [System.Text.UTF8Encoding]::new($false)
  )

  $archivePath = Join-Path $stageDirectory "hub-turismo-amazonas-$version-source.zip"
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stageSource,
    $archivePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
  $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText(
    "$archivePath.sha256",
    "$archiveHash  $([System.IO.Path]::GetFileName($archivePath))$([Environment]::NewLine)",
    [System.Text.UTF8Encoding]::new($false)
  )

  $zipFile = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $archiveEntries = @($zipFile.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName.Replace('\', '/') })
    $unsafeEntries = @($archiveEntries | Where-Object { $_ -match $excludedPathPattern })
    if ($unsafeEntries.Count -gt 0) {
      throw "O arquivo ZIP contém caminhos excluídos: $($unsafeEntries -join ', ')"
    }
    $expectedEntries = @($sourceFiles | ForEach-Object { $_.path }) + "SOURCE-MANIFEST.json"
    if ($archiveEntries.Count -ne $expectedEntries.Count -or @($archiveEntries | Where-Object { $_ -notin $expectedEntries }).Count -gt 0) {
      throw "O ZIP de fontes não corresponde à lista do manifesto."
    }
    $manifestItem = Get-Item -LiteralPath $manifestPath
    $manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $verifiedArchiveEntries = 0
    foreach ($entry in $zipFile.Entries | Where-Object { -not $_.FullName.EndsWith('/') }) {
      $path = $entry.FullName.Replace('\', '/')
      if ($path -eq "SOURCE-MANIFEST.json") {
        $expectedHash = $manifestHash
        $expectedBytes = $manifestItem.Length
      } else {
        $expectedFile = $sourceFiles | Where-Object { $_.path -eq $path } | Select-Object -First 1
        if (-not $expectedFile) {
          throw "Entrada ZIP não descrita no manifesto: $path"
        }
        $expectedHash = [string]$expectedFile.sha256
        $expectedBytes = [long]$expectedFile.bytes
      }
      if ($entry.Length -ne $expectedBytes) {
        throw "Entrada ZIP ausente ou com tamanho divergente: $path"
      }
      $entryStream = $entry.Open()
      $entrySha256 = [System.Security.Cryptography.SHA256]::Create()
      try {
        $entryHash = [BitConverter]::ToString($entrySha256.ComputeHash($entryStream)).Replace('-', '').ToLowerInvariant()
      } finally {
        $entrySha256.Dispose()
        $entryStream.Dispose()
      }
      if ($entryHash -ne $expectedHash) {
        throw "SHA-256 da entrada ZIP diverge do manifesto: $path"
      }
      $verifiedArchiveEntries++
    }
    if ($verifiedArchiveEntries -ne $expectedEntries.Count) {
      throw "A quantidade de entradas ZIP verificadas diverge da lista do manifesto."
    }
  } finally {
    $zipFile.Dispose()
  }

  if (Test-Path -LiteralPath $snapshotDirectory) {
    throw "O destino final apareceu durante a preparação; nenhum arquivo foi sobrescrito: $snapshotDirectory"
  }
  [System.IO.Directory]::Move($stageDirectory, $snapshotDirectory)
  $ownedTemporary = $false
  $finalSource = Join-Path $snapshotDirectory "source"
  $finalArchive = Join-Path $snapshotDirectory "hub-turismo-amazonas-$version-source.zip"
  [pscustomobject]@{
    Directory       = $snapshotDirectory
    SourceDirectory = $finalSource
    ManifestPath    = Join-Path $finalSource "SOURCE-MANIFEST.json"
    Archive         = $finalArchive
    ArchiveSha256   = $archiveHash
    ArchiveEntriesVerified = $verifiedArchiveEntries
    SourceFiles     = $sourceFiles.Count
    GitHead         = $gitHead
    GitStatusLines  = $gitStatusLines.Count
  }
} catch {
  $failure = $_
  if ($ownedTemporary -and (Test-Path -LiteralPath $stageDirectory -PathType Container)) {
    $resolvedStage = (Resolve-Path -LiteralPath $stageDirectory).Path
    Assert-ContainedPath -Parent $temporaryRoot -Child $resolvedStage -Description "A limpeza temporária"
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
  }
  throw $failure
}
