param(
  [string]$PrinterIp = '192.168.1.10',
  [int]$Port = 8765,
  [string]$Target = '',
  [switch]$NoPause
)

$ErrorActionPreference='Stop'
$Marker='OPTYKER_RCH_REG_SAFE_V1'
if(-not $Target){$Target=Join-Path $env:LOCALAPPDATA 'OptykerRCH\rch-optyker-connector.ps1'}

trap {
  Write-Host ''
  Write-Host 'ERRORE CORREZIONE RCH REG' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host 'Nessuna chiusura fiscale viene eseguita da questa correzione.' -ForegroundColor Yellow
  if(-not $NoPause){$null=Read-Host 'Premi INVIO per chiudere'}
  exit 1
}

function Request-Rch([string]$command){
  $escaped=[Security.SecurityElement]::Escape($command)
  $body='<?xml version="1.0" encoding="UTF-8"?>'+"`n<Service>`n  <cmd>$escaped</cmd>`n</Service>`n"
  $bytes=[Text.Encoding]::UTF8.GetBytes($body)
  $req=[Net.HttpWebRequest]::Create("http://$PrinterIp/service.cgi")
  $req.Method='POST';$req.Proxy=$null;$req.AllowAutoRedirect=$false;$req.KeepAlive=$false;$req.SendChunked=$false
  $req.ContentType='application/xml';$req.ContentLength=$bytes.Length;$req.Timeout=8000;$req.ReadWriteTimeout=8000
  $s=$req.GetRequestStream();try{$s.Write($bytes,0,$bytes.Length)}finally{$s.Dispose()}
  $resp=$req.GetResponse();try{$rd=New-Object IO.StreamReader($resp.GetResponseStream());try{return $rd.ReadToEnd()}finally{$rd.Dispose()}}finally{$resp.Dispose()}
}
function Read-RchState {
  $raw=Request-Rch '<</?s'
  $doc=New-Object Xml.XmlDocument;$doc.XmlResolver=$null;$doc.LoadXml($raw)
  $r=$doc.SelectSingleNode('/Service/Request');$st=$doc.SelectSingleNode('/Service/ECRStatus | /Service/Request/ECRStatus')
  if(-not $r -or -not $st){throw 'La RCH ha risposto senza uno stato leggibile.'}
  foreach($n in @('errorCode','printerError','paperEnd','coverOpen','busy')){if([int]$r.SelectSingleNode($n).InnerText -ne 0){throw "RCH non pronta: $n non e zero."}}
  return [pscustomobject]@{mode=[string]$st.mode;idleState=[string]$st.idleState;lastCmd=[int]$r.SelectSingleNode('lastCmd').InnerText}
}
function Restore-RegIfIdle {
  $st=Read-RchState
  if($st.mode -match '^REG(?:\s*\(OP\s*\d+\))?$'){
    Write-Host 'RCH gia in REG.' -ForegroundColor DarkGreen
    return
  }
  if($st.mode -cne 'Z'){throw "RCH in modalita $($st.mode): non invio alcun cambio automatico."}
  if($st.idleState -cne '0'){throw 'RCH in Z ma non inattiva: non invio alcun cambio automatico.'}
  Write-Host 'RCH in Z con documento chiuso: ritorno controllato a REG...' -ForegroundColor Cyan
  $null=Request-Rch '=C1'
  Start-Sleep -Milliseconds 500
  $after=Read-RchState
  if($after.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$' -or $after.idleState -cne '0'){throw 'La RCH non ha confermato il ritorno a REG.'}
  Write-Host 'RCH tornata in REG.' -ForegroundColor Green
}
function Patch-Connector([string]$path){
  if(-not (Test-Path -LiteralPath $path -PathType Leaf)){throw "Connettore non trovato: $path"}
  $text=Get-Content -LiteralPath $path -Raw
  if($text -match [regex]::Escape($Marker)){return $false}
  if($text -notmatch "\$ConnectorVersion = '1\.8-auto-receipt'"){throw 'Versione del connettore non riconosciuta: aggiornamento sospeso.'}
  $readPattern='(?s)function Read-PrintedReceipt\(\$document\) \{.*?\n\}\nfunction Assert-WindowsFiscalPlatform'
  if(([regex]::Matches($text,$readPattern)).Count -ne 1){throw 'Blocco lettura automatica giornale non riconosciuto.'}
  $replacement=@'
function Read-PrintedReceipt($document) {
  # OPTYKER_RCH_REG_SAFE_V1: routine intentionally disabled.
  # Reading EJ requires selecting Z on this RCH. Normal sales must never change mode.
  throw 'Lettura automatica giornale disattivata: la RCH resta in REG.'
}
function Assert-WindowsFiscalPlatform
'@
  $text=[regex]::Replace($text,$readPattern,[Text.RegularExpressions.MatchEvaluator]{param($m)$replacement},1)
  $autoPattern="(?s)\n      if\(\$claimed\.document\.automaticReference -eq \$true -and \$operation -eq 'sale'\)\{.*?\n      \}\n    \} catch \{"
  if(([regex]::Matches($text,$autoPattern)).Count -ne 1){throw 'Blocco riferimento automatico non riconosciuto.'}
  $autoReplacement="`n      # $Marker: the receipt is already closed and acknowledged. Keep the RCH in REG.`n      # The printed number is confirmed from the commercial document in Optyker.`n    } catch {"
  $text=[regex]::Replace($text,$autoPattern,[Text.RegularExpressions.MatchEvaluator]{param($m)$autoReplacement},1)
  $text=$text.Replace('automaticReference=$true;manualReference=$true','automaticReference=$true;manualReference=$true;regSafeReceipt=$true')
  if($text -match "Send-RchCommand '=C3'" -or $text -match "Send-RchCommand '=C1'"){throw 'La correzione non ha rimosso tutti i cambi automatici di modalita.'}
  if($text -match "Send-RchCommand '=C10'" -or $text -match "Send-RchCommand \"=C10\""){throw 'Comando di chiusura fiscale non consentito.'}
  $backup=$path+'.pre-reg-safe'
  Copy-Item -LiteralPath $path -Destination $backup -Force
  $tmp=$path+'.tmp'
  [IO.File]::WriteAllText($tmp,$text,(New-Object Text.UTF8Encoding($true)))
  $tokens=$null;$errors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($tmp,[ref]$tokens,[ref]$errors)
  if($errors.Count -gt 0){Remove-Item -LiteralPath $tmp -Force;throw 'Il connettore corretto non supera il controllo PowerShell.'}
  Move-Item -LiteralPath $tmp -Destination $path -Force
  return $true
}

Write-Host 'Correzione Optyker RCH: modalita REG stabile' -ForegroundColor Cyan
$changed=Patch-Connector $Target
if($changed){Write-Host 'Connettore corretto. Il passaggio automatico in Z e stato rimosso.' -ForegroundColor Green}else{Write-Host 'Correzione REG-safe gia presente.' -ForegroundColor DarkGreen}

# Restore REG only when the physical register explicitly reports Z + idle.
Restore-RegIfIdle

# Restart is safe only when no local journal says a write is actively being claimed/sent.
$journal=Join-Path (Split-Path -Parent $Target) 'receipts'
$active=$false
if(Test-Path -LiteralPath $journal){
  foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json'){
    try{$j=Get-Content -LiteralPath $f.FullName -Raw|ConvertFrom-Json;if($j.state -in @('claiming','sending')){$active=$true}}catch{$active=$true}
  }
}
if($active){
  Write-Host 'Connettore corretto su disco. Non lo riavvio: esiste una scrittura fiscale attiva da verificare.' -ForegroundColor Yellow
}else{
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object {$_.CommandLine -like '*rch-optyker-connector.ps1*'} |
    ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
  $ps=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  Start-Process -FilePath $ps -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$Target+'"'),'-PrinterIp',$PrinterIp,'-Port',$Port) -WorkingDirectory (Split-Path -Parent $Target) -WindowStyle Hidden
  Start-Sleep -Seconds 2
  try{
    $h=Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 4
    if(-not $h.ok -or -not $h.capabilities.regSafeReceipt){throw 'Health check REG-safe non confermato.'}
    Write-Host 'Connettore riavviato in modalita REG-safe.' -ForegroundColor Green
  }catch{Write-Host 'Correzione installata; il connettore non ha ancora risposto al controllo locale.' -ForegroundColor Yellow}
}
Write-Host ''
Write-Host 'Da ora Optyker non usa piu Z per leggere automaticamente il numero dello scontrino.' -ForegroundColor Green
Write-Host 'Il numero del documento resta da confermare dalla stampa finche non avremo una lettura RCH documentata che funzioni in REG.' -ForegroundColor Yellow
if(-not $NoPause){$null=Read-Host 'Premi INVIO per terminare'}
