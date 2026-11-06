[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$IdentityFile,
  [string]$HostName = "209.50.245.111",
  [string]$UserName = "root",
  [ValidateRange(1, 65535)]
  [int]$Port = 22,
  [string]$OutputLogPath
)

$ErrorActionPreference = "Stop"
if ($HostName -notmatch '^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$') {
  throw "Hostname/IP inválido: informe um nome DNS ou IPv4 sem opções ou argumentos SSH."
}
if ($UserName -notmatch '^[A-Za-z_][A-Za-z0-9_.-]{0,31}$') {
  throw "Usuário SSH inválido. Use um nome Linux simples, como hub ou root."
}
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
  throw "Arquivo de chave não encontrado: $IdentityFile"
}
$identityPath = (Resolve-Path -LiteralPath $IdentityFile -ErrorAction Stop).Path
$knownHostsPath = Join-Path $env:USERPROFILE ".ssh\known_hosts"
$remoteScriptPath = Join-Path $PSScriptRoot "inspect-vps-operations.sh"
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$sshKeygen = (Get-Command ssh-keygen.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $knownHostsPath -PathType Leaf)) {
  throw "known_hosts não existe em $knownHostsPath. Confirme a fingerprint no painel da VPS antes de conectar."
}
if (-not (Test-Path -LiteralPath $remoteScriptPath -PathType Leaf)) {
  throw "Roteiro de inspeção ausente: $remoteScriptPath"
}

$knownHostName = if ($Port -eq 22) { $HostName } else { "[$HostName]:$Port" }
& $sshKeygen -F $knownHostName -f $knownHostsPath *> $null
if ($LASTEXITCODE -ne 0) {
  throw "A chave do host não está em known_hosts. Confirme a fingerprint no painel da VPS antes de conectar."
}

$remoteScript = [System.IO.File]::ReadAllText($remoteScriptPath, [System.Text.Encoding]::UTF8)
$encodedScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
$remoteCommand = "printf '%s' '$encodedScript' | base64 -d | bash"
$sshArguments = @(
  "-F", "none",
  "-T",
  "-p", "$Port",
  "-i", $identityPath,
  "-o", "StrictHostKeyChecking=yes",
  "-o", "IdentitiesOnly=yes",
  "-o", "BatchMode=no",
  "-o", "PasswordAuthentication=no",
  "-o", "PreferredAuthentications=publickey",
  "-o", "ForwardAgent=no",
  "-o", "ConnectTimeout=15",
  "$UserName@$HostName",
  $remoteCommand
)

Write-Output "Inspeção somente leitura. Se solicitado, digite a frase-senha da chave no prompt local do OpenSSH; ela não será exibida nem enviada ao servidor."
if ($OutputLogPath) {
  $resolvedLogPath = [System.IO.Path]::GetFullPath($OutputLogPath)
  $logDirectory = Split-Path -Parent $resolvedLogPath
  if (-not (Test-Path -LiteralPath $logDirectory -PathType Container)) {
    throw "Diretório do log não existe: $logDirectory"
  }
  if (Test-Path -LiteralPath $resolvedLogPath) {
    throw "O log já existe; escolha outro caminho para não sobrescrever: $resolvedLogPath"
  }
  Write-Output "Saída do diagnóstico também será gravada localmente em: $resolvedLogPath"
  & $ssh @sshArguments 2>&1 | Tee-Object -FilePath $resolvedLogPath
} else {
  & $ssh @sshArguments
}
$sshExitCode = $LASTEXITCODE
if ($sshExitCode -ne 0) {
  throw "A inspeção SSH terminou com código $sshExitCode. Nenhuma alteração remota foi feita."
}
