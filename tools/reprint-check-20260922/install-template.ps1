param([switch]$LibraryOnly)
$ErrorActionPreference='Stop'
$MatchVersion='20260922-match1'
$NewAssert=@'
__ASSERT_FUNCTION__
'@
function Get-ReprintPatch([string]$source) {
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Il connettore installato contiene errori. Nessuna modifica applicata.'}
  $old=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Assert-ReprintJournal'},$true))
  if($old.Count -ne 1 -or -not $source.Contains('# BEGIN OPTYKER_RCH_REPRINT_V1') -or -not $source.Contains('function Reprint-Receipt')){throw 'Funzione ristampa non riconosciuta: nessuna modifica applicata.'}
  $start=$old[0].Extent.StartOffset;$end=$old[0].Extent.EndOffset
  $patched=$source.Substring(0,$start)+$NewAssert.TrimEnd()+$source.Substring($end)
  $patched=[regex]::Replace($patched,"reprintMatchVersion='[a-zA-Z0-9-]+';",'')
  if(([regex]::Matches($patched,[regex]::Escape('reprintReceipt=$true;'))).Count -ne 1){throw 'Capacita ristampa non univoca.'}
  $patched=$patched.Replace('reprintReceipt=$true;',("reprintMatchVersion='"+$MatchVersion+"';reprintReceipt=`$true;"))
  $after=[Management.Automation.Language.Parser]::ParseInput($patched,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Verifica del nuovo codice non riuscita: originale conservato.'}
  $beforeFns=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -cne 'Assert-ReprintJournal'},$true))
  $afterFns=@($after.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -cne 'Assert-ReprintJournal'},$true))
  if($beforeFns.Count -ne $afterFns.Count){throw 'Il numero delle funzioni originali e cambiato.'}
  for($i=0;$i -lt $beforeFns.Count;$i++){if($beforeFns[$i].Extent.Text -cne $afterFns[$i].Extent.Text){throw ('Funzione originale alterata: '+$beforeFns[$i].Name)}}
  return $patched
}
function Get-LocalReprintHealth {return Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -Method Get -Headers @{Origin='https://optyker.it'} -TimeoutSec 4}
function Find-ConnectorProcesses([string]$path){
  $pattern='(?i)(?:^|\s)-File\s+(?:"'+[regex]::Escape($path)+'"|'+[regex]::Escape($path)+')(?:\s|$)'
  return @(Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match $pattern})
}
function Start-InstalledReprintConnector([string]$path,[string]$ip){return Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$path+'" -PrinterIp '+$ip+' -Port 8765') -WindowStyle Hidden -PassThru}
function Install-ReprintMatch {
  $base=Join-Path $env:LOCALAPPDATA 'OptykerRCH';$target=Join-Path $base 'rch-optyker-connector.ps1'
  $lock=$null;$tmp=$null;$backup=$null;$changed=$false;$started=$null
  try {
    if(-not (Test-Path -LiteralPath $target -PathType Leaf)){throw 'Apri questo aggiornamento sul PC Windows della cassa, con il solito utente.'}
    $health=Get-LocalReprintHealth
    if($health.ok -ne $true -or $health.capabilities.reprintReceipt -ne $true){throw 'Connettore ristampa non raggiungibile. Avvia Optyker RCH e riprova.'}
    $ip=$null
    if(-not [Net.IPAddress]::TryParse([string]$health.printer,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Indirizzo stampante non valido.'}
    if($health.capabilities.reprintMatchVersion -ceq $MatchVersion){Write-Host 'Aggiornamento ristampa gia attivo.';return}
    $processes=@(Find-ConnectorProcesses $target)
    if($processes.Count -ne 1){throw 'Non riesco a identificare un solo connettore da riavviare. Nessuna modifica eseguita.'}
    $journal=Join-Path $base 'receipts'
    if(-not (Test-Path -LiteralPath $journal -PathType Container)){throw 'Registro del PC non trovato. Nessuna modifica applicata.'}
    $lock=[IO.File]::Open((Join-Path $journal 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $status=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/status' -Method Get -Headers @{Origin='https://optyker.it'} -TimeoutSec 8
    if($status.ok -ne $true -or [string]$status.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$' -or [string]$status.idleState -cne '0' -or @('errorCode','printerError','paperEnd','coverOpen','busy' | Where-Object {$null -eq $status.$_ -or [int]$status.$_ -ne 0}).Count){throw 'La RCH non e libera in REG: aggiornamento non applicato.'}
    $original=[IO.File]::ReadAllBytes($target);$source=[IO.File]::ReadAllText($target);$patched=Get-ReprintPatch $source
    $suffix=[guid]::NewGuid().ToString('N');$tmp=$target+'.reprint-'+$suffix+'.tmp';$backup=$target+'.before-reprint-'+$suffix
    [IO.File]::WriteAllText($tmp,$patched,(New-Object Text.UTF8Encoding($true)))
    if([Convert]::ToBase64String([IO.File]::ReadAllBytes($target)) -cne [Convert]::ToBase64String($original)){throw 'Connettore modificato contemporaneamente: aggiornamento non applicato.'}
    [IO.File]::Replace($tmp,$target,$backup);$tmp=$null;$changed=$true
    Stop-Process -Id $processes[0].ProcessId -Force
    Start-Sleep -Milliseconds 700
    $started=Start-InstalledReprintConnector $target $ip.ToString()
    $ready=$false
    for($i=0;$i -lt 20;$i++){Start-Sleep -Milliseconds 400;try{$h=Get-LocalReprintHealth;if($h.ok -eq $true -and $h.capabilities.reprintMatchVersion -ceq $MatchVersion){$ready=$true;break}}catch{}}
    if(-not $ready){throw 'Il connettore aggiornato non ha confermato l avvio.'}
    $changed=$false
    Write-Host 'AGGIORNAMENTO RISTAMPA INSTALLATO.' -ForegroundColor Green
    Write-Host 'Riapri Optyker > Ultime vendite > Ristampa su RCH RT.'
    Write-Host 'Nessuna stampa, chiusura cassa o modifica agli incassi eseguita.'
  }catch{
    $message=$_.Exception.Message
    if($changed -and $backup -and (Test-Path -LiteralPath $backup)){
      try{
        if($started){Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue}
        $restore=$target+'.restore-'+[guid]::NewGuid().ToString('N');[IO.File]::WriteAllBytes($restore,[IO.File]::ReadAllBytes($backup))
        [IO.File]::Replace($restore,$target,($target+'.failed-update-'+[guid]::NewGuid().ToString('N')))
        if(@(Find-ConnectorProcesses $target).Count -eq 0){$null=Start-InstalledReprintConnector $target $ip.ToString()}
        Write-Host 'Versione precedente ripristinata. Nessun registro modificato.' -ForegroundColor Yellow
      }catch{Write-Host ('Ripristino da verificare. Copia originale: '+$backup) -ForegroundColor Red}
    }
    throw $message
  }finally{if($lock){$lock.Dispose()};if($tmp -and (Test-Path -LiteralPath $tmp)){Remove-Item -LiteralPath $tmp -Force}}
}
if($LibraryOnly){return}
try{Install-ReprintMatch}catch{Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red;exit 1}
