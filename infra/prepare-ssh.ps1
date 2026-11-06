[CmdletBinding()]
param(
  [string]$HostName,
  [string]$UserName,
  [ValidateRange(1, 65535)]
  [int]$Port = 22,
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*$')]
  [string]$Alias = "hub-turismo-vps",
  [string]$IdentityFile,
  [string]$PublicKeyFile,
  [switch]$CreateKeyOnly
)

$ErrorActionPreference = "Stop"

$sshKeygen = Get-Command "ssh-keygen.exe" -ErrorAction SilentlyContinue
if (-not $sshKeygen) {
  $sshKeygen = Get-Command "ssh-keygen" -ErrorAction SilentlyContinue
}
if (-not $sshKeygen) {
  throw "O OpenSSH não está disponível neste computador. Habilite o cliente OpenSSH do Windows e tente novamente."
}

$sshDirectory = Join-Path $env:USERPROFILE ".ssh"
$useCustomIdentity = -not [string]::IsNullOrWhiteSpace($IdentityFile)
if ($useCustomIdentity) {
  $resolvedIdentity = Resolve-Path -LiteralPath $IdentityFile -ErrorAction Stop
  if ($resolvedIdentity.Provider.Name -ne "FileSystem" -or -not (Test-Path -LiteralPath $resolvedIdentity.Path -PathType Leaf)) {
    throw "A chave privada informada precisa ser um arquivo local: $IdentityFile"
  }
  $privateKeyPath = $resolvedIdentity.ProviderPath
} else {
  $privateKeyPath = Join-Path $sshDirectory "hub-turismo-vps"
}
if (-not [string]::IsNullOrWhiteSpace($PublicKeyFile)) {
  $resolvedPublicKey = Resolve-Path -LiteralPath $PublicKeyFile -ErrorAction Stop
  if ($resolvedPublicKey.Provider.Name -ne "FileSystem" -or -not (Test-Path -LiteralPath $resolvedPublicKey.Path -PathType Leaf)) {
    throw "A chave pública informada precisa ser um arquivo local: $PublicKeyFile"
  }
  $publicKeyPath = $resolvedPublicKey.ProviderPath
} else {
  $publicKeyPath = "$privateKeyPath.pub"
}
$configPath = Join-Path $sshDirectory "config"

if (-not $useCustomIdentity -and -not (Test-Path -LiteralPath $sshDirectory)) {
  New-Item -ItemType Directory -Path $sshDirectory | Out-Null
}

function Ensure-SshKeyPair {
  $privatePathExists = Test-Path -LiteralPath $privateKeyPath
  $publicPathExists = Test-Path -LiteralPath $publicKeyPath
  if ($privatePathExists -and -not (Test-Path -LiteralPath $privateKeyPath -PathType Leaf)) {
    throw "O caminho da chave privada existe, mas não é um arquivo: $privateKeyPath"
  }
  if ($publicPathExists -and -not (Test-Path -LiteralPath $publicKeyPath -PathType Leaf)) {
    throw "O caminho da chave pública existe, mas não é um arquivo: $publicKeyPath"
  }
  if (-not $useCustomIdentity -and ($privatePathExists -xor $publicPathExists)) {
    throw "O par SSH está incompleto em $sshDirectory. Ele foi preservado; revise os dois arquivos manualmente."
  }

  if (-not $privatePathExists) {
    if ($useCustomIdentity) {
      throw "O arquivo da chave privada informada não existe: $privateKeyPath"
    }
    Write-Host "O ssh-keygen solicitará uma frase-senha. Ela protege a chave privada e não deve ser compartilhada."
    $keygenArguments = @("-t", "ed25519", "-a", "64", "-f", $privateKeyPath, "-C", $Alias)
    $null = & $sshKeygen.Source @keygenArguments
    if ($LASTEXITCODE -ne 0) {
      throw "A criação da chave SSH falhou. Nenhuma configuração de conexão foi adicionada."
    }
    $privatePathExists = Test-Path -LiteralPath $privateKeyPath
    $publicPathExists = Test-Path -LiteralPath $publicKeyPath
  } elseif (-not $useCustomIdentity) {
    Write-Host "O par SSH existente será reutilizado sem alteração."
  } else {
    Write-Host "A chave privada informada será reutilizada sem alteração."
  }

  if ($publicPathExists) {
    $publicKey = [System.IO.File]::ReadAllText($publicKeyPath).Trim()
    if ($publicKey -notmatch '^ssh-ed25519\s+[A-Za-z0-9+/]+={0,2}(?:\s|$)') {
      throw "A chave pública não tem o formato Ed25519 esperado; nenhum arquivo foi alterado."
    }
    $publicFingerprintOutput = (& $sshKeygen.Source -lf $publicKeyPath 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível conferir a impressão digital da chave pública; nenhum arquivo foi alterado."
    }
    $publicFingerprint = [System.Text.RegularExpressions.Regex]::Match(
      $publicFingerprintOutput,
      'SHA256:[A-Za-z0-9+/]+'
    ).Value
    $privateFingerprintOutput = (& $sshKeygen.Source -lf $privateKeyPath 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível conferir a impressão digital da chave privada; nenhum arquivo foi alterado."
    }
    $privateFingerprint = [System.Text.RegularExpressions.Regex]::Match(
      $privateFingerprintOutput,
      'SHA256:[A-Za-z0-9+/]+'
    ).Value
    if (-not $publicFingerprint -or -not $privateFingerprint -or $publicFingerprint -ne $privateFingerprint) {
      throw "A chave pública não corresponde à chave privada; nenhum arquivo foi alterado."
    }
  } else {
    Write-Host "Derivando a chave pública da privada. O ssh-keygen pode solicitar a frase-senha local."
    $publicKey = (& $sshKeygen.Source -y -f $privateKeyPath | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível derivar a chave pública; nenhum arquivo foi alterado. Se a chave estiver protegida por frase-senha, informe seu .pub com -PublicKeyFile."
    }
    if ($publicKey -notmatch '^ssh-ed25519\s+[A-Za-z0-9+/]+={0,2}(?:\s|$)') {
      throw "A chave privada não produziu uma chave pública Ed25519 válida; nenhum arquivo foi alterado."
    }
  }
  return $publicKey
}

if ($CreateKeyOnly) {
  $publicKey = Ensure-SshKeyPair
  Write-Host ""
  Write-Host "Chave pública para guardar e cadastrar em ~/.ssh/authorized_keys quando a conta VPS estiver pronta:"
  Write-Host $publicKey
  Write-Host ""
  Write-Host "Nenhum bloco foi acrescentado ao config SSH. Quando souber o host e o usuário, execute o assistente sem -CreateKeyOnly."
  Write-Host "A chave privada permanece neste computador, em $privateKeyPath."
  return
}

if ([string]::IsNullOrWhiteSpace($HostName)) {
  $HostName = Read-Host "IP ou hostname da VPS"
}
if ($HostName -notmatch '^[A-Za-z0-9:][A-Za-z0-9.:_%\-]*$') {
  throw "Informe um hostname, IPv4 ou IPv6 sem espaços nem opções SSH."
}

if ([string]::IsNullOrWhiteSpace($UserName)) {
  $UserName = Read-Host "Usuário SSH da VPS"
}
if ($UserName -notmatch '^[A-Za-z_][A-Za-z0-9_.-]*$') {
  throw "O usuário SSH deve conter somente letras, números, ponto, hífen e sublinhado."
}
if ($UserName -eq "root") {
  throw "Use uma conta administrativa própria; o procedimento da VPS não usa login SSH direto como root."
}

$configText = ""
if (Test-Path -LiteralPath $configPath) {
  $configText = [System.IO.File]::ReadAllText($configPath)
  foreach ($line in ($configText -split '\r?\n')) {
    $hostDirective = [System.Text.RegularExpressions.Regex]::Match(
      $line,
      '^\s*Host\s+(.+)$',
      [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if (-not $hostDirective.Success) { continue }

    foreach ($pattern in ($hostDirective.Groups[1].Value -split '\s+')) {
      if (-not $pattern -or $pattern.StartsWith("!")) { continue }
      $wildcard = [System.Management.Automation.WildcardPattern]::new(
        $pattern,
        [System.Management.Automation.WildcardOptions]::IgnoreCase
      )
      if ($wildcard.IsMatch($Alias)) {
        throw "O bloco Host '$pattern' já corresponde ao alias '$Alias'. Revise config manualmente antes de alterar a configuração."
      }
    }
  }
}

$publicKey = Ensure-SshKeyPair

$sshConfigIdentityPath = [System.IO.Path]::GetFullPath($privateKeyPath).Replace("\", "/")
if ($sshConfigIdentityPath -match '[\r\n"]') {
  throw "O caminho da chave não pode conter aspas ou quebras de linha para ser salvo no config SSH."
}
$sshConfigIdentityPath = $sshConfigIdentityPath.Replace("%", "%%")
$sshConfigIdentity = if ($sshConfigIdentityPath -match '\s|#') { "`"$sshConfigIdentityPath`"" } else { $sshConfigIdentityPath }

$newline = [System.Environment]::NewLine
$configBlock = @(
  "Host $Alias"
  "    HostName $HostName"
  "    User $UserName"
  "    Port $Port"
  "    IdentityFile $sshConfigIdentity"
  "    IdentitiesOnly yes"
  "    ForwardAgent no"
  "    ServerAliveInterval 30"
  "    ServerAliveCountMax 3"
) -join $newline
$prefix = if ($configText.Length -gt 0 -and -not $configText.EndsWith("`n")) { $newline } else { "" }
[System.IO.File]::AppendAllText(
  $configPath,
  "$prefix$configBlock$newline",
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Chave pública para cadastrar em ~/.ssh/authorized_keys da VPS:"
Write-Host $publicKey
Write-Host ""
Write-Host "Depois do cadastro, teste com: ssh $Alias"
Write-Host "A chave privada permanece em $privateKeyPath e não deve sair deste computador."
