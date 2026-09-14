$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$target=Join-Path $base 'rch-optyker-connector.ps1'
$temp=Join-Path $base ('ristampa-'+[guid]::NewGuid()+'.tmp')
$lock=$null
try {
  if(-not (Test-Path -LiteralPath $target)){throw 'Connettore RCH non installato su questo PC.'}
  $health=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 3
  if($health.ok -ne $true){throw 'Avvia il connettore Optyker RCH prima di aggiornare.'}
  $ip=$null
  if(-not [Net.IPAddress]::TryParse([string]$health.printer,[ref]$ip)){throw 'Indirizzo RCH non disponibile.'}
  $sourceUrl='https://leahcim12.github.io/optyker-web/rch-connector/rch-optyker-connector.ps1?v=20260914-reprint3'
  Invoke-WebRequest -UseBasicParsing -Uri $sourceUrl -OutFile $temp
  $latest=Get-Content -LiteralPath $temp -Raw
  $block=[regex]::Match($latest,'(?s)# BEGIN OPTYKER_RCH_REPRINT_V1.*?# END OPTYKER_RCH_REPRINT_V1').Value
  if(-not $block){throw 'Aggiornamento ristampa non ancora disponibile. Riprova tra qualche minuto.'}
  $src=Get-Content -LiteralPath $target -Raw
  if(-not $src.Contains('function Assert-FiscalDocument') -or -not $src.Contains('function Assert-NoUncertainReceipt')){throw 'Connettore non riconosciuto: nessuna modifica applicata.'}
  if($src.Contains('# BEGIN OPTYKER_RCH_REPRINT_V1')){
    $src=[regex]::Replace($src,'(?s)# BEGIN OPTYKER_RCH_REPRINT_V1.*?# END OPTYKER_RCH_REPRINT_V1',[Text.RegularExpressions.MatchEvaluator]{param($m) $block})
  }else{
    $anchor='function Diagnostics-Rch {'
    if(-not $src.Contains($anchor)){throw 'Punto di integrazione non riconosciuto.'}
    $src=$src.Replace($anchor,$block+"`r`n`r`n"+$anchor)
  }
  if(-not $src.Contains("`$request.path -eq '/receipt/reprint'")){
    $anchor="} elseif(`$request.method -eq 'POST' -and `$request.path -eq '/receipt/status'){"
    if(-not $src.Contains($anchor)){throw 'Endpoint del connettore non riconosciuti.'}
    $route="} elseif(`$request.method -eq 'POST' -and `$request.path -eq '/receipt/reprint'){`r`n        Json-Response `$stream 200 (Reprint-Receipt (`$request.body | ConvertFrom-Json))`r`n      "
    $src=$src.Replace($anchor,$route+$anchor)
  }
  if(-not $src.Contains('reprintReceipt=$true')){
    if(-not $src.Contains('diagnostics=$true;receipt=')){throw 'Capacita del connettore non riconosciute.'}
    $src=$src.Replace('diagnostics=$true;receipt=','reprintReceipt=$true;diagnostics=$true;receipt=')
  }
  [IO.File]::WriteAllText($temp,$src,(New-Object Text.UTF8Encoding($true)))
  $tokens=$null;$errors=$null
  [void][Management.Automation.Language.Parser]::ParseFile($temp,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Verifica PowerShell fallita. Nessuna modifica applicata.'}
  $journal=Join-Path $base 'receipts'
  New-Item -ItemType Directory -Force -Path $journal | Out-Null
  $lock=[IO.File]::Open((Join-Path $journal 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  # The exclusive printer lock above excludes any active Emit-Receipt operation.
  # Stale journals must survive installation verbatim; they still block fiscal operations.
  $pending=0
  foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json'){
    $j=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
    if($j.state -in @('claiming','sending','uncertain')){$pending++}
  }
  $status=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/status' -TimeoutSec 5
  if($status.ok -ne $true -or $status.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$' -or [string]$status.idleState -cne '0'){throw 'La RCH deve essere pronta in REG, senza documenti aperti.'}
  Copy-Item -LiteralPath $target -Destination ($target+'.pre-reprint-'+(Get-Date -Format yyyyMMddHHmmss))
  # Keep the installed emission implementation, version, QR/POS patches and journal.
  Move-Item -LiteralPath $temp -Destination $target -Force
  Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($target) -and $_.ProcessId -ne $PID} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force}
  Start-Sleep -Milliseconds 500
  Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$target+'" -PrinterIp '+$ip.ToString()+' -Port 8765') -WindowStyle Hidden
  $lock.Dispose();$lock=$null
  $ok=$false
  for($i=0;$i -lt 20;$i++){
    Start-Sleep -Milliseconds 400
    try{$h=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2;if($h.capabilities.reprintReceipt -eq $true){$ok=$true;break}}catch{}
  }
  if(-not $ok){throw 'Aggiornamento salvato. Riavvia il PC per avviare il connettore aggiornato.'}
  Write-Host 'Aggiornamento ristampa installato. Ricarica Optyker.' -ForegroundColor Green
  if($pending -gt 0){
    Write-Host ('Restano '+$pending+' operazioni da verificare. I loro esiti sono stati conservati senza modifiche.') -ForegroundColor Yellow
    Write-Host 'Se il documento e stato verificato e registrato in Optyker, usa Ristampa su RCH RT per sincronizzare questa operazione. Gli altri esiti richiedono verifica.' -ForegroundColor Yellow
  }else{Write-Host 'Apri Ultime vendite > Ristampa su RCH RT.' -ForegroundColor Green}
}catch{Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red;exit 1}
finally{if($lock){$lock.Dispose()};Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
