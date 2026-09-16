param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [switch]$LibraryOnly,
  [switch]$Once
)

$ErrorActionPreference='Stop'
$WorkerVersion='2.1-manual-reg'
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
function Test-RegReady($s){
  return $s.ok -eq $true -and [string]$s.mode -match '^REG(?:\s*\(OP\s*\d+\))?$' -and [string]$s.idleState -eq '0' -and
    [int]$s.busy -eq 0 -and [int]$s.errorCode -eq 0 -and [int]$s.printerError -eq 0 -and [int]$s.paperEnd -eq 0 -and [int]$s.coverOpen -eq 0
}
function Test-ZIdle($s){
  return $s.ok -eq $true -and [string]$s.mode -ceq 'Z' -and [string]$s.idleState -eq '0' -and
    [int]$s.busy -eq 0 -and [int]$s.errorCode -eq 0 -and [int]$s.printerError -eq 0 -and [int]$s.paperEnd -eq 0 -and [int]$s.coverOpen -eq 0
}
function Send-ManualRegCommand {
  # Deliberately fixed command. This function cannot send a closure or any sale command.
  $body='<?xml version="1.0" encoding="UTF-8"?>'+"`n<Service>`n  <cmd>=C1</cmd>`n</Service>`n"
  $bytes=[System.Text.Encoding]::UTF8.GetBytes($body)
  $req=[System.Net.HttpWebRequest]::Create("http://$PrinterIp/service.cgi")
  $req.Method='POST';$req.Proxy=$null;$req.AllowAutoRedirect=$false;$req.KeepAlive=$false;$req.SendChunked=$false
  $req.ContentType='application/xml';$req.ContentLength=$bytes.Length;$req.Timeout=8000;$req.ReadWriteTimeout=8000
  $stream=$req.GetRequestStream()
  try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  $response=$req.GetResponse()
  try{
    if([int]$response.StatusCode -ne 200){throw "Risposta HTTP RCH $([int]$response.StatusCode)."}
    $reader=New-Object System.IO.StreamReader($response.GetResponseStream())
    try{
      $raw=$reader.ReadToEnd()
      if($raw.Length -gt 1048576){throw 'Risposta RCH troppo grande.'}
    }finally{$reader.Dispose()}
  }finally{$response.Dispose()}
}
function Restore-RegManual {
  $journal=Join-Path $Base 'receipts'
  New-Item -ItemType Directory -Force -Path $journal | Out-Null
  $lock=[System.IO.File]::Open((Join-Path $journal 'printer.lock'),[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
  try{
    $before=Public-CloudStatus (Invoke-LocalGet '/status')
    if(Test-RegReady $before){
      return @{ok=$true;state='completed';manual=$true;alreadyReg=$true;mode=[string]$before.mode;emittedFiscalDocument=$false;dailyClosureExecuted=$false}
    }
    if(-not (Test-ZIdle $before)){throw 'Ritorno manuale in REG bloccato: la RCH deve essere in Z, inattiva e senza errori.'}
    Send-ManualRegCommand
    Start-Sleep -Milliseconds 600
    $after=Public-CloudStatus (Invoke-LocalGet '/status')
    if(-not (Test-RegReady $after)){throw 'La RCH non ha confermato il ritorno in REG.'}
    Write-RelayLog 'manual_restore_reg completed'
    return @{ok=$true;state='completed';manual=$true;alreadyReg=$false;mode=[string]$after.mode;emittedFiscalDocument=$false;dailyClosureExecuted=$false}
  } finally {
    $lock.Dispose()
  }
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
  if($kind -eq 'restore_reg'){return Restore-RegManual}
  throw 'Comando cloud non autorizzato.'
}
function Read-LocalStatus {
  try{
    $h=Invoke-LocalGet '/health'
    if($h.ok -ne $true){throw 'Health check del connettore locale non confermato.'}
    $s=Public-CloudStatus (Invoke-LocalGet '/status')
    $s.automaticVoidReference=($h.capabilities.automaticVoidReference -eq $true)
    return $s
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
  if([string]$cmd.kind -eq 'restore_reg'){
    $cachedStatus.Value=Read-LocalStatus
    $lastStatusAt.Value=[DateTime]::MinValue
  }
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
