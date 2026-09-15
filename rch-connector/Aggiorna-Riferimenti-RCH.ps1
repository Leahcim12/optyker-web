$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$target=Join-Path $base 'rch-optyker-connector.ps1'
$temp=Join-Path $base ('riferimenti-'+[guid]::NewGuid()+'.tmp')
$lock=$null
try {
  if(-not (Test-Path -LiteralPath $target)){throw 'Connettore RCH non installato su questo PC.'}
  $health=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 3
  if($health.ok -ne $true){throw 'Avvia il connettore Optyker RCH prima di aggiornare.'}
  $ip=$null
  if(-not [Net.IPAddress]::TryParse([string]$health.printer,[ref]$ip)){throw 'Indirizzo RCH non disponibile.'}
  $sourceUrl='https://leahcim12.github.io/optyker-web/rch-connector/rch-optyker-connector.ps1?v=20260915-reference2'
  Invoke-WebRequest -UseBasicParsing -Uri $sourceUrl -OutFile $temp
  $latest=[IO.File]::ReadAllText($temp,[Text.Encoding]::UTF8)
  $src=[IO.File]::ReadAllText($target,[Text.Encoding]::UTF8)
  if(-not $src.Contains('function Assert-FiscalDocument') -or -not $src.Contains('function Assert-NoUncertainReceipt')){throw 'Connettore non riconosciuto: nessuna modifica applicata.'}
  foreach($name in @('OPTYKER_RCH_REFERENCE_V2','OPTYKER_REFERENCE_BEFORE_V2','OPTYKER_REFERENCE_AFTER_V2')){
    $pattern='(?s)# BEGIN '+$name+'.*?# END '+$name
    $block=[regex]::Match($latest,$pattern).Value
    if(-not $block){throw 'Aggiornamento riferimenti non disponibile.'}
    if([regex]::IsMatch($src,$pattern)){
      $src=[regex]::Replace($src,$pattern,[Text.RegularExpressions.MatchEvaluator]{param($m) $block})
    }else{
      if($name -eq 'OPTYKER_RCH_REFERENCE_V2'){$anchor='function Diagnostics-Rch {'}
      elseif($name -eq 'OPTYKER_REFERENCE_BEFORE_V2'){$anchor='      foreach($command in $claimed.document.commands){'}
      else{$anchor='      $entry.idleAfter=$true;$entry.state=''closing_acknowledged'';Save-Journal $entry'}
      if(([regex]::Matches($src,[regex]::Escape($anchor))).Count -ne 1){throw 'Versione del connettore non riconosciuta: nessuna modifica applicata.'}
      if($name -eq 'OPTYKER_REFERENCE_AFTER_V2'){$src=$src.Replace($anchor,$anchor+"`r`n      "+$block)}
      else{$src=$src.Replace($anchor,$block+"`r`n"+$anchor)}
    }
  }
  if(-not $src.Contains('journalReference=$true')){
    if(-not $src.Contains('manualReference=$true')){throw 'Capacita del connettore non riconosciute.'}
    $src=$src.Replace('manualReference=$true','manualReference=$true;journalReference=$true')
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
  Copy-Item -LiteralPath $target -Destination ($target+'.pre-reference-'+(Get-Date -Format yyyyMMddHHmmss))
  # Keep the installed emission implementation, version, QR/POS patches and journal.
  Move-Item -LiteralPath $temp -Destination $target -Force
  Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($target) -and $_.ProcessId -ne $PID} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force}
  Start-Sleep -Milliseconds 500
  Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$target+'" -PrinterIp '+$ip.ToString()+' -Port 8765') -WindowStyle Hidden
  $lock.Dispose();$lock=$null
  $ok=$false
  for($i=0;$i -lt 20;$i++){
    Start-Sleep -Milliseconds 400
    try{$h=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2;if($h.capabilities.journalReference -eq $true){$ok=$true;break}}catch{}
  }
  if(-not $ok){throw 'Aggiornamento salvato. Riavvia il PC per avviare il connettore aggiornato.'}
  Write-Host 'Recupero automatico numero e importo installato. Ricarica Optyker. Vale per i prossimi scontrini.' -ForegroundColor Green
  if($pending -gt 0){
    Write-Host ('Restano '+$pending+' operazioni da verificare. I loro esiti sono stati conservati senza modifiche.') -ForegroundColor Yellow
    Write-Host 'Per gli scontrini precedenti conserva la verifica dalla stampa.' -ForegroundColor Yellow
  }
}catch{Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red;exit 1}
finally{if($lock){$lock.Dispose()};Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
