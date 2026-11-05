[CmdletBinding()]
param(
  [string]$OutputDirectory = ".\tmp\vps-release-0.12.6-phase1-review"
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

  $resolvedParent = [System.IO.Path]::GetFullPath($Parent)
  $parentPrefix = $resolvedParent.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $resolvedChild = [System.IO.Path]::GetFullPath($Child)
  $parentPath = $parentPrefix.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  if ($resolvedChild -ne $parentPath -and -not $resolvedChild.StartsWith($parentPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Description precisa ficar dentro de tmp: $resolvedChild"
  }
}

function Invoke-CheckedCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Description
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description terminou com código $LASTEXITCODE."
  }
}

function Get-DockerImageMetadata {
  param([string]$Tag)

  $raw = $null
  $dockerExitCode = 1
  try {
    $raw = & docker image inspect --format "{{.Id}}|{{.Size}}|{{.Config.User}}" $Tag 2>$null
    $dockerExitCode = $LASTEXITCODE
  } catch {
    $dockerExitCode = 1
  }
  if ($dockerExitCode -ne 0) {
    throw "Docker não conseguiu inspecionar a imagem $Tag."
  }
  $parts = ([string]$raw).Trim().Split('|')
  if ($parts.Count -ne 3 -or $parts[0] -notmatch '^sha256:[a-f0-9]{64}$' -or $parts[1] -notmatch '^\d+$') {
    throw "Docker retornou metadados inválidos para $Tag."
  }
  [pscustomobject]@{
    Id = $parts[0]
    Bytes = [long]$parts[1]
    User = $parts[2]
  }
}

$packageInfo = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$packageInfo.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Versão inválida em package.json: $version"
}

$requestedOutput = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDirectory))
}
Assert-ContainedPath -Parent $temporaryRoot -Child $requestedOutput -Description "A pasta da candidata"
if (Test-Path -LiteralPath $requestedOutput) {
  throw "O destino final já existe; nenhuma alteração foi feita: $requestedOutput"
}
$outputParent = Split-Path -Parent $requestedOutput
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
  New-Item -ItemType Directory -Path $outputParent | Out-Null
}
$outputParentItem = Get-Item -LiteralPath $outputParent -Force
if (($outputParentItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "A pasta-pai do destino não pode ser um link ou junction: $outputParent"
}
$outputParent = (Resolve-Path -LiteralPath $outputParent).Path
$requestedOutput = Join-Path $outputParent (Split-Path -Leaf $requestedOutput)
Assert-ContainedPath -Parent $temporaryRoot -Child $outputParent -Description "A pasta-pai resolvida"
Assert-ContainedPath -Parent $temporaryRoot -Child $requestedOutput -Description "O destino final resolvido"
if (Test-Path -LiteralPath $requestedOutput) {
  throw "O destino final já existe; nenhuma alteração foi feita: $requestedOutput"
}

$dockerServer = $null
$dockerReady = $false
try {
  $dockerServer = & docker info --format "{{.ServerVersion}}" 2>$null
  $dockerReady = ($LASTEXITCODE -eq 0 -and [bool]$dockerServer)
} catch {
  $dockerReady = $false
}
if (-not $dockerReady) {
  throw "Docker Engine indisponível. Inicie um engine local (Docker Desktop, WSL2 ou equivalente) e execute novamente; nenhum bundle foi criado."
}

$temporaryDirectory = Join-Path $outputParent ".vps-release-$version-$([Guid]::NewGuid().ToString('N')).tmp"
Assert-ContainedPath -Parent $temporaryRoot -Child $temporaryDirectory -Description "A pasta temporária da candidata"
if (Test-Path -LiteralPath $temporaryDirectory) {
  throw "A pasta temporária aleatória já existe; tente novamente."
}
$ownedTemporary = $false
try {
  New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
  $ownedTemporary = $true
  Assert-ContainedPath -Parent $temporaryRoot -Child (Resolve-Path -LiteralPath $temporaryDirectory).Path -Description "A pasta temporária resolvida"

  $snapshotScript = Join-Path $PSScriptRoot "package-source-snapshot.ps1"
  $snapshotResult = & $snapshotScript -OutputDirectory $temporaryRoot
  if (-not $snapshotResult -or -not $snapshotResult.SourceDirectory -or -not $snapshotResult.Archive) {
    throw "O gerador não retornou um snapshot completo."
  }
  $snapshotDirectory = [System.IO.Path]::GetFullPath([string]$snapshotResult.Directory)
  $sourceDirectory = [System.IO.Path]::GetFullPath([string]$snapshotResult.SourceDirectory)
  Assert-ContainedPath -Parent $temporaryRoot -Child $snapshotDirectory -Description "O snapshot de fontes"
  Assert-ContainedPath -Parent $snapshotDirectory -Child $sourceDirectory -Description "A pasta de fontes do snapshot"
  $sourceManifestPath = Join-Path $sourceDirectory "SOURCE-MANIFEST.json"
  $sourceManifestBytes = [System.IO.File]::ReadAllBytes($sourceManifestPath)
  $sourceManifestSha256 = (Get-FileHash -LiteralPath $sourceManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $sourceManifest = [System.Text.Encoding]::UTF8.GetString($sourceManifestBytes) | ConvertFrom-Json
  if ($sourceManifest.packageVersion -ne $version -or $sourceManifest.sourceFileCount -ne $sourceManifest.files.Count) {
    throw "O manifesto de fontes não corresponde à versão ou à contagem esperada."
  }

  $environmentExample = Join-Path $sourceDirectory "infra/vps.env.example"
  $composeFile = Join-Path $sourceDirectory "infra/compose.vps.yaml"
  if (-not (Test-Path -LiteralPath $environmentExample -PathType Leaf) -or -not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "O snapshot não contém o modelo de ambiente ou o Compose VPS necessário para compilar."
  }
  $exampleVersion = Get-Content -LiteralPath $environmentExample | Where-Object { $_ -match '^APP_VERSION=' } | Select-Object -First 1
  if ($exampleVersion -ne "APP_VERSION=$version") {
    throw "APP_VERSION no modelo infra/vps.env.example não corresponde a $version."
  }

  $imageTag = "hub-turismo-amazonas:$version"
  $buildCommand = "docker compose --env-file infra/vps.env.example -f infra/compose.vps.yaml build web"
  Write-Output "== Construindo $imageTag a partir de $($snapshotResult.Directory) =="
  Push-Location $sourceDirectory
  try {
    Invoke-CheckedCommand -FilePath "docker" -Arguments @("compose", "--env-file", "infra/vps.env.example", "-f", "infra/compose.vps.yaml", "build", "web") -Description "O build da imagem VPS"
  } finally {
    Pop-Location
  }

  $imageMetadata = Get-DockerImageMetadata -Tag $imageTag
  if ($imageMetadata.User -ne "node") {
    throw "A imagem $imageTag precisa usar o usuário node."
  }
  if ($imageMetadata.Bytes -gt 550000000) {
    throw "A imagem $imageTag excede o limite de 550000000 bytes."
  }

  $runtimeManifestPath = Join-Path $temporaryDirectory "runtime-manifest.json"
  $runtimeManifest = [ordered]@{
    status = "local-candidate-not-deployed"
    appVersion = $version
    imageTag = $imageTag
    composeExpectedTag = $imageTag
    imageId = $imageMetadata.Id
    imageBytes = $imageMetadata.Bytes
    runtimeUser = $imageMetadata.User
  }
  [System.IO.File]::WriteAllText($runtimeManifestPath, ($runtimeManifest | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false))
  $runtimeOutput = Invoke-CheckedCommand -FilePath "node" -Arguments @((Join-Path $repoRoot "scripts/verify-vps-runtime-image.mjs"), "--manifest", $runtimeManifestPath) -Description "A verificação isolada da imagem VPS"
  $runtimeResult = ([string]($runtimeOutput | Select-Object -Last 1)) | ConvertFrom-Json

  $imageArchiveName = "hub-turismo-amazonas-$version-image.tar"
  $imageArchivePath = Join-Path $temporaryDirectory $imageArchiveName
  Invoke-CheckedCommand -FilePath "docker" -Arguments @("save", "--output", $imageArchivePath, $imageTag) -Description "A exportação da imagem"
  Invoke-CheckedCommand -FilePath "docker" -Arguments @("load", "--input", $imageArchivePath) -Description "O ensaio local de leitura da imagem exportada"
  $loadedImage = Get-DockerImageMetadata -Tag $imageTag
  if ($loadedImage.Id -ne $imageMetadata.Id) {
    throw "A identidade da imagem carregada difere do build original."
  }
  Remove-Item -LiteralPath $runtimeManifestPath -Force

  $sourceArchiveName = "hub-turismo-amazonas-$version-source.zip"
  $sourceArchivePath = Join-Path $temporaryDirectory $sourceArchiveName
  Copy-Item -LiteralPath ([string]$snapshotResult.Archive) -Destination $sourceArchivePath
  Copy-Item -LiteralPath $sourceManifestPath -Destination (Join-Path $temporaryDirectory "SOURCE-MANIFEST.json")
  $releaseNotesName = "$version-release-notes.md"
  Copy-Item -LiteralPath (Join-Path $sourceDirectory "docs/releases/$version.md") -Destination (Join-Path $temporaryDirectory $releaseNotesName)

  $imageArchiveHash = (Get-FileHash -LiteralPath $imageArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $sourceArchiveHash = (Get-FileHash -LiteralPath $sourceArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $releaseNotesPath = Join-Path $temporaryDirectory $releaseNotesName
  $readmePath = Join-Path $temporaryDirectory "README.md"
  $readme = @"
# Candidata local $version

Status: somente local, não publicada. A produção foi verificada em 0.12.0; este pacote não altera a VPS.

Esta candidata reúne a imagem e as fontes do mesmo snapshot: ``$($snapshotResult.Directory)``.
O manifesto fixa commit, árvore e blobs aprovados; as fontes vêm de ``git archive`` do commit. O gerador compara a cópia local diretamente aos blobs (inclusive com ``assume-unchanged``), recusa fontes não rastreadas e confere SHA-256 e IDs de blob em cada entrada do ZIP.

- ``databaseMigration: false``; nenhum dado ou schema foi alterado.
- ``externalBackupValidated: false``; não transferir nem publicar até validar uma cópia externa e uma restauração isolada.
- A origem oficial ``data/hub.sqlite`` e os uploads foram excluídos do pacote.
"@
  [System.IO.File]::WriteAllText($readmePath, $readme, [System.Text.UTF8Encoding]::new($false))

  $gitStatusCount = [int]$sourceManifest.sourceGitStatusLineCount
  $repoPrefix = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $relativeSourceDirectory = $sourceDirectory.Substring($repoPrefix.Length).Replace('\', '/') + '/'
  $manifest = [ordered]@{
    format = "hub-vps-release-bundle-v1"
    createdAtUtc = [DateTime]::UtcNow.ToString("o")
    status = "local-candidate-not-deployed"
    productionVersion = "0.12.0"
    appVersion = $version
    imageTag = $imageTag
    buildImageTag = $imageTag
    imageId = $imageMetadata.Id
    imageBytes = $imageMetadata.Bytes
    runtimeUser = $imageMetadata.User
    runtimeHealthcheckScriptPresent = [bool]$runtimeResult.healthcheckScriptPresent
    runtimeDevDependenciesPresent = [bool]$runtimeResult.devDependenciesPresent
    runtimeForbiddenPackageScan = if (@($runtimeResult.forbiddenPackages).Count -eq 0) { "passed" } else { "failed" }
    runtimeImageVerifier = "passed"
    runtimeImageSizeLimitBytes = 550000000
    imageArchive = $imageArchiveName
    imageArchiveBytes = (Get-Item -LiteralPath $imageArchivePath).Length
    imageArchiveSha256 = $imageArchiveHash
    imageArchiveSha256Sidecar = "$imageArchiveName.sha256"
    imageArchiveLoadVerified = $true
    buildCommand = $buildCommand
    buildSourceSnapshotDirectory = $relativeSourceDirectory
    sourceArchive = $sourceArchiveName
    sourceArchiveBytes = (Get-Item -LiteralPath $sourceArchivePath).Length
    sourceArchiveSha256 = $sourceArchiveHash
    sourceArchiveSha256Sidecar = "$sourceArchiveName.sha256"
    sourceSnapshotManifest = "SOURCE-MANIFEST.json"
    sourceSnapshotManifestSha256 = $sourceManifestSha256
    sourceGitBaseCommit = [string]$sourceManifest.gitHead
    sourceGitTree = [string]$sourceManifest.gitTree
    sourceGitObjectFormat = [string]$sourceManifest.gitObjectFormat
    sourceArchiveMethod = [string]$sourceManifest.sourceArchiveMethod
    sourceGitWorkingTreeClean = [bool]$sourceManifest.sourceGitWorkingTreeClean
    sourceGitStatusLineCount = $gitStatusCount
    sourceFileCount = [int]$sourceManifest.sourceFileCount
    sourceFiles = @($sourceManifest.files)
    adoptedReleaseTools = @(
      "infra/package-source-snapshot.ps1",
      "infra/package-vps-release-bundle.ps1",
      "scripts/verify-vps-source-snapshot.mjs",
      "scripts/verify-vps-release-bundle.mjs",
      "scripts/verify-vps-runtime-image.mjs"
    )
    databaseMigration = $false
    composeExpectedTag = $imageTag
    releaseNotes = $releaseNotesName
    releaseNotesSha256 = (Get-FileHash -LiteralPath $releaseNotesPath -Algorithm SHA256).Hash.ToLowerInvariant()
    readme = "README.md"
    readmeSha256 = (Get-FileHash -LiteralPath $readmePath -Algorithm SHA256).Hash.ToLowerInvariant()
    imageArchiveLoadImageId = $loadedImage.Id
    imageArchiveLoadVerifiedAtUtc = [DateTime]::UtcNow.ToString("o")
    externalBackupValidated = $false
  }

  $manifestPath = Join-Path $temporaryDirectory "manifest.json"
  [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
  foreach ($sidecar in @(
    @{ Path = $manifestPath; Name = "manifest.json" },
    @{ Path = $imageArchivePath; Name = $imageArchiveName },
    @{ Path = $sourceArchivePath; Name = $sourceArchiveName }
  )) {
    $hash = (Get-FileHash -LiteralPath $sidecar.Path -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText(
      "$($sidecar.Path).sha256",
      "$hash  $($sidecar.Name)$([Environment]::NewLine)",
      [System.Text.UTF8Encoding]::new($false)
    )
  }

  Write-Output "== Validando pacote temporário antes de publicá-lo localmente =="
  Invoke-CheckedCommand -FilePath "node" -Arguments @((Join-Path $repoRoot "scripts/verify-vps-release-bundle.mjs"), $temporaryDirectory) -Description "A verificação do bundle"
  if (Test-Path -LiteralPath $requestedOutput) {
    throw "O destino final apareceu durante a preparação; nenhum arquivo foi sobrescrito: $requestedOutput"
  }
  [System.IO.Directory]::Move($temporaryDirectory, $requestedOutput)
  $ownedTemporary = $false
  Write-Output "Candidata local criada: $requestedOutput"
  Write-Output "PUBLICAÇÃO PENDENTE: externalBackupValidated=false; nenhuma transferência à VPS foi executada."
} catch {
  $failure = $_
  if ($ownedTemporary -and (Test-Path -LiteralPath $temporaryDirectory -PathType Container)) {
    $resolvedTemporary = (Resolve-Path -LiteralPath $temporaryDirectory).Path
    Assert-ContainedPath -Parent $temporaryRoot -Child $resolvedTemporary -Description "A limpeza temporária"
    Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force
  }
  throw $failure
}
