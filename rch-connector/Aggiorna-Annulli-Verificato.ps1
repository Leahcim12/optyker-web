param([switch]$LibraryOnly)
$ErrorActionPreference='Stop'

function Assert-RchScript([string]$source) {
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
  if($errors.Count -gt 0){throw ('PowerShell, riga '+$errors[0].Extent.StartLineNumber+': '+$errors[0].Message)}
  return $ast
}
function Replace-RchRange([string]$source,[int]$start,[int]$length,[string]$replacement) {
  # Literal insertion: never interpret $ in source code as regex replacement tokens.
  return $source.Remove($start,$length).Insert($start,$replacement)
}
function Get-RchFunction([object]$ast,[string]$name) {
  $found=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
  if($found.Count -ne 1){throw ('Funzione non univoca: '+$name)}
  return $found[0].Extent.Text
}
function New-RchVoidSource([string]$installed,[string]$verified) {
  $before=Assert-RchScript $installed
  $null=Assert-RchScript $verified
  $source=$installed
  foreach($name in @('OPTYKER_RCH_REFERENCE_V2','OPTYKER_REFERENCE_BEFORE_V2','OPTYKER_REFERENCE_AFTER_V2')){
    $pattern='(?s)# BEGIN '+$name+'\b.*?# END '+$name+'\b'
    $fresh=[regex]::Matches($verified,$pattern)
    $old=[regex]::Matches($source,$pattern)
    if($fresh.Count -ne 1 -or $old.Count -gt 1){throw ('Blocco non univoco: '+$name)}
    $block=$fresh[0].Value
    if($old.Count -eq 1){$source=Replace-RchRange $source $old[0].Index $old[0].Length $block}
    else {
      if($name -eq 'OPTYKER_RCH_REFERENCE_V2'){$anchor='function Diagnostics-Rch {'}
      elseif($name -eq 'OPTYKER_REFERENCE_BEFORE_V2'){$anchor='      foreach($command in $claimed.document.commands){'}
      else{$anchor='      $entry.idleAfter=$true;$entry.state=''closing_acknowledged'';Save-Journal $entry'}
      $matches=[regex]::Matches($source,[regex]::Escape($anchor))
      if($matches.Count -ne 1){throw ('Connettore non riconosciuto: '+$name)}
      $i=$matches[0].Index
      if($name -eq 'OPTYKER_REFERENCE_AFTER_V2'){$i+=$anchor.Length;$source=$source.Insert($i,"`r`n      "+$block)}
      else{$source=$source.Insert($i,$block+"`r`n")}
    }
  }
  $cap=[regex]::Matches($source,'automaticVoidReference\s*=\s*\$(?:true|false)\b')
  if($cap.Count -gt 1){throw 'Dichiarazione capacita annullo ambigua.'}
  if($cap.Count -eq 1){$source=Replace-RchRange $source $cap[0].Index $cap[0].Length 'automaticVoidReference=$true'}
  else {
    $cap=[regex]::Matches($source,'manualReference\s*=\s*\$true\b')
    if($cap.Count -ne 1){throw 'Dichiarazione capacita connettore non riconosciuta.'}
    $source=$source.Insert($cap[0].Index+$cap[0].Length,';automaticVoidReference=$true')
  }
  $after=Assert-RchScript $source
  # Transport, validation, journal and emission semantics outside the three
  # versioned evidence blocks remain exactly as installed (including POS/QR).
  foreach($fn in @('Assert-FiscalDocument','Assert-NoUncertainReceipt','Assert-IdleRegister','Save-Journal','Read-Journal','Request-Printer','Read-StatusProbe','Test-HttpAccess')){
    if((Get-RchFunction $before $fn) -cne (Get-RchFunction $after $fn)){throw ('Protezione modificata: '+$fn)}
  }
  $emBefore=Get-RchFunction $before 'Emit-Receipt'
  $emAfter=Get-RchFunction $after 'Emit-Receipt'
  $markers='(?s)\s*# BEGIN OPTYKER_REFERENCE_(?:BEFORE|AFTER)_V2\b.*?# END OPTYKER_REFERENCE_(?:BEFORE|AFTER)_V2\b\s*'
  if([regex]::Replace($emBefore,$markers,'').Replace("`r",'') -cne [regex]::Replace($emAfter,$markers,'').Replace("`r",'')){
    # When adding a previously absent block, whitespace at its insertion point
    # can differ; token comparison below allows only whitespace differences.
    $a=[regex]::Replace([regex]::Replace($emBefore,$markers,''),'\s+','')
    $b=[regex]::Replace([regex]::Replace($emAfter,$markers,''),'\s+','')
    if($a -cne $b){throw 'La sequenza di emissione verrebbe modificata: aggiornamento bloccato.'}
  }
  return $source
}
function Read-RchHealth([int]$port) {
  return Invoke-RestMethod -Uri ("http://127.0.0.1:$port/health") -Headers @{Origin='https://optyker.it'} -TimeoutSec 3
}
function Wait-RchHealth([int]$port) {
  for($i=0;$i -lt 20;$i++){
    Start-Sleep -Milliseconds 400
    try{$h=Read-RchHealth $port;if($h.ok -eq $true -and $h.connector -eq 'Optyker RCH'){return $h}}catch{}
  }
  throw 'Il connettore locale non risponde al controllo di avvio.'
}
function Start-RchConnector([string]$exe,[string]$target,[string]$ip,[int]$port) {
  $args='-NoLogo -NoProfile -ExecutionPolicy Bypass -File "'+$target+'" -PrinterIp "'+$ip+'" -Port '+$port
  return Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory (Split-Path $target) -WindowStyle Hidden -PassThru
}
function Install-RchVoid {
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Esegui questo aggiornamento sul PC Windows della cassa.'}
  $base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
  $target=Join-Path $base 'rch-optyker-connector.ps1'
  $payload=Join-Path $PSScriptRoot 'connector-verificato.txt'
  $expected='e2c4402c6e7bcec433e33b8fb8cf6aca6bf6646b7b24291d9b0cecf43d88f2d7'
  if(-not (Test-Path -LiteralPath $target -PathType Leaf)){throw 'Connettore locale non trovato.'}
  if(-not (Test-Path -LiteralPath $payload -PathType Leaf)){throw 'Estrai TUTTI i file dello ZIP nella stessa cartella.'}
  if((Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected){throw 'Pacchetto non integro. Nessuna modifica applicata.'}
  $h=Read-RchHealth 8765
  if($h.ok -ne $true -or $h.connector -ne 'Optyker RCH' -or [int]$h.port -ne 8765){throw 'Connettore locale non riconosciuto.'}
  $ip=$null
  if(-not [Net.IPAddress]::TryParse([string]$h.printer,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Indirizzo della RCH non valido.'}
  $original=[IO.File]::ReadAllText($target,[Text.Encoding]::UTF8)
  $verified=[IO.File]::ReadAllText($payload,[Text.Encoding]::UTF8)
  $patched=New-RchVoidSource $original $verified
  $temp=Join-Path $base ('annulli-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $backup=$target+'.prima-annulli-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N')
  $lock=$null;$stopped=$false;$replaced=$false;$started=$null
  $exe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  try{
    [IO.File]::WriteAllText($temp,$patched,(New-Object Text.UTF8Encoding($true)))
    $null=Assert-RchScript ([IO.File]::ReadAllText($temp,[Text.Encoding]::UTF8))
    $journal=Join-Path $base 'receipts'
    New-Item -ItemType Directory -Force -Path $journal | Out-Null
    $lock=[IO.File]::Open((Join-Path $journal 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json'){
      $j=Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
      if([string]$j.state -in @('claiming','sending')){throw 'Emissione in corso o interrotta da verificare: non riavvio il connettore.'}
    }
    $s=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/status' -Headers @{Origin='https://optyker.it'} -TimeoutSec 12
    if($s.ok -ne $true -or [string]$s.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$' -or [string]$s.idleState -cne '0'){throw 'La RCH deve essere pronta in REG e senza documento aperto.'}
    foreach($k in @('busy','errorCode','printerError','paperEnd','coverOpen')){if($null -eq $s.$k -or [int]$s.$k -ne 0){throw ('RCH non pronta: '+$k)}}
    $pattern='(?i)(?:^|\s)-File\s+(?:"'+[regex]::Escape($target)+'"|'+[regex]::Escape($target)+'(?=\s|$))'
    $procs=@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -match $pattern})
    if($procs.Count -ne 1){throw 'Processo del connettore non univoco: nessun processo verra fermato.'}
    $listener=@(Get-NetTCPConnection -State Listen -LocalPort 8765)
    if(-not $listener.Count -or @($listener | Where-Object {$_.OwningProcess -ne $procs[0].ProcessId}).Count){throw 'La porta locale appartiene a un altro processo.'}
    if([IO.File]::ReadAllText($target,[Text.Encoding]::UTF8) -cne $original){throw 'Il connettore e cambiato durante la verifica. Nessuna modifica applicata.'}
    Write-Host 'File verificati. Aggiornamento dei soli riferimenti annullo...' -ForegroundColor Cyan
    Stop-Process -Id $procs[0].ProcessId -Force -ErrorAction Stop
    $stopped=$true
    Start-Sleep -Milliseconds 700
    [IO.File]::Replace($temp,$target,$backup)
    $replaced=$true
    $started=Start-RchConnector $exe $target $ip.ToString() 8765
    $after=Wait-RchHealth 8765
    $newListener=@(Get-NetTCPConnection -State Listen -LocalPort 8765)
    if(-not $newListener.Count -or @($newListener | Where-Object {$_.OwningProcess -ne $started.Id}).Count){throw 'Risposta di avvio proveniente da un altro processo.'}
    if($after.capabilities.automaticVoidReference -ne $true -or $after.version -cne $h.version){throw 'Funzione annulli non confermata dopo aggiornamento.'}
    Write-Host ''
    Write-Host 'AGGIORNAMENTO VERIFICATO - FUNZIONE ANNULLI DISPONIBILE' -ForegroundColor Green
    Write-Host ('Connettore: '+$after.version)
    Write-Host 'automaticVoidReference: True'
    Write-Host 'Cloud Relay e registri degli scontrini non modificati.'
    Write-Host ('Copia di sicurezza: '+$backup)
    Write-Host 'Nessun annullo, scontrino, chiusura Z o invio TS richiesto da questo aggiornamento.'
    Write-Host 'L annullo dei 70 euro NON e stato eseguito. Comunica questo esito prima di procedere.' -ForegroundColor Yellow
  }catch{
    $reason=$_.Exception.Message
    if($stopped){
      try{
        if($started -and -not $started.HasExited){Stop-Process -Id $started.Id -Force -ErrorAction Stop}
        if($replaced){Copy-Item -LiteralPath $backup -Destination $target -Force}
        $null=Start-RchConnector $exe $target $ip.ToString() 8765
        $null=Wait-RchHealth 8765
        Write-Host 'Versione precedente ripristinata e riavviata.' -ForegroundColor Yellow
      }catch{Write-Host ('Ripristino automatico da verificare: '+$_.Exception.Message+'. Backup: '+$backup) -ForegroundColor Red}
    }
    throw $reason
  }finally{
    if($lock){$lock.Dispose()}
    if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
  }
}
if($LibraryOnly){return}
try{
  Write-Host 'OPTYKER - AGGIORNAMENTO ANNULLI VERIFICATO' -ForegroundColor Cyan
  Install-RchVoid
}catch{
  Write-Host ('AGGIORNAMENTO NON CONFERMATO: '+$_.Exception.Message) -ForegroundColor Red
  Write-Host 'Non ripetere annulli e non cancellare i registri della cassa.' -ForegroundColor Yellow
  exit 1
}
