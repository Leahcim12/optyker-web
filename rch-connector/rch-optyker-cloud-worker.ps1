param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [switch]$LibraryOnly,
  [switch]$Once
)

$ErrorActionPreference='Stop'
# Compatibility marker for older build checks: 2.1-manual-reg
# Optyker and the database still identify this worker as 2.2-daily-closure.
$WorkerVersion='2.2-daily-closure'
# OPTYKER_RCH_REG_AUTO_20261011: daily closure confirmed on the electronic journal,
# automatic return to REG after the closure and whenever the RCH stays idle in Z.
$WorkerRevision='2.3-reg-auto'
$RelayApi='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api'
$Base=if($env:LOCALAPPDATA){Join-Path $env:LOCALAPPDATA 'OptykerRCH'}else{Join-Path ([System.IO.Path]::GetTempPath()) 'OptykerRCH'}
$ConfigPath=Join-Path $Base 'cloud-relay.json'
$ConnectorPath=Join-Path $Base 'rch-optyker-connector.ps1'
$LogPath=Join-Path $Base 'cloud-relay.log'
$LocalOrigin='https://optyker.it'
# A RCH left idle in Z (after a closure, by another program or from the keyboard)
# goes back to REG after this delay. Only =C1 is sent: never a closure or a receipt.
# Create an empty file named auto-reg-disabled in the OptykerRCH folder to switch it off.
$AutoRegAfterSeconds=45
$AutoRegRetrySeconds=300
$script:ZIdleSince=$null
$script:AutoRegBlockedUntil=[DateTime]::MinValue

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
function Read-SafeXml([string]$text){
  if($text.Length -gt 1048576){throw 'Risposta RCH troppo grande.'}
  $settings=New-Object System.Xml.XmlReaderSettings
  $settings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver=$null
  $input=New-Object System.IO.StringReader($text)
  $reader=[System.Xml.XmlReader]::Create($input,$settings)
  try{$doc=New-Object System.Xml.XmlDocument;$doc.XmlResolver=$null;$doc.Load($reader);return ,$doc}finally{$reader.Dispose();$input.Dispose()}
}
function Assert-CommandAccepted([string]$raw,[string]$label){
  $doc=Read-SafeXml $raw
  $r=$doc.SelectSingleNode('/Service/Request')
  if($null -eq $r){throw "${label}: risposta RCH senza esito."}
  foreach($name in @('errorCode','printerError','paperEnd','coverOpen','busy')){
    $n=$r.SelectSingleNode($name);$v=-1
    if($null -eq $n -or -not [int]::TryParse([string]$n.InnerText,[ref]$v)){throw "${label}: risposta RCH incompleta."}
    if($v -ne 0){throw "${label}: RCH $name $v."}
  }
}
function Invoke-ExactPrinterCommand([string]$command){
  # =C453/$0 only reads the last document of the electronic journal: no print, no fiscal write.
  if($command -cnotin @('=C1','=C3','=C10','=C453/$0')){throw 'Comando RCH non autorizzato dal Cloud Relay.'}
  $body='<?xml version="1.0" encoding="UTF-8"?>'+"`n<Service>`n  <cmd>$command</cmd>`n</Service>`n"
  $bytes=[System.Text.Encoding]::UTF8.GetBytes($body)
  $req=[System.Net.HttpWebRequest]::Create("http://$PrinterIp/service.cgi")
  $timeout=if($command -ceq '=C10'){90000}else{10000}
  $req.Method='POST';$req.Proxy=$null;$req.AllowAutoRedirect=$false;$req.KeepAlive=$false;$req.SendChunked=$false
  $req.ContentType='application/xml';$req.ContentLength=$bytes.Length;$req.Timeout=$timeout;$req.ReadWriteTimeout=$timeout
  $stream=$req.GetRequestStream()
  try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  $response=$req.GetResponse()
  try{
    if([int]$response.StatusCode -ne 200){throw "Risposta HTTP RCH $([int]$response.StatusCode)."}
    $reader=New-Object System.IO.StreamReader($response.GetResponseStream())
    try{$raw=$reader.ReadToEnd();if($raw.Length -gt 1048576){throw 'Risposta RCH troppo grande.'}}finally{$reader.Dispose()}
  }finally{$response.Dispose()}
  Assert-CommandAccepted $raw $command
  return $raw
}
function Wait-RchStatus([scriptblock]$predicate,[int]$timeoutMs){
  $end=[DateTime]::UtcNow.AddMilliseconds($timeoutMs)
  $last=$null
  do{
    try{$last=Public-CloudStatus (Invoke-LocalGet '/status');if(& $predicate $last){return $last}}catch{}
    Start-Sleep -Milliseconds 650
  }while([DateTime]::UtcNow -lt $end)
  return $last
}
function Assert-NoUncertainFiscalJournal {
  $journal=Join-Path $Base 'receipts'
  if(-not (Test-Path -LiteralPath $journal)){return}
  foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json' -ErrorAction SilentlyContinue){
    try{$j=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json;if([string]$j.state -in @('claiming','sending','uncertain')){throw 'Una emissione fiscale ha un esito da verificare. Controlla la RCH prima della chiusura giornaliera.'}}catch{if($_.Exception.Message -like 'Una emissione fiscale*'){throw};throw 'Registro locale RCH non leggibile: chiusura giornaliera bloccata per sicurezza.'}
  }
}
function Test-ActiveFiscalWrite {
  # A receipt being claimed or sent must never be interrupted by a mode change.
  $journal=Join-Path $Base 'receipts'
  if(-not (Test-Path -LiteralPath $journal)){return $false}
  foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json' -ErrorAction SilentlyContinue){
    try{$j=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json;if([string]$j.state -in @('claiming','sending')){return $true}}catch{return $true}
  }
  return $false
}
function Open-PrinterLock {
  $journal=Join-Path $Base 'receipts'
  New-Item -ItemType Directory -Force -Path $journal | Out-Null
  return [System.IO.File]::Open((Join-Path $journal 'printer.lock'),[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
}
function Restore-RegManual {
  $lock=Open-PrinterLock
  try{
    $before=Public-CloudStatus (Invoke-LocalGet '/status')
    if(Test-RegReady $before){return @{ok=$true;state='completed';manual=$true;alreadyReg=$true;mode=[string]$before.mode;emittedFiscalDocument=$false;dailyClosureExecuted=$false}}
    if(-not (Test-ZIdle $before)){throw 'Ritorno manuale in REG bloccato: la RCH deve essere in Z, inattiva e senza errori.'}
    $null=Invoke-ExactPrinterCommand '=C1'
    $after=Wait-RchStatus {param($s) Test-RegReady $s} 12000
    if(-not (Test-RegReady $after)){throw 'La RCH non ha confermato il ritorno in REG.'}
    Write-RelayLog 'manual_restore_reg completed'
    $script:ZIdleSince=$null
    return @{ok=$true;state='completed';manual=$true;alreadyReg=$false;mode=[string]$after.mode;emittedFiscalDocument=$false;dailyClosureExecuted=$false}
  } finally {$lock.Dispose()}
}
# BEGIN OPTYKER_RCH_CLOSURE_JOURNAL_20261011
# The electronic journal decides when the RCH drops the HTTP answer of =C10.
# Same document layout already verified by the connector (DOCUMENTO N. / CHIUSURA GIORNALIERA N.).
function Read-LastJournalText {
  $raw=Invoke-ExactPrinterCommand '=C453/$0'
  $nodes=(Read-SafeXml $raw).SelectNodes('/Service/EJ')
  if($nodes.Count -ne 1){throw 'Giornale RCH assente o ambiguo.'}
  return ([string]$nodes[0].InnerText).Replace("`r",'')
}
function Get-JournalNumbers([string]$text){
  $documents=[regex]::Matches($text,'(?m)^[ \t]*DOCUMENTO(?:[ \t]+COMMERCIALE)?[ \t]+N[.°]?[ \t]*(\d{4})-(\d{4})[ \t]*$')
  $closures=[regex]::Matches($text,'(?m)^[ \t]*CHIUSURA GIORNALIERA N\.[ \t]+(\d{1,4})[ \t]*$')
  $document=$null;$closure=$null
  if($documents.Count -eq 1){$document=[int]$documents[0].Groups[1].Value}
  if($closures.Count -eq 1){$closure=[int]$closures[0].Groups[1].Value}
  return [pscustomobject]@{documentCount=$documents.Count;document=$document;closureCount=$closures.Count;closure=$closure}
}
function Get-ExpectedClosureNumber([string]$journalText){
  # Last document = a sale ZZZZ-NNNN: this closure is ZZZZ. Last document = closure N: next one is N+1.
  $n=Get-JournalNumbers $journalText
  if($n.documentCount -eq 1 -and $n.closureCount -eq 0){return $n.document}
  if($n.documentCount -eq 0 -and $n.closureCount -eq 1){return ($n.closure+1)}
  return $null
}
function Test-ClosureInJournal([string]$before,[string]$after,$expected){
  # $true: closure document with the expected number. $false: journal unchanged. $null: not provable.
  if($after -ceq $before){return $false}
  if($null -eq $expected){return $null}
  $n=Get-JournalNumbers $after
  if($n.closureCount -eq 1 -and $n.closure -eq $expected){return $true}
  return $null
}
function Restore-RegAfterClosure {
  for($attempt=1;$attempt -le 2;$attempt++){
    try{
      $state=Wait-RchStatus {param($s) (Test-ZIdle $s) -or (Test-RegReady $s)} 20000
      if(Test-RegReady $state){$script:ZIdleSince=$null;return $true}
      if(Test-ZIdle $state){
        $null=Invoke-ExactPrinterCommand '=C1'
        $state=Wait-RchStatus {param($s) Test-RegReady $s} 15000
        if(Test-RegReady $state){Write-RelayLog 'auto_reg after_closure completed';$script:ZIdleSince=$null;return $true}
      }
    }catch{Write-RelayLog ('auto_reg after_closure error '+$_.Exception.Message)}
    Start-Sleep -Seconds 2
  }
  Write-RelayLog 'auto_reg after_closure not_confirmed'
  return $false
}
function Close-DailyManual {
  $lock=Open-PrinterLock
  try{
    Assert-NoUncertainFiscalJournal
    $before=Public-CloudStatus (Invoke-LocalGet '/status')
    if(-not (Test-RegReady $before)){throw 'Chiusura giornaliera bloccata: la RCH deve essere in REG, inattiva e senza errori.'}
    $null=Invoke-ExactPrinterCommand '=C3'
    $z=Wait-RchStatus {param($s) Test-ZIdle $s} 15000
    if(-not (Test-ZIdle $z)){
      $null=Restore-RegAfterClosure
      throw 'La RCH non ha confermato la modalità Z. La chiusura giornaliera non è stata inviata.'
    }
    $journalBefore=$null;$expected=$null
    try{$journalBefore=Read-LastJournalText;$expected=Get-ExpectedClosureNumber $journalBefore}
    catch{$journalBefore=$null;$expected=$null;Write-RelayLog ('daily_closure journal_before '+$_.Exception.Message)}
    $sendError=$null
    try{$null=Invoke-ExactPrinterCommand '=C10'}
    catch{$sendError=[string]$_.Exception.Message;Write-RelayLog ('daily_closure response_not_confirmed '+$sendError)}
    $after=Wait-RchStatus {param($s) Test-ZIdle $s} 120000
    $verified=$null
    if($null -ne $journalBefore -and (Test-ZIdle $after)){
      try{$verified=Test-ClosureInJournal $journalBefore (Read-LastJournalText) $expected}
      catch{$verified=$null;Write-RelayLog ('daily_closure journal_after '+$_.Exception.Message)}
      if(($verified -is [bool]) -and (-not $verified)){
        # Unchanged journal: read once more after a pause before declaring that nothing was printed.
        Start-Sleep -Seconds 3
        try{$verified=Test-ClosureInJournal $journalBefore (Read-LastJournalText) $expected}catch{$verified=$null}
      }
    }
    $confirmedBy=$null
    if(($null -eq $sendError) -and (Test-ZIdle $after)){$confirmedBy='rch_ack'}
    elseif($verified -eq $true){$confirmedBy='journal'}
    if($null -eq $confirmedBy){
      if(($null -ne $sendError) -and ($verified -is [bool]) -and (-not $verified)){
        $returned=Restore-RegAfterClosure
        Write-RelayLog 'daily_closure not_executed journal_unchanged'
        return @{ok=$false;state='failed';error='La RCH non ha eseguito la chiusura: il giornale elettronico non è cambiato. Nessuna chiusura stampata: puoi ripetere la chiusura.';manual=$true;dailyClosureExecuted=$false;emittedFiscalDocument=$false;returnedToReg=$returned;workerRevision=$WorkerRevision}
      }
      if($null -ne $sendError){
        Write-RelayLog ('daily_closure uncertain '+$sendError)
        return @{ok=$false;state='uncertain';error=('Comando di chiusura inviato ma esito non confermato: '+$sendError);manual=$true;dailyClosureExecuted=$null;emittedFiscalDocument=$false;workerRevision=$WorkerRevision}
      }
      Write-RelayLog 'daily_closure uncertain post_status'
      return @{ok=$false;state='uncertain';error='La RCH ha ricevuto la chiusura ma lo stato finale non è confermato. Verifica la stampa prima di ripetere.';manual=$true;dailyClosureExecuted=$null;emittedFiscalDocument=$false;workerRevision=$WorkerRevision}
    }
    $returned=Restore-RegAfterClosure
    Write-RelayLog ('daily_closure completed '+$confirmedBy+' reg='+$returned)
    $mode=if($returned){'REG'}else{[string]$after.mode}
    return @{ok=$true;state='completed';manual=$true;mode=$mode;dailyClosureExecuted=$true;emittedFiscalDocument=$false;returnedToReg=$returned;confirmedBy=$confirmedBy;closureNumber=$expected;workerRevision=$WorkerRevision}
  } finally {$lock.Dispose()}
}
# END OPTYKER_RCH_CLOSURE_JOURNAL_20261011
# BEGIN OPTYKER_RCH_AUTO_REG_20261011
function Test-AutoRegEnabled {
  return -not (Test-Path -LiteralPath (Join-Path $Base 'auto-reg-disabled'))
}
function Invoke-AutoReg($status,[DateTime]$now){
  # Returns $true only when =C1 was sent, so the caller refreshes the published status.
  if(-not (Test-AutoRegEnabled)){$script:ZIdleSince=$null;return $null}
  if(-not (Test-ZIdle $status)){$script:ZIdleSince=$null;return $null}
  if($null -eq $script:ZIdleSince){$script:ZIdleSince=$now;return $null}
  if(($now-$script:ZIdleSince).TotalSeconds -lt $AutoRegAfterSeconds){return $null}
  if($now -lt $script:AutoRegBlockedUntil){return $null}
  if(Test-ActiveFiscalWrite){return $null}
  $lock=$null
  try{$lock=Open-PrinterLock}catch{return $null}
  try{
    $fresh=Public-CloudStatus (Invoke-LocalGet '/status')
    if(-not (Test-ZIdle $fresh)){$script:ZIdleSince=$null;return $null}
    $null=Invoke-ExactPrinterCommand '=C1'
    $after=Wait-RchStatus {param($s) Test-RegReady $s} 12000
    $script:ZIdleSince=$null
    if(Test-RegReady $after){Write-RelayLog 'auto_reg completed'}
    else{$script:AutoRegBlockedUntil=$now.AddSeconds($AutoRegRetrySeconds);Write-RelayLog 'auto_reg not_confirmed'}
    return $true
  }catch{
    $script:AutoRegBlockedUntil=$now.AddSeconds($AutoRegRetrySeconds)
    Write-RelayLog ('auto_reg error '+$_.Exception.Message)
    return $true
  }finally{$lock.Dispose()}
}
# END OPTYKER_RCH_AUTO_REG_20261011
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
  if($kind -eq 'daily_closure'){return Close-DailyManual}
  throw 'Comando cloud non autorizzato.'
}
function Read-LocalStatus {
  try{
    $h=Invoke-LocalGet '/health'
    if($h.ok -ne $true){throw 'Health check del connettore locale non confermato.'}
    $s=Public-CloudStatus (Invoke-LocalGet '/status')
    $s.automaticVoidReference=($h.capabilities.automaticVoidReference -eq $true)
    $s.workerRevision=$WorkerRevision
    $s.autoReg=(Test-AutoRegEnabled)
    return $s
  }catch{return @{ok=$false;mode='';idleState='';errorCode=-1;printerError=-1;paperEnd=-1;coverOpen=-1;busy=-1;lastCmd=-1;error=('Connettore locale: '+$_.Exception.Message);workerRevision=$WorkerRevision}}
}
function Run-RelayCycle($config,[ref]$lastStatusAt,[ref]$cachedStatus){
  $now=[DateTime]::UtcNow
  if($null -eq $cachedStatus.Value -or ($now-$lastStatusAt.Value).TotalSeconds -ge 8){
    $cachedStatus.Value=Read-LocalStatus;$lastStatusAt.Value=$now
    if((Invoke-AutoReg $cachedStatus.Value $now) -eq $true){$cachedStatus.Value=Read-LocalStatus;$lastStatusAt.Value=[DateTime]::UtcNow}
  }
  $poll=Invoke-Relay 'poll' @{machine_id=$config.machine_id;secret=$config.secret;connector_version=$WorkerVersion;status=$cachedStatus.Value}
  $cmd=$poll.command
  if($null -eq $cmd){return}
  $result=$null
  try{$result=Invoke-RemoteCommand $cmd}catch{$result=@{ok=$false;state='failed';error=$_.Exception.Message;connectorVersion=$WorkerVersion;workerRevision=$WorkerRevision};Write-RelayLog ('command_error '+$_.Exception.Message)}
  try{$null=Invoke-Relay 'complete' @{machine_id=$config.machine_id;secret=$config.secret;command_id=[string]$cmd.id;result=$result}}catch{Write-RelayLog ('complete_error '+$_.Exception.Message)}
  if([string]$cmd.kind -in @('restore_reg','daily_closure')){$cachedStatus.Value=Read-LocalStatus;$lastStatusAt.Value=[DateTime]::MinValue}
}

if($LibraryOnly){return}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Il relay RCH deve essere eseguito sul PC Windows della cassa.'}
if(-not (Test-Path -LiteralPath $ConnectorPath -PathType Leaf)){throw 'Connettore RCH locale non installato.'}
$config=Read-RelayConfig
if($null -eq $config){throw 'Cloud Relay non associato. Esegui Installa collegamento iPad.'}
Write-RelayLog ('start '+$WorkerVersion+' '+$WorkerRevision+' auto_reg='+(Test-AutoRegEnabled))
$lastStatusAt=[DateTime]::MinValue;$cachedStatus=$null
do{
  try{Run-RelayCycle $config ([ref]$lastStatusAt) ([ref]$cachedStatus)}
  catch{Write-RelayLog ('cycle_error '+$_.Exception.Message);if($Once){throw};Start-Sleep -Seconds 3}
  if(-not $Once){Start-Sleep -Milliseconds 1500}
}while(-not $Once)
