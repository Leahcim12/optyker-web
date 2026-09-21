param([switch]$LibraryOnly)
$ErrorActionPreference='Stop'
$DiagnosticVersion='20260921-pending-read1'
$ExpectedSerial='72IV6003831'
$TargetJobIds=@('c6609e8d-397f-4a78-a2e9-8860821473b7','811a8496-8966-4695-8143-b2dbafc52d35')
$script:PrinterIp='192.168.1.10'
$script:ReadCommands=New-Object 'System.Collections.Generic.List[string]'

# Diagnostic only: no fiscal emission, reconciliation, reset, authentication,
# configuration change, daily closure, journal deletion or status overwrite.
function Parse-SafeXml([string]$text){
  if($text.Length -gt 1048576){throw 'Risposta troppo grande.'}
  $settings=New-Object System.Xml.XmlReaderSettings
  $settings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
  $input=New-Object IO.StringReader($text);$reader=[Xml.XmlReader]::Create($input,$settings)
  try{$doc=New-Object Xml.XmlDocument;$doc.XmlResolver=$null;$doc.Load($reader);return ,$doc}
  finally{$reader.Dispose();$input.Dispose()}
}
function Read-LimitedHttp($request){
  $request.Proxy=$null;$request.AllowAutoRedirect=$false;$request.KeepAlive=$false
  $request.Timeout=10000;$request.ReadWriteTimeout=10000;$request.ServicePoint.Expect100Continue=$false
  $response=$request.GetResponse()
  try{
    if([int]$response.StatusCode -ne 200){throw 'Risposta HTTP non confermata.'}
    $reader=New-Object IO.StreamReader($response.GetResponseStream())
    try{
      $buffer=New-Object char[] 4096;$text=New-Object Text.StringBuilder
      while(($n=$reader.Read($buffer,0,$buffer.Length)) -gt 0){
        if($text.Length+$n -gt 1048576){throw 'Risposta troppo grande.'}
        [void]$text.Append($buffer,0,$n)
      }
      return $text.ToString()
    }finally{$reader.Dispose()}
  }finally{$response.Dispose()}
}
function Read-BridgeHealth{
  $req=[Net.HttpWebRequest]::Create('http://127.0.0.1:8765/health');$req.Method='GET'
  return (Read-LimitedHttp $req | ConvertFrom-Json)
}
function Invoke-RchReadCommand([string]$command){
  # Same documented journal-download sequence already implemented by Optyker.
  # C3 selects the journal-reading mode; C1 restores REG. Neither closes the day.
  # /$0 requests the electronic copy only. No /$1 or /$2 print variant is allowed.
  if($command -cnotin @('<</?s','<</?m','<</?d','=C3','=C453/$0','=C1')){throw 'Comando non consentito dalla verifica.'}
  $address=$null
  if(-not [Net.IPAddress]::TryParse($script:PrinterIp,[ref]$address) -or $script:PrinterIp -notmatch '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)'){throw 'Indirizzo locale RCH non valido.'}
  $script:ReadCommands.Add($command)
  $escaped=[Security.SecurityElement]::Escape($command)
  $xml='<?xml version="1.0" encoding="UTF-8"?>'+"`n<Service>`n  <cmd>"+$escaped+"</cmd>`n</Service>`n"
  $bytes=[Text.Encoding]::UTF8.GetBytes($xml)
  $req=[Net.HttpWebRequest]::Create(('http://'+$script:PrinterIp+'/service.cgi'))
  $req.Method='POST';$req.ContentType='application/xml';$req.ContentLength=$bytes.Length
  $req.Proxy=$null;$req.AllowAutoRedirect=$false;$req.KeepAlive=$false;$req.SendChunked=$false
  $req.Timeout=10000;$req.ReadWriteTimeout=10000;$req.ServicePoint.Expect100Continue=$false
  $stream=$req.GetRequestStream();try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  return Read-LimitedHttp $req
}
function Get-StatusEvidence([string]$raw){
  $doc=Parse-SafeXml $raw;$r=$doc.SelectNodes('/Service/Request')
  if($r.Count -ne 1){throw 'Risposta RCH senza esito univoco.'}
  $out=[ordered]@{}
  foreach($name in @('errorCode','printerError','paperEnd','coverOpen','busy','lastCmd')){
    $ns=$r[0].SelectNodes($name);$n=-1
    if($ns.Count -ne 1 -or -not [int]::TryParse($ns[0].InnerText,[ref]$n)){throw ('Risposta incompleta: '+$name)}
    $out[$name]=$n
  }
  $out.ok=($out.errorCode -eq 0 -and $out.printerError -eq 0 -and $out.paperEnd -eq 0 -and $out.coverOpen -eq 0 -and $out.busy -eq 0 -and $out.lastCmd -eq 1)
  $ss=$doc.SelectNodes('/Service/ECRStatus | /Service/Request/ECRStatus')
  if($ss.Count -gt 1){throw 'Stato RCH ambiguo.'}
  foreach($name in @('mode','idleState','lastZ','lastDocF','lastDocNF')){
    $out[$name]=$null
    if($ss.Count -eq 1){$n=$ss[0].SelectNodes($name);if($n.Count -eq 1){$v=$n[0].InnerText;if($v.Length -le 40){$out[$name]=$v}}}
  }
  return [pscustomobject]$out
}
function Assert-IdleReg($s){
  if(-not $s.ok -or [string]$s.mode -cnotmatch '^REG(?:\s*\(OP\s*\d+\))?$' -or [string]$s.idleState -cne '0'){throw 'RCH non libera in REG. Verifica interrotta senza comandi fiscali.'}
}
function Get-Enquiry([string]$raw,[string]$expected){
  $s=Get-StatusEvidence $raw;if(-not $s.ok){throw 'Lettura RCH non confermata.'}
  $doc=Parse-SafeXml $raw;$ns=$doc.SelectNodes('/Service/Enq')
  if($ns.Count -ne 1){throw 'Dato RCH assente o ambiguo.'}
  $name=$ns[0].SelectNodes('name');$val=$ns[0].SelectNodes('value')
  if($name.Count -ne 1 -or $val.Count -ne 1 -or $name[0].InnerText -cne $expected -or $val[0].InnerText.Length -gt 100){throw 'Risposta RCH non corrispondente.'}
  return $val[0].InnerText.Trim()
}
function Get-ReceiptSummary([string]$raw){
  $status=Get-StatusEvidence $raw;if(-not $status.ok){throw 'Lettura memoria del registratore non confermata.'}
  $doc=Parse-SafeXml $raw;$nodes=$doc.SelectNodes('/Service/EJ')
  if($nodes.Count -ne 1){throw 'Ultimo documento non disponibile in modo univoco.'}
  $t=$nodes[0].InnerText.Replace("`r",'');$sha=[Security.Cryptography.SHA256]::Create()
  try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($t))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  # Never export raw journal text: it may contain customer names or fiscal codes.
  $nums=[regex]::Matches($t,'(?m)^\s*DOCUMENTO(?:\s+COMMERCIALE)?\s+N[.\u00b0]?\s*(\d{4}-\d{4})\s*$')
  $dates=[regex]::Matches($t,'(?m)^\s*(\d{2}[-/]\d{2}[-/]\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*$')
  $totals=[regex]::Matches($t,'(?m)^\s*TOTALE COMPLESSIVO\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:EUR|\u20ac)?\s*$')
  $summary=[ordered]@{source='rch_ej_read_only';sha256=$hash;textLength=$t.Length;serialMatched=([regex]::IsMatch($t,'(?<![A-Z0-9])'+$ExpectedSerial+'(?![A-Z0-9])'));documentNumber=$null;documentDate=$null;documentTime=$null;totalCents=$null;kind='unknown';fieldsUnambiguous=$false;operationAutomaticallyResolved=$false}
  if($t -match '(?i)DOCUMENTO\s+(?:COMMERCIALE\s+)?(?:DI\s+)?ANNULL'){$summary.kind='void'}elseif($t -match '(?i)DOCUMENTO\s+(?:COMMERCIALE\s+)?(?:DI\s+)?RESO'){$summary.kind='return'}elseif($t -match 'DOCUMENTO COMMERCIALE'){$summary.kind='sale'}
  if($nums.Count -eq 1){$summary.documentNumber=$nums[0].Groups[1].Value}
  if($dates.Count -eq 1){$summary.documentDate=$dates[0].Groups[1].Value;$summary.documentTime=$dates[0].Groups[2].Value}
  if($totals.Count -eq 1){$amount=[decimal]::Parse($totals[0].Groups[1].Value.Replace('.','').Replace(',','.'),[Globalization.CultureInfo]::InvariantCulture);$summary.totalCents=[long]($amount*100)}
  $summary.fieldsUnambiguous=($nums.Count -eq 1 -and $dates.Count -eq 1 -and $totals.Count -eq 1 -and $summary.serialMatched)
  return [pscustomobject]$summary
}
function Safe-JournalEntry([string]$path,[string]$expectedId){
  if(-not (Test-Path -LiteralPath $path -PathType Leaf)){return @{present=$false;jobId=$expectedId}}
  if((Get-Item -LiteralPath $path).Length -gt 131072){return @{present=$true;jobId=$expectedId;readError='File troppo grande'}}
  try{
    $raw=[IO.File]::ReadAllText($path);$j=$raw | ConvertFrom-Json
    if([string]$j.jobId -cne $expectedId){throw 'Identificativo del registro locale non coerente.'}
    $out=[ordered]@{present=$true;jobId=$expectedId}
    foreach($name in @('operation','state','writeStarted','commandsAcknowledged','idleAfter','cloudSaved','createdAt','fidelityCloseStarted','fidelityCloseAcknowledged')){
      $v=$j.$name
      if($null -eq $v -or $v -is [bool] -or $v -is [int] -or $v -is [long]){$out[$name]=$v}
      elseif($v -is [string] -and $v.Length -le 100 -and $v -match '^[a-zA-Z0-9_:./+() -]*$'){$out[$name]=$v}
    }
    # Deliberately exclude credentials, protected tokens, fiscal identities,
    # arbitrary nested data and original free-form exception messages.
    $out.hasStoredError=-not [string]::IsNullOrWhiteSpace([string]$j.error)
    $out.hasReference=($null -ne $j.reference)
    return [pscustomobject]$out
  }catch{return @{present=$true;jobId=$expectedId;readError='Registro locale non leggibile o non coerente'}}
}
function Get-PendingDiagnostic([string]$base){
  $script:ReadCommands.Clear()
  $report=[ordered]@{version=$DiagnosticVersion;generatedAt=(Get-Date).ToString('o');readOnlyFiscalData=$true;emittedFiscalDocument=$false;changedPayments=$false;changedJournal=$false;dailyClosureExecuted=$false;uploadedAnything=$false;transientReadModeAttempted=$false;regRestored=$null;collectionCompleted=$false;stopReason=$null;health=$null;localJournal=@();statusBefore=$null;clock=$null;lastReceipt=$null;statusAfter=$null;commands=@();requiresReview=$true}
  $lock=$null;$journal=Join-Path $base 'receipts'
  try{
    if(-not (Test-Path -LiteralPath $journal -PathType Container)){throw 'Registri Optyker non trovati: esegui il file sul PC Windows della cassa, con il solito utente.'}
    $health=Read-BridgeHealth
    if($health.ok -ne $true -or $health.connector -ne 'Optyker RCH'){throw 'Connettore locale non riconosciuto.'}
    $report.health=@{connector='Optyker RCH';version=([string]$health.version).Substring(0,[Math]::Min(80,([string]$health.version).Length));reachable=$true}
    # No endpoint supplied by a website/config file; only the printer reported by
    # the already installed local bridge, validated as a private IPv4 address.
    $address=$null
    if(-not [Net.IPAddress]::TryParse([string]$health.printer,[ref]$address) -or [string]$health.printer -notmatch '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)'){throw 'Indirizzo RCH locale non verificato.'}
    $script:PrinterIp=[string]$health.printer
    $lockPath=Join-Path $journal 'printer.lock'
    if(-not (Test-Path -LiteralPath $lockPath -PathType Leaf)){throw 'Blocco di coordinamento del connettore non trovato.'}
    # Open the EXISTING lock only. Nothing in receipts is created or overwritten.
    $lock=[IO.File]::Open($lockPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $rows=New-Object 'System.Collections.Generic.List[object]'
    foreach($id in $TargetJobIds){
      $path=Join-Path $journal ($id+'.json')
      $current=Safe-JournalEntry $path $id
      $previous=Safe-JournalEntry ($path+'.previous') $id
      $rows.Add(@{current=$current;previous=$previous})
    }
    $report.localJournal=$rows.ToArray()
    $before=Get-StatusEvidence (Invoke-RchReadCommand '<</?s');$report.statusBefore=$before;Assert-IdleReg $before
    $serial=Get-Enquiry (Invoke-RchReadCommand '<</?m') 'm'
    if($serial -cne $ExpectedSerial){throw 'Matricola diversa dalla RCH prevista. Nessuna lettura del documento eseguita.'}
    $clock=Get-Enquiry (Invoke-RchReadCommand '<</?d') 'd'
    if($clock -match '^[0-9 :./+-]{1,60}$'){$report.clock=$clock}
    $before=Get-StatusEvidence (Invoke-RchReadCommand '<</?s');Assert-IdleReg $before
    try{
      # Read electronic copy only; always attempt to restore REG in finally,
      # even if entering reading mode times out. Never call a daily closure.
      $report.transientReadModeAttempted=$true
      $z=Get-StatusEvidence (Invoke-RchReadCommand '=C3')
      if(-not $z.ok){throw 'Accesso alla lettura non confermato.'}
      $report.lastReceipt=Get-ReceiptSummary (Invoke-RchReadCommand '=C453/$0')
      if(-not $report.lastReceipt.fieldsUnambiguous){throw 'Documento letto ma dati non univoci: richiede verifica tecnica.'}
      $report.collectionCompleted=$true
    }finally{
      $report.regRestored=$false
      $r=Get-StatusEvidence (Invoke-RchReadCommand '=C1')
      if(-not $r.ok){throw 'Ritorno in REG non confermato. Controlla il display fisico; nessuna chiusura giornaliera e stata richiesta.'}
      $after=Get-StatusEvidence (Invoke-RchReadCommand '<</?s');$report.statusAfter=$after;Assert-IdleReg $after;$report.regRestored=$true
    }
  }catch{$report.collectionCompleted=$false;$report.stopReason=$_.Exception.Message}
  finally{if($null -ne $lock){$lock.Dispose()};$report.commands=$script:ReadCommands.ToArray()}
  return [pscustomobject]$report
}
function Save-PendingReport($report){
  $folder=[Environment]::GetFolderPath('Desktop')
  if(-not $folder -or -not (Test-Path -LiteralPath $folder -PathType Container)){$folder=[Environment]::GetFolderPath('MyDocuments')}
  if(-not $folder -or -not (Test-Path -LiteralPath $folder -PathType Container)){throw 'Desktop e Documenti non disponibili.'}
  $path=Join-Path $folder ('Optyker-Scontrino-Sospeso-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6)+'.json')
  [IO.File]::WriteAllText($path,(ConvertTo-Json -InputObject $report -Depth 12),(New-Object Text.UTF8Encoding($true)))
  return $path
}
if($LibraryOnly){return}
Write-Host 'OPTYKER - VERIFICA SCONTRINO SOSPESO' -ForegroundColor Cyan
Write-Host 'Lascia libera la RCH: non usarla da Optyker, Focus o tastiera durante questa verifica.'
Write-Host 'Nessun incasso, stampa, annullo o chiusura giornaliera. Nessuna installazione.'
Write-Host 'Lettura della memoria: passaggio temporaneo alla lettura e ritorno in REG.'
try{
  if(-not $env:LOCALAPPDATA){throw 'Esegui il file sul PC Windows della cassa.'}
  $report=Get-PendingDiagnostic (Join-Path $env:LOCALAPPDATA 'OptykerRCH')
  $saved=Save-PendingReport $report
  Write-Host ''
  Write-Host ('Rapporto creato: '+$saved) -ForegroundColor Green
  if($report.stopReason){Write-Host ('Verifica da completare: '+$report.stopReason) -ForegroundColor Yellow}
  Write-Host 'Allega alla chat il file Optyker-Scontrino-Sospeso....json appena creato.'
  Write-Host 'Lo stato dello scontrino NON e stato cambiato. Non ripetere Incassa.'
  try{Start-Process explorer.exe -ArgumentList ('/select,"'+$saved+'"')}catch{}
}catch{Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red;exit 1}
