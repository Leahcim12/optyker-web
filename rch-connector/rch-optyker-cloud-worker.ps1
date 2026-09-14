param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [switch]$LibraryOnly,
  [switch]$Once
)

$ErrorActionPreference='Stop'
$WorkerVersion='1.9-cloud-relay'
$RelayApi='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api'
$Base=if($env:LOCALAPPDATA){Join-Path $env:LOCALAPPDATA 'OptykerRCH'}else{Join-Path ([System.IO.Path]::GetTempPath()) 'OptykerRCH'}
$ConfigPath=Join-Path $Base 'cloud-relay.json'
$ConnectorPath=Join-Path $Base 'rch-optyker-connector.ps1'

if(-not (Test-Path -LiteralPath $ConnectorPath -PathType Leaf)){throw 'Connettore RCH locale non installato.'}
. $ConnectorPath -PrinterIp $PrinterIp -Port $Port -LibraryOnly

function Read-RelayConfig {
  if(-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)){return $null}
  try {
    $c=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if([string]$c.machine_id -notmatch '^[0-9a-fA-F-]{36}$' -or -not $c.secret_protected){return $null}
    $secret=Unprotect-JournalToken ([string]$c.secret_protected)
    if($secret -notmatch '^[a-f0-9]{64}$'){return $null}
    return [pscustomobject]@{machine_id=[string]$c.machine_id;secret=$secret}
  } catch {return $null}
}
function Invoke-Relay([string]$action,$payload) {
  $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Depth 20 -Compress @{action=$action;payload=$payload}))
  $r=Invoke-RestMethod -Uri $RelayApi -Method Post -ContentType 'application/json' -Body $bytes -TimeoutSec 25 -MaximumRedirection 0
  if($r.ok -ne $true){throw ([string]$r.error)}
  return $r.data
}
function Public-CloudStatus($s) {
  if($null -eq $s){return $null}
  return @{ok=($s.ok -eq $true);mode=[string]$s.mode;idleState=[string]$s.idleState;errorCode=[int]$s.errorCode;printerError=[int]$s.printerError;paperEnd=[int]$s.paperEnd;coverOpen=[int]$s.coverOpen;busy=[int]$s.busy;lastCmd=[int]$s.lastCmd;error=[string]$s.error}
}
function Invoke-RemoteCommand($command) {
  $kind=[string]$command.kind
  if($kind -in @('fiscal_sale','fiscal_void')){
    if([string]$command.job_id -notmatch '^[0-9a-fA-F-]{36}$' -or [string]$command.token -notmatch '^[a-f0-9]{64}$'){throw 'Comando fiscale cloud non valido.'}
    $operation=if($kind -eq 'fiscal_void'){'void'}else{'sale'}
    return Emit-Receipt ([pscustomobject]@{jobId=[string]$command.job_id;token=[string]$command.token}) $operation
  }
  if($kind -eq 'drawer'){
    Assert-NoUncertainReceipt
    return Drawer-Rch
  }
  if($kind -eq 'gift_receipt'){
    Assert-NoUncertainReceipt
    return GiftReceipt-Rch
  }
  throw 'Comando cloud non autorizzato.'
}
function Run-RelayCycle($config,[ref]$lastStatusAt,[ref]$cachedStatus) {
  $now=[DateTime]::UtcNow
  if($null -eq $cachedStatus.Value -or ($now-$lastStatusAt.Value).TotalSeconds -ge 12){
    try {$cachedStatus.Value=Public-CloudStatus (Status-Rch)} catch {$cachedStatus.Value=@{ok=$false;mode='';idleState='';errorCode=-1;printerError=-1;paperEnd=-1;coverOpen=-1;busy=-1;lastCmd=-1;error=$_.Exception.Message}}
    $lastStatusAt.Value=$now
  }
  $poll=Invoke-Relay 'poll' @{machine_id=$config.machine_id;secret=$config.secret;connector_version=$WorkerVersion;status=$cachedStatus.Value}
  $cmd=$poll.command
  if($null -eq $cmd){return}
  $result=$null
  try {$result=Invoke-RemoteCommand $cmd}
  catch {$result=@{ok=$false;state='failed';error=$_.Exception.Message;connectorVersion=$WorkerVersion}}
  try {$null=Invoke-Relay 'complete' @{machine_id=$config.machine_id;secret=$config.secret;command_id=[string]$cmd.id;result=$result}} catch {}
}

if($LibraryOnly){return}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Il relay RCH deve essere eseguito sul PC Windows della cassa.'}
$config=Read-RelayConfig
if($null -eq $config){throw 'Cloud Relay non associato. Esegui Installa / aggiorna connettore RCH.'}
$lastStatusAt=[DateTime]::MinValue;$cachedStatus=$null
Write-Host "Optyker RCH Cloud Relay $WorkerVersion"
do {
  try {Run-RelayCycle $config ([ref]$lastStatusAt) ([ref]$cachedStatus)} catch {Start-Sleep -Seconds 3}
  if(-not $Once){Start-Sleep -Milliseconds 1500}
} while(-not $Once)
