$ErrorActionPreference='Stop'
$Base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$Target=Join-Path $Base 'rch-optyker-connector.ps1'
$Backup=$Target+'.pre-pos19'
$Port=8765

function Fail([string]$m){Write-Host '';Write-Host ('ERRORE: '+$m) -ForegroundColor Red;exit 1}
if(-not (Test-Path -LiteralPath $Target -PathType Leaf)){Fail 'Connettore RCH non installato. Apri Optyker > Cassa > RCH e usa Installa / aggiorna connettore.'}

$activeWrite=$false
$Journal=Join-Path $Base 'receipts'
if(Test-Path -LiteralPath $Journal){
  foreach($f in Get-ChildItem -LiteralPath $Journal -Filter '*.json' -ErrorAction SilentlyContinue){
    try{$j=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json;if($j.state -in @('claiming','sending')){$activeWrite=$true}}catch{}
  }
}
if($activeWrite){Fail 'C’è una emissione RCH in corso. Attendi o verifica l’esito prima di aggiornare il connettore.'}

$src=Get-Content -LiteralPath $Target -Raw
if(-not $src.Contains('function Assert-FiscalDocument')){Fail 'Il connettore RCH non è una versione Optyker riconosciuta.'}
Copy-Item -LiteralPath $Target -Destination $Backup -Force
$src=[regex]::Replace($src,'\$ConnectorVersion\s*=\s*''[^'']+''','$ConnectorVersion = ''2.0-mixed''',1)

$newAssert=@'
function Assert-FiscalDocument($document,[string]$operation='sale') {
  $kind=if($document.operation){[string]$document.operation}else{'sale'}
  if($kind -cne $operation -or $operation -cnotin @('sale','void')){throw 'Tipo di operazione non autorizzato.'}
  if($kind -ceq 'void'){
    if($document.serial -cne '72IV6003831'){throw 'Matricola non autorizzata.'}
    $original=$document.original;$date=[datetime]::MinValue
    if([string]$original.jobId -notmatch '^[0-9a-fA-F-]{36}$' -or [string]$original.number -notmatch '^[0-9]{4}-[0-9]{4}$'){throw 'Riferimento annullo non valido.'}
    if(-not [datetime]::TryParseExact([string]$original.date,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$date) -or $date.Year -lt 2015 -or $date.Year -gt 2099 -or $date.Date -gt [datetime]::Now.Date){throw 'Data originale non valida.'}
    $parts=([string]$original.number).Split('-');$closure=[int]$parts[0];$number=[int]$parts[1]
    if($closure -le 0 -or $number -le 0 -or [string]$document.totalCents -notmatch '^[1-9][0-9]{0,8}$' -or [long]$document.totalCents -gt 100000000){throw 'Numero o importo annullo non valido.'}
    $expected='=k/&'+$date.ToString('ddMMyy',[Globalization.CultureInfo]::InvariantCulture)+'/['+$closure+'/]'+$number
    if(@($document.commands).Count -ne 1 -or $document.commands[0] -cne $expected){throw 'Comando di annullo non autorizzato.'}
    return
  }
  if($document.serial -cne '72IV6003831'){throw 'Matricola non autorizzata.'}
  $commands=@($document.commands);$lines=@($document.lines)
  if($lines.Count -lt 1 -or $lines.Count -gt 100){throw 'Righe fiscali non valide.'}
  $expected=New-Object 'System.Collections.Generic.List[string]';$gross=0L
  foreach($line in $lines){
    if([string]$line.department -notmatch '^[123]$' -or [string]$line.quantity -notmatch '^[1-9][0-9]?$' -or [string]$line.unitPriceCents -notmatch '^[1-9][0-9]{0,8}$' -or [string]$line.description -notmatch "^[A-Z0-9 .,'+\-]{1,20}$"){throw 'Riga fiscale non valida.'}
    $gross+=([long]$line.quantity*[long]$line.unitPriceCents)
    $expected.Add(('=R'+$line.department+'/$'+$line.unitPriceCents+'/*'+$line.quantity+'/('+$line.description+')'))
  }
  $isZero=($document.zeroReceipt -eq $true)
  if($isZero){
    if([long]$document.totalCents -ne 0 -or [long]$document.grossTotalCents -ne $gross -or $gross -le 0 -or $gross -gt 100000000){throw 'Totale scontrino a zero non valido.'}
    if($document.talkingReceipt -eq $true -or $document.tsRequested -eq $true){throw 'Scontrino a zero incompatibile con dati sanitari.'}
    $expected.Add('=S');$expected.Add('=%/*100')
  } else {
    if($gross -ne [long]$document.totalCents -or $gross -le 0 -or $gross -gt 100000000){throw 'Totale fiscale non valido.'}
  }
  if($document.talkingReceipt -eq $true){
    if([string]$document.fiscalCode -notmatch '^[A-Z0-9]{16}$'){throw 'Codice fiscale non valido.'}
    $expected.Add(('="/?C/('+$document.fiscalCode+')'))
  }
  if($document.reviewQr){
    if([string]$document.reviewQr -cne 'https://g.page/r/CeicKuw6aQ5FEAE/review'){throw 'QR documento non autorizzato.'}
    $expected.Add(('="/$11/('+$document.reviewQr+')'))
  } elseif($document.automaticReference -eq $true){
    if([string]$document.receiptMarker -cnotmatch '^OPTYKER [A-F0-9]{32}$'){throw 'Riferimento automatico non valido.'}
    $expected.Add(('="/?A/('+$document.receiptMarker+')'))
  }
  if([string]$document.paymentMethod -ceq 'mixed'){
    $parts=$document.paymentBreakdownCents
    if([string]$parts.cash -notmatch '^[1-9][0-9]{0,8}$' -or [string]$parts.card -notmatch '^[1-9][0-9]{0,8}$' -or ([long]$parts.cash+[long]$parts.card) -ne $gross -or $document.tsRequested -eq $true){throw 'Ripartizione mista non valida.'}
    $expected.Add(('=T1/$'+$parts.cash+'/(CONTANTI)'))
    $expected.Add(('=T4/$'+$parts.card+'/(CARTA)'))
  } else {
    if([string]$document.paymentCode -notmatch '^[134]$'){throw 'Pagamento non autorizzato.'}
    $expected.Add(('=T'+$document.paymentCode))
  }
  if($commands.Count -ne $expected.Count){throw 'Sequenza fiscale non valida.'}
  for($i=0;$i -lt $commands.Count;$i++){if($commands[$i] -cne $expected[$i]){throw 'Comando non autorizzato.'}}
}
'@
$pattern='(?s)function Assert-FiscalDocument\(\$document,\[string\]\$operation=''sale''\) \{.*?\r?\n\}\r?\n# RCH Web Service V5'
if(-not [regex]::IsMatch($src,$pattern)){Fail 'Blocco di sicurezza fiscale non riconosciuto: nessuna modifica applicata.'}
$src=[regex]::Replace($src,$pattern,$newAssert+"`r`n# RCH Web Service V5",1)

$readback='(?s)\r?\n\s*if\(\$claimed\.document\.automaticReference -eq \$true -and \$operation -eq ''sale''\)\{.*?\r?\n\s*\}(?=\r?\n\s*\} catch \{)'
if(([regex]::Matches($src,$readback)).Count -ne 1){Fail 'Blocco lettura automatica non riconosciuto: nessuna modifica applicata.'}
$src=[regex]::Replace($src,$readback,"`r`n      # POS 1.9: nessuna lettura EJ automatica. La RCH resta in REG; il riferimento si conferma dalla stampa.",1)
$capOld='automaticReference=$true;manualReference=$true'
$capSafe='automaticReference=$true;manualReference=$true;regSafeReceipt=$true'
$capNew='automaticReference=$false;manualReference=$true;regSafeReceipt=$true;reviewQr=$true;zeroReceipt=$true'
if($src.Contains($capSafe)){$src=$src.Replace($capSafe,$capNew)}
elseif($src.Contains($capOld)){$src=$src.Replace($capOld,$capNew)}
elseif(-not $src.Contains('zeroReceipt=$true')){Fail 'Capacità del connettore non riconosciute: nessuna modifica applicata.'}
if(-not $src.Contains('mixedReceipt=$true')){
  $src=$src.Replace('zeroReceipt=$true','zeroReceipt=$true;mixedReceipt=$true')
  if(-not $src.Contains('mixedReceipt=$true')){Fail 'Impossibile abilitare il pagamento misto: nessuna modifica applicata.'}
}
if($src -match "Send-RchCommand '=C10'" -or $src -match 'Send-RchCommand "=C10"'){Fail 'Comando di chiusura fiscale non consentito.'}

$tmp=$Target+'.pos19.tmp'
[System.IO.File]::WriteAllText($tmp,$src,(New-Object System.Text.UTF8Encoding($true)))
$tokens=$null;$errors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($tmp,[ref]$tokens,[ref]$errors)
if($errors.Count -gt 0){Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue;Fail ('Il connettore aggiornato non supera il controllo PowerShell: '+$errors[0].Message)}
Move-Item -LiteralPath $tmp -Destination $Target -Force

$procs=Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -and $_.CommandLine -like '*rch-optyker-connector.ps1*' -and $_.ProcessId -ne $PID}
foreach($p in $procs){try{Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop}catch{}}
Start-Sleep -Milliseconds 500
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',$Target) -WindowStyle Hidden
$health=$null
for($i=0;$i -lt 20;$i++){
  Start-Sleep -Milliseconds 350
  try{$health=Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Headers @{Origin='https://optyker.it'} -TimeoutSec 2;if($health.ok -eq $true){break}}catch{}
}
if($null -eq $health -or $health.version -ne '2.0-mixed' -or $health.capabilities.mixedReceipt -ne $true -or $health.capabilities.regSafeReceipt -ne $true){Fail 'File aggiornato, ma il nuovo connettore non risponde ancora. Riavvia il PC oppure riapri Optyker RCH.'}
Write-Host ''
Write-Host 'Optyker RCH aggiornato.' -ForegroundColor Green
Write-Host 'Versione 2.0-mixed: pagamento misto contanti e carta abilitato.' -ForegroundColor Green
Write-Host 'Nessuna chiusura fiscale è stata eseguita e nessun esito incerto è stato cancellato.'
