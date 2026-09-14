@echo off
setlocal
set "OPTYKER_FINAL_FILE=%~f0"
title Optyker - Completa fondo scontrino 5 euro
echo OPTYKER - CORREZIONE CHIUSURA FINALE FIDELITY V2
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command "$raw=[IO.File]::ReadAllText($env:OPTYKER_FINAL_FILE); & ([scriptblock]::Create(($raw -split '# POWERSHELL_START\r?\n',2)[1]))"
endlocal
goto :eof
# POWERSHELL_START
function Complete-FidelityTail($entry) {
  $status=Parse-Rch (Send-RchCommand '<</?s')
  if(-not $status.ok -or $status.lastCmd -ne 1 -or $status.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$'){throw 'Stato finale RCH non verificato.'}
  if([string]$status.idleState -eq '0'){return}
  if([string]$status.idleState -ne '4'){throw 'Documento non in attesa della sola chiusura finale.'}
  if($entry.fidelityCloseStarted -eq $true){throw 'Chiusura finale gia tentata: verificarne l esito.'}
  $entry | Add-Member -Force NoteProperty fidelityCloseStarted $true
  Save-Journal $entry
  $ack=Parse-Rch (Send-RchCommand '=c')
  if(-not $ack.ok -or $ack.lastCmd -ne 1){throw 'Chiusura finale non confermata: non ripetere.'}
  $entry | Add-Member -Force NoteProperty fidelityCloseAcknowledged $true
  Save-Journal $entry
  Assert-IdleRegister
}
$ErrorActionPreference='Stop'
try {
  $base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
  $target=Join-Path $base 'rch-optyker-connector.ps1'
  $src=[IO.File]::ReadAllText($target).Replace("`r`n","`n")
  $anchor="      Assert-IdleRegister`n      `$entry.idleAfter=`$true;"
  if(-not $src.Contains('function Complete-FidelityTail')){
    if(([regex]::Matches($src,[regex]::Escape($anchor))).Count -ne 1){throw 'Connettore non riconosciuto: nessuna modifica.'}
    $helper='function Complete-FidelityTail {'+${function:Complete-FidelityTail}.ToString()+"}`n"
    $src=$src.Replace('function Emit-Receipt(',$helper+'function Emit-Receipt(').Replace($anchor,"      Complete-FidelityTail `$entry`n"+$anchor)
  }
  $t=$null;$err=$null;[void][Management.Automation.Language.Parser]::ParseInput($src,[ref]$t,[ref]$err)
  if($err.Count){throw ('Verifica aggiornamento fallita: '+$err[0].Message)}
  . $target -PrinterIp '192.168.1.10' -LibraryOnly
  $id='e3478eaf-78e6-40c1-9de1-100a882af1bb'
  $lock=[IO.File]::Open((Join-Path $JournalRoot 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try {
    $entry=Read-Journal $id
    if(-not $entry -or $entry.jobId -cne $id -or $entry.state -cne 'uncertain' -or $entry.commandsAcknowledged -ne 3 -or $entry.writeStarted -ne $true){throw 'La pratica da 5 euro non corrisponde: nessuna stampa.'}
    foreach($file in Get-ChildItem $JournalRoot -Filter '*.json'){
      $other=Get-Content $file.FullName -Raw | ConvertFrom-Json
      if($other.jobId -ne $id -and $other.state -in @('uncertain','sending','claiming')){throw 'Esiste un altra pratica da verificare.'}
    }
    if((Read-RchValue '<</?m' 'm') -cne '72IV6003831'){throw 'Matricola diversa: nessuna stampa.'}
    $status=Parse-Rch (Send-RchCommand '<</?s')
    if(-not $status.ok -or $status.lastCmd -ne 1 -or $status.mode -ne 'REG' -or [string]$status.idleState -notin @('0','4')){throw 'RCH non pronta per la chiusura finale.'}
    $backup=$target+'.pre-fidelity-'+[guid]::NewGuid().ToString('N')
    $temp=$target+'.fidelity.tmp'
    [IO.File]::WriteAllText($temp,$src,(New-Object Text.UTF8Encoding($true)))
    [IO.File]::Replace($temp,$target,$backup)
    Complete-FidelityTail $entry
    Write-Host 'RCH tornata in REG con documento chiuso.' -ForegroundColor Green
    Write-Host 'Nessun articolo o pagamento reinviato. Correzione delle stampe future salvata.'
    Write-Host 'Invia una foto del fondo completo con numero documento e codice fiscale.'
    Write-Host 'Resta da confermare il riferimento in Optyker; non creare altre vendite.'
    Write-Host 'Riavvia il PC prima delle prossime vendite per caricare la correzione.'
  } finally {$lock.Dispose()}
} catch {Write-Host ('VERIFICA NECESSARIA: '+$_.Exception.Message) -ForegroundColor Red}
Read-Host 'Premi INVIO per chiudere'
