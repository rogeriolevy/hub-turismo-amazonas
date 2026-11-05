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

function Get-StreamHashes {
  param(
    [System.IO.Stream]$Stream,
    [long]$ExpectedBytes,
    [string]$GitObjectFormat
  )

  $sha256 = [System.Security.Cryptography.IncrementalHash]::CreateHash([System.Security.Cryptography.HashAlgorithmName]::SHA256)
  $gitHash = $null
  if ($GitObjectFormat) {
    $algorithm = if ($GitObjectFormat -eq "sha1") {
      [System.Security.Cryptography.HashAlgorithmName]::SHA1
    } elseif ($GitObjectFormat -eq "sha256") {
      [System.Security.Cryptography.HashAlgorithmName]::SHA256
    } else {
      throw "Formato de objeto Git não suportado: $GitObjectFormat"
    }
    $gitHash = [System.Security.Cryptography.IncrementalHash]::CreateHash($algorithm)
    $header = [System.Text.UTF8Encoding]::new($false).GetBytes("blob $ExpectedBytes`0")
    $gitHash.AppendData($header)
  }

  $buffer = [byte[]]::new(65536)
  $bytes = 0L
  try {
    while (($read = $Stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $bytes += $read
      if ($bytes -gt $ExpectedBytes) {
        throw "Entrada ZIP maior do que o tamanho aprovado."
      }
      $sha256.AppendData($buffer, 0, $read)
      if ($gitHash) {
        $gitHash.AppendData($buffer, 0, $read)
      }
    }
    if ($bytes -ne $ExpectedBytes) {
      throw "Tamanho lido do ZIP diverge do tamanho declarado."
    }
    $sha256Hex = [BitConverter]::ToString($sha256.GetHashAndReset()).Replace('-', '').ToLowerInvariant()
    $gitBlob = if ($gitHash) {
      [BitConverter]::ToString($gitHash.GetHashAndReset()).Replace('-', '').ToLowerInvariant()
    } else {
      $null
    }
    [pscustomobject]@{
      Bytes = $bytes
      Sha256 = $sha256Hex
      GitBlob = $gitBlob
    }
  } finally {
    $sha256.Dispose()
    if ($gitHash) {
      $gitHash.Dispose()
    }
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
  $gitStatusLines = @(& git -C $repoRoot -c core.quotepath=false status --porcelain=v1 --untracked-files=all --no-renames)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível capturar o estado Git das fontes."
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
  foreach ($statusPath in @($gitStatusByPath.Keys)) {
    if ($gitStatusByPath[$statusPath] -eq "??" -and $statusPath -notmatch $excludedPathPattern) {
      throw "Fonte não rastreada não pode entrar no snapshot aprovado pelo Git: $statusPath"
    }
  }
  $gitHead = (& git -C $repoRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $gitHead -notmatch '^[a-f0-9]{40,64}$') {
    throw "Não foi possível identificar o commit base do snapshot."
  }
  $gitTree = (& git -C $repoRoot rev-parse "$gitHead^{tree}").Trim()
  if ($LASTEXITCODE -ne 0 -or $gitTree -notmatch '^[a-f0-9]{40,64}$') {
    throw "Não foi possível identificar a árvore de fontes do commit aprovado."
  }
  $gitObjectFormat = (& git -C $repoRoot rev-parse --show-object-format).Trim()
  if ($LASTEXITCODE -ne 0 -or $gitObjectFormat -notin @("sha1", "sha256")) {
    throw "O formato de objetos do Git não é suportado."
  }

  $treeLines = @(& git -C $repoRoot -c core.quotepath=false ls-tree -t -r --full-tree $gitHead)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível ler os arquivos do commit aprovado."
  }
  $commitFiles = [System.Collections.Generic.List[object]]::new()
  $gitTreeEntries = [System.Collections.Generic.List[object]]::new()
  $commitFileByPath = @{}
  $trackedPathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $expectedGitBlobLength = if ($gitObjectFormat -eq "sha1") { 40 } else { 64 }
  foreach ($line in $treeLines) {
    $separator = $line.IndexOf("`t")
    if ($separator -lt 1) {
      throw "A listagem da árvore Git contém uma entrada inválida."
    }
    $metadata = @($line.Substring(0, $separator).Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries))
    if ($metadata.Count -ne 3) {
      throw "A listagem da árvore Git contém metadados inválidos."
    }
    $relativePath = $line.Substring($separator + 1)
    if ([System.IO.Path]::IsPathRooted($relativePath) -or $relativePath.Contains('\') -or $relativePath.Contains('"') -or ($relativePath -split '/') -contains '..' -or ($relativePath -split '/') -contains '.') {
      throw "Caminho da árvore Git inválido ou não portável neste snapshot: $relativePath"
    }
    if ([string]::IsNullOrWhiteSpace($relativePath) -or $relativePath -match '[\x00-\x1f\x7f]') {
      throw "Caminho da árvore Git contém caracteres não representáveis com segurança."
    }
    $mode = [string]$metadata[0]
    $objectType = [string]$metadata[1]
    $gitObjectId = ([string]$metadata[2]).ToLowerInvariant()
    if ($gitObjectId -notmatch "^[a-f0-9]{$expectedGitBlobLength}$") {
      throw "Hash Git inválido na árvore aprovada: $relativePath"
    }
    $validTreeEntry = ($mode -eq "040000" -and $objectType -eq "tree") -or
      ($mode -in @("100644", "100755", "120000") -and $objectType -eq "blob") -or
      ($mode -eq "160000" -and $objectType -eq "commit")
    if (-not $validTreeEntry) {
      throw "Tipo ou modo Git não reconhecido na árvore aprovada: $relativePath"
    }
    $gitTreeEntries.Add(
      [ordered]@{
        path       = $relativePath
        mode       = $mode
        objectType = $objectType
        objectId   = $gitObjectId
      }
    )
    if ($objectType -eq "tree" -or $relativePath -match $excludedPathPattern) {
      continue
    }
    if ($objectType -ne "blob" -or $mode -notin @("100644", "100755")) {
      throw "Tipo, modo ou hash Git da fonte não é aceito: $relativePath"
    }
    if ($relativePath -eq "SOURCE-MANIFEST.json") {
      throw "A raiz do commit não pode conter SOURCE-MANIFEST.json; o nome é reservado ao manifesto do snapshot."
    }
    if (-not $trackedPathSet.Add($relativePath)) {
      throw "A árvore do commit contém caminhos incompatíveis com este sistema de arquivos: $relativePath"
    }
    $commitFile = [pscustomobject]@{
      Path = $relativePath
      Mode = $mode
      GitBlob = $gitObjectId
    }
    $commitFiles.Add($commitFile)
    $commitFileByPath[$relativePath] = $commitFile
  }
  if ($commitFiles.Count -eq 0) {
    throw "Nenhum arquivo de fonte elegível foi encontrado no commit aprovado."
  }

  foreach ($commitFile in $commitFiles) {
    $relativePath = [string]$commitFile.Path
    $rawStatus = if ($gitStatusByPath.ContainsKey($relativePath)) { [string]$gitStatusByPath[$relativePath] } else { "  " }
    if ($rawStatus -ne "  ") {
      throw "Fonte rastreada alterada ou adicionada fora do commit aprovado: $relativePath ($rawStatus)"
    }
    $sourcePath = Join-Path $repoRoot ($relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "Fonte rastreada ausente na cópia de trabalho: $relativePath"
    }
    $resolvedSourcePath = (Resolve-Path -LiteralPath $sourcePath).Path
    Assert-ContainedPath -Parent $repoRoot -Child $resolvedSourcePath -Description "A fonte"
    $sourceItem = Get-Item -LiteralPath $sourcePath -Force
    if (($sourceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Links simbólicos não são incluídos no snapshot: $relativePath"
    }
    $workingTreeBlob = (& git -C $repoRoot hash-object "--path=$relativePath" -- $sourcePath).Trim().ToLowerInvariant()
    if ($LASTEXITCODE -ne 0 -or $workingTreeBlob -ne $commitFile.GitBlob) {
      throw "O conteúdo local diverge do blob do commit aprovado: $relativePath"
    }
  }

  $gitArchivePath = Join-Path $stageDirectory "git-commit-source.zip"
  & git -C $repoRoot -c core.quotepath=false -c core.autocrlf=false -c core.eol=lf archive --format=zip "--output=$gitArchivePath" $gitHead
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $gitArchivePath -PathType Leaf)) {
    throw "Não foi possível arquivar os arquivos do commit aprovado."
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $sourceFiles = [System.Collections.Generic.List[object]]::new()
  $archiveSourcePathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $gitArchive = [System.IO.Compression.ZipFile]::OpenRead($gitArchivePath)
  try {
    foreach ($entry in $gitArchive.Entries | Where-Object { -not $_.FullName.EndsWith('/') }) {
      $relativePath = $entry.FullName.Replace('\', '/')
      if ($relativePath -match $excludedPathPattern) {
        continue
      }
      if ([System.IO.Path]::IsPathRooted($relativePath) -or ($relativePath -split '/') -contains '..' -or -not $commitFileByPath.ContainsKey($relativePath)) {
        throw "O arquivo Git archive contém um caminho não aprovado: $relativePath"
      }
      if (-not $archiveSourcePathSet.Add($relativePath)) {
        throw "O Git archive contém caminho duplicado: $relativePath"
      }
      $commitFile = $commitFileByPath[$relativePath]
      $targetPath = Join-Path $stageSource ($relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
      Assert-ContainedPath -Parent $stageSource -Child $targetPath -Description "A fonte extraída do commit"
      $targetParent = Split-Path -Parent $targetPath
      New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
      $entryStream = $entry.Open()
      $targetStream = [System.IO.File]::Open($targetPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
      try {
        $entryStream.CopyTo($targetStream)
      } finally {
        $targetStream.Dispose()
        $entryStream.Dispose()
      }
      $targetItem = Get-Item -LiteralPath $targetPath -Force
      $fileHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLowerInvariant()
      $sourceFiles.Add(
        [ordered]@{
          path          = $relativePath
          sha256        = $fileHash
          bytes         = $targetItem.Length
          gitBlob       = [string]$commitFile.GitBlob
          gitMode       = [string]$commitFile.Mode
          gitStatus     = "  "
          gitStatusLabel = "tracked"
          gitTracked    = $true
        }
      )
    }
    if ($archiveSourcePathSet.Count -ne $commitFiles.Count) {
      throw "O Git archive omitiu fontes da árvore do commit aprovado."
    }
  } finally {
    $gitArchive.Dispose()
    Remove-Item -LiteralPath $gitArchivePath -Force
  }

  if ($sourceFiles.Count -eq 0) {
    throw "Nenhum arquivo de fonte foi selecionado para o snapshot."
  }
  $sourceVerifier = $sourceFiles | Where-Object { $_.path -eq "scripts/verify-vps-source-snapshot.mjs" } | Select-Object -First 1
  if (-not $sourceVerifier) {
    throw "O snapshot precisa incluir o verificador de fontes aprovado."
  }

  $finalGitStatusLines = @(& git -C $repoRoot -c core.quotepath=false status --porcelain=v1 --untracked-files=all --no-renames)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível reconferir o estado Git após copiar as fontes."
  }
  foreach ($line in $finalGitStatusLines) {
    if ($line.Length -lt 4) {
      continue
    }
    $statusPath = $line.Substring(3).Replace('\', '/')
    if ($statusPath -notmatch $excludedPathPattern) {
      throw "O estado das fontes mudou durante a criação do snapshot: $statusPath"
    }
  }

  $manifest = [ordered]@{
    format                 = "hub-source-snapshot-v4"
    createdAtUtc           = [DateTime]::UtcNow.ToString("o")
    packageVersion         = $version
    gitHead                = $gitHead
    gitTree                = $gitTree
    gitObjectFormat         = $gitObjectFormat
    sourceArchiveMethod    = "git-archive"
    repositoryGitStatusLineCount = $gitStatusLines.Count
    sourceGitStatusLineCount = 0
    sourceGitWorkingTreeClean = $true
    excludedPathPattern    = $excludedPathPattern
    gitTreeEntries         = $gitTreeEntries
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

  & node (Join-Path $repoRoot "scripts/verify-vps-source-snapshot.mjs") $archivePath $manifestPath $gitHead $gitTree
  if ($LASTEXITCODE -ne 0) {
    throw "A verificação independente do snapshot de fontes terminou com código $LASTEXITCODE."
  }

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
      $expectedGitBlob = $null
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
        $expectedGitBlob = [string]$expectedFile.gitBlob
      }
      if ($entry.Length -ne $expectedBytes) {
        throw "Entrada ZIP ausente ou com tamanho divergente: $path"
      }
      $entryStream = $entry.Open()
      $hashes = $null
      try {
        $hashes = Get-StreamHashes -Stream $entryStream -ExpectedBytes $expectedBytes -GitObjectFormat $(if ($expectedGitBlob) { $gitObjectFormat } else { $null })
      } finally {
        $entryStream.Dispose()
      }
      if ($hashes.Sha256 -ne $expectedHash) {
        throw "SHA-256 da entrada ZIP diverge do manifesto: $path"
      }
      if ($expectedGitBlob -and $hashes.GitBlob -ne $expectedGitBlob) {
        throw "Blob Git da entrada ZIP diverge do commit aprovado: $path"
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
    GitTree         = $gitTree
    GitObjectFormat = $gitObjectFormat
    GitStatusLines  = $gitStatusLines.Count
    VerifierSha256  = [string]$sourceVerifier.sha256
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
