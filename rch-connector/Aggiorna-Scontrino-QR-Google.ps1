param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [string]$Target='',
  [switch]$NoPause
)

$ErrorActionPreference='Stop'
$PatchMarker='OPTYKER_REVIEW_QR_20260914_V1'
$ReviewUrl='https://g.page/r/CeicKuw6aQ5FEAE/review'
if(-not $Target){$Target=Join-Path $env:LOCALAPPDATA 'OptykerRCH\rch-optyker-connector.ps1'}

trap {
  Write-Host ''
  Write-Host 'ERRORE AGGIORNAMENTO SCONTRINO' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host 'Nessuno scontrino viene emesso da questo aggiornamento.' -ForegroundColor Yellow
  if(-not $NoPause){$null=Read-Host 'Premi INVIO per chiudere'}
  exit 1
}

function Request-Rch([string]$command){
  $escaped=[System.Security.SecurityElement]::Escape($command)
  $body='<?xml version="1.0" encoding="UTF-8"?>'+"`n<Service>`n  <cmd>$escaped</cmd>`n</Service>`n"
  $bytes=[System.Text.Encoding]::UTF8.GetBytes($body)
  $req=[System.Net.HttpWebRequest]::Create("http://$PrinterIp/service.cgi")
  $req.Method='POST';$req.Proxy=$null;$req.AllowAutoRedirect=$false;$req.KeepAlive=$false;$req.SendChunked=$false
  $req.ContentType='application/xml';$req.ContentLength=$bytes.Length;$req.Timeout=8000;$req.ReadWriteTimeout=8000
  $s=$req.GetRequestStream();try{$s.Write($bytes,0,$bytes.Length)}finally{$s.Dispose()}
  $resp=$req.GetResponse()
  try{
    $rd=New-Object System.IO.StreamReader($resp.GetResponseStream())
    try{return $rd.ReadToEnd()}finally{$rd.Dispose()}
  }finally{$resp.Dispose()}
}
function Parse-Rch([string]$raw){
  $doc=New-Object System.Xml.XmlDocument;$doc.XmlResolver=$null;$doc.LoadXml($raw)
  $r=$doc.SelectSingleNode('/Service/Request');$st=$doc.SelectSingleNode('/Service/ECRStatus | /Service/Request/ECRStatus')
  if(-not $r){throw 'Risposta RCH senza esito Request.'}
  $values=@{}
  foreach($n in @('errorCode','printerError','paperEnd','coverOpen','busy','lastCmd')){
    $node=$r.SelectSingleNode($n);$values[$n]=if($node){[int]$node.InnerText}else{-1}
  }
  return [pscustomobject]@{ok=($values.errorCode -eq 0 -and $values.printerError -eq 0 -and $values.paperEnd -eq 0 -and $values.coverOpen -eq 0 -and $values.busy -eq 0 -and $values.lastCmd -eq 1);mode=if($st){[string]$st.mode}else{''};idleState=if($st){[string]$st.idleState}else{''};values=$values}
}
function Assert-RegIdle {
  $s=Parse-Rch (Request-Rch '<</?s')
  if(-not $s.ok -or $s.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$' -or $s.idleState -cne '0'){
    throw 'RCH non pronta in REG con documento chiuso. Nessuna programmazione eseguita.'
  }
}
function Patch-Connector([string]$path){
  if(-not (Test-Path -LiteralPath $path -PathType Leaf)){throw "Connettore non trovato: $path"}
  $text=Get-Content -LiteralPath $path -Raw
  if($text -match [regex]::Escape($PatchMarker)){return $false}

  $old=@'
  if($document.automaticReference -eq $true){
    if([string]$document.receiptMarker -cnotmatch '^OPTYKER [A-F0-9]{32}$'){throw 'Riferimento automatico non valido.'}
    $expected.Add(('="/?A/('+$document.receiptMarker+')'))
  }
  if([string]$document.paymentCode -notmatch '^[134]$'){throw 'Pagamento non autorizzato.'}
'@
  if(-not $text.Contains($old)){throw 'Blocco validazione fiscale non riconosciuto: aggiornamento sospeso.'}
  $new=@"
  # $PatchMarker
  if(`$document.automaticReference -eq `$true){throw 'Riferimento automatico legacy non consentito.'}
  if([string]`$document.reviewQr){
    if([string]`$document.reviewQr -cne '$ReviewUrl'){throw 'QR recensioni non autorizzato.'}
    `$expected.Add(('="/`$11/('+`$document.reviewQr+')'))
  }
  if([string]`$document.paymentCode -notmatch '^[134]$'){throw 'Pagamento non autorizzato.'}
"@
  $text=$text.Replace($old,$new)
  $backup=$path+'.pre-review-qr'
  Copy-Item -LiteralPath $path -Destination $backup -Force
  $tmp=$path+'.tmp'
  [System.IO.File]::WriteAllText($tmp,$text,(New-Object System.Text.UTF8Encoding($true)))
  $tokens=$null;$errors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($tmp,[ref]$tokens,[ref]$errors)
  if($errors.Count -gt 0){Remove-Item -LiteralPath $tmp -Force;throw ('Connettore modificato non valido: '+$errors[0].Message)}
  Move-Item -LiteralPath $tmp -Destination $path -Force
  return $true
}

Write-Host 'Optyker RCH - scontrino pulito + QR recensioni Google' -ForegroundColor Cyan
$changed=Patch-Connector $Target
if($changed){Write-Host 'Connettore aggiornato: rimossa la dipendenza dal marcatore OPTYKER.' -ForegroundColor Green}else{Write-Host 'Aggiornamento connettore gia presente.' -ForegroundColor DarkGreen}

# RCH protocol: QR in a commercial document is allowed in the tail with Fidelity enabled.
# Disable the old programmed footer graphic/QR so the customer receives exactly one QR.
Assert-RegIdle
Write-Host 'Abilito la stampa QR in coda al documento...' -ForegroundColor Cyan
$fidelity=Parse-Rch (Request-Rch '>C933/$1')
if(-not $fidelity.ok){throw 'La RCH non ha confermato l abilitazione Fidelity necessaria al QR.'}
Write-Host 'Stampa QR in documento abilitata.' -ForegroundColor Green
Assert-RegIdle
Write-Host 'Disattivo il vecchio logo/QR programmato in coda...' -ForegroundColor Cyan
$ack=Parse-Rch (Request-Rch '>C120/$0')
if(-not $ack.ok){throw 'La RCH non ha confermato la disattivazione del vecchio QR/logo di coda.'}
Write-Host 'Vecchio QR/logo di coda disattivato.' -ForegroundColor Green

# Restart only the local connector process. Startup configuration continues to point to the same file.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object {$_.CommandLine -like '*rch-optyker-connector.ps1*'} |
  ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
$ps=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
Start-Process -FilePath $ps -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$Target+'"'),'-PrinterIp',$PrinterIp,'-Port',$Port) -WorkingDirectory (Split-Path -Parent $Target) -WindowStyle Hidden
Start-Sleep -Seconds 2
$health=Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
if(-not $health.ok){throw 'Connettore riavviato ma health check non confermato.'}
Assert-RegIdle
Write-Host ''
Write-Host 'AGGIORNAMENTO COMPLETATO' -ForegroundColor Green
Write-Host 'Nuovi scontrini: nessuna riga OPTYKER + QR recensioni Google in coda.' -ForegroundColor Green
Write-Host $ReviewUrl -ForegroundColor Cyan
Write-Host 'La RCH resta in REG. Nessun documento fiscale e stato emesso durante l aggiornamento.' -ForegroundColor Yellow
if(-not $NoPause){$null=Read-Host 'Premi INVIO per terminare'}
