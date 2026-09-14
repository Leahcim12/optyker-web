param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [switch]$LibraryOnly,
  [switch]$Once
)

$ErrorActionPreference='Stop'
$WorkerVersion='2.0-cloud-relay-http'
$RelayApi='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api'
$Base=if($env:LOCALAPPDATA){Join-Path $env:LOCALAPPDATA 'OptykerRCH'}else{Join-Path ([System.IO.Path]::GetTempPath()) 'OptykerRCH'}
$ConfigPath=Join-Path $Base 'cloud-relay.json'
$ConnectorPath=Join-Path $Base 'rch-optyker-connector.ps1'
$LogPath=Join-Path $Base 'cloud-relay.log'
$LocalOrigin='https://optyker.it'

function Write-RelayLog([string]$message){
  try{
    New-Item -ItemType Directory -Force -Path $Base | Out-Null
    if(Test-Path -LiteralPath $LogPath -PathType Leaf){
      $f=Get-Item -LiteralPath $LogPath -ErrorAction SilentlyContinue
      if($f -and $f.Length -gt 131072){Move-Item -LiteralPath $LogPath -Destination ($LogPath+'.previous') -Force}
    }
    Add-Content -LiteralPath $LogPath -Value ((Get-Date).ToString('o')+' '+$message) -Encoding UTF8
  }catch{}
}
function Unprotect-Secret([string]$value){
  Add-Type -AssemblyName System.Security
  $bytes=[Convert]::FromBase64String($value)
  $clear=[System.Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  return [System.Text.Encoding]::UTF8.GetString($clear)
}
function Read-RelayConfig {
  if(-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)){return $null}
  try{
    $c=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if([string]$c.machine_id -notmatch '^[0-9a-fA-F-]{36}$' -or -not $c.secret_protected){return $null}
    $secret=Unprotect-Secret ([string]$c.secret_protected)
    if($secret -notmatch '^[a-f0-9]{64}$'){return $null}
    return [pscustomobject]@{machine_id=[string]$c.machine_id;secret=$secret}
  }catch{
    Write-RelayLog ('config_error '+$_.Exception.Message)
    return $null
  }
}
function Invoke-Relay([string]$action,$payload){
  $bytes=[System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Depth 20 -Compress @{action=$action;payload=$payload}))
  $r=Invoke-RestMethod -Uri $RelayApi -Method Post -ContentType 'application/json' -Body $bytes -TimeoutSec 25 -MaximumRedirection 0
  if($r.ok -ne $true){throw ([string]$r.error)}
  return $r.data
}
function Invoke-LocalGet([string]$path){
  return Invoke-RestMethod -Uri ("http://127.0.0.1:$Port"+$path) -Method Get -Headers @{Origin=$LocalOrigin} -TimeoutSec 12
}
function Invoke-LocalPost([string]$path,$payload){
  $bytes=[System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Depth 12 -Compress $payload))
  return Invoke-RestMethod -Uri ("http://127.0.0.1:$Port"+$path) -Method Post -Headers @{Origin=$LocalOrigin} -ContentType 'application/json' -Body $bytes -TimeoutSec 155
}
function Public-CloudStatus($s){
  if($null -eq $s){return $null}
  return @{ok=($s.ok -eq $true);mode=[string]$s.mode;idleState=[string]$s.idleState;errorCode=[int]$s.errorCode;printerError=[int]$s.printerError;paperEnd=[int]$s.paperEnd;coverOpen=[int]$s.coverOpen;busy=[int]$s.busy;lastCmd=[int]$s.lastCmd;error=[string]$s.error}
}
function Invoke-RemoteCommand($command){
  $kind=[string]$command.kind
  if($kind -in @('fiscal_sale','fiscal_void')){
    if([string]$command.job_id -notmatch '^[0-9a-fA-F-]{36}$' -or [string]$command.token -notmatch '^[a-f0-9]{64}$'){throw 'Comando fiscale cloud non valido.'}
    $path=if($kind -eq 'fiscal_void'){'/receipt/void'}else{'/receipt'}
    return Invoke-LocalPost $path @{jobId=[string]$command.job_id;token=[string]$command.token}
  }
  if($kind -eq 'drawer'){return Invoke-LocalPost '/drawer' @{source='cloud-relay'}}
  if($kind -eq 'gift_receipt'){return Invoke-LocalPost '/gift-receipt' @{source='cloud-relay'}}
  throw 'Comando cloud non autorizzato.'
}
function Read-LocalStatus {
  try{
    $h=Invoke-LocalGet '/health'
    if($h.ok -ne $true){throw 'Health check del connettore locale non confermato.'}
    return Public-CloudStatus (Invoke-LocalGet '/status')
  }catch{
    return @{ok=$false;mode='';idleState='';errorCode=-1;printerError=-1;paperEnd=-1;coverOpen=-1;busy=-1;lastCmd=-1;error=('Connettore locale: '+$_.Exception.Message)}
  }
}
function Run-RelayCycle($config,[ref]$lastStatusAt,[ref]$cachedStatus){
  $now=[DateTime]::UtcNow
  if($null -eq $cachedStatus.Value -or ($now-$lastStatusAt.Value).TotalSeconds -ge 8){
    $cachedStatus.Value=Read-LocalStatus
    $lastStatusAt.Value=$now
  }
  $poll=Invoke-Relay 'poll' @{machine_id=$config.machine_id;secret=$config.secret;connector_version=$WorkerVersion;status=$cachedStatus.Value}
  $cmd=$poll.command
  if($null -eq $cmd){return}
  $result=$null
  try{$result=Invoke-RemoteCommand $cmd}
  catch{$result=@{ok=$false;state='failed';error=$_.Exception.Message;connectorVersion=$WorkerVersion};Write-RelayLog ('command_error '+$_.Exception.Message)}
  try{$null=Invoke-Relay 'complete' @{machine_id=$config.machine_id;secret=$config.secret;command_id=[string]$cmd.id;result=$result}}
  catch{Write-RelayLog ('complete_error '+$_.Exception.Message)}
}

if($LibraryOnly){return}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Il relay RCH deve essere eseguito sul PC Windows della cassa.'}
if(-not (Test-Path -LiteralPath $ConnectorPath -PathType Leaf)){throw 'Connettore RCH locale non installato.'}
$config=Read-RelayConfig
if($null -eq $config){throw 'Cloud Relay non associato. Esegui Installa collegamento iPad.'}
Write-RelayLog ('start '+$WorkerVersion)
$lastStatusAt=[DateTime]::MinValue;$cachedStatus=$null
do{
  try{Run-RelayCycle $config ([ref]$lastStatusAt) ([ref]$cachedStatus)}
  catch{
    Write-RelayLog ('cycle_error '+$_.Exception.Message)
    if($Once){throw}
    Start-Sleep -Seconds 3
  }
  if(-not $Once){Start-Sleep -Milliseconds 1500}
}while(-not $Once)
