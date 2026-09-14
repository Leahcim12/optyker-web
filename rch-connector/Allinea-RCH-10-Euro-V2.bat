@echo off
setlocal
set "OPTYKER_RECOVERY_FILE=%~f0"
title Optyker - Allineamento V2 - 1163-0006
echo VERSIONE V2 - 14 SETTEMBRE 2026 - CONTROLLO POLICY
echo Verifica della RCH e allineamento della sola pratica da 10 euro.
echo Nessuna vendita o annullo verra inviato alla stampante.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command "$raw=[IO.File]::ReadAllText($env:OPTYKER_RECOVERY_FILE); & ([scriptblock]::Create(($raw -split '# POWERSHELL_START\r?\n',2)[1]))"
endlocal
goto :eof
# POWERSHELL_START
param([switch]$LibraryOnly)
$ErrorActionPreference='Stop'
function Resolve-VerifiedCancelledReceipt {
  $id='e2b68d60-aca7-4d07-ac7f-0878f87ecd11'
  $lock=[IO.File]::Open((Join-Path $JournalRoot 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try {
    Assert-IdleRegister
    if((Read-RchValue '<</?m' 'm') -cne '72IV6003831'){throw 'Matricola diversa: nessuna modifica.'}
    $entry=Read-Journal $id
    if(-not $entry){throw 'Pratica locale non trovata: occorre verificarla, nessuna modifica.'}
    if($entry.jobId -cne $id){throw 'Identificativo locale non corrispondente.'}
    if($entry.state -eq 'cancelled' -and $entry.manualCancellation.documentNumber -eq '1163-0006'){
      Assert-NoUncertainReceipt
      return
    }
    if($entry.state -cne 'uncertain' -or $entry.writeStarted -ne $true -or $entry.commandsAcknowledged -ne 2){throw 'Esito locale diverso dalla pratica verificata: nessuna modifica.'}
    # Evidence: user supplied complete paper, 14-09-2026 20:51,
    # DOCUMENTO ANNULLATO -10.00, total/paid 0.00, matching RT.
    # Cloud record was reconciled separately from the original immutable sale snapshot.
    $proof=[ordered]@{kind='cancelled_while_open';documentNumber='1163-0006';documentDate='2026-09-14';serial='72IV6003831';originalAmountCents=1000;cancelledAmountCents=1000;finalAmountCents=0;source='user_provided_receipt_photo';evidenceFileId='file_00000000a2f48246923dbe41cae868a2';verifiedAt=(Get-Date).ToString('o')}
    $path=Journal-Path $id
    $backup=$path+'.cancelled-verified-'+[guid]::NewGuid().ToString('N')+'.audit'
    [IO.File]::Copy($path,$backup,$false)
    $entry | Add-Member -Force NoteProperty manualCancellation $proof
    $entry | Add-Member -Force NoteProperty reconciliationPreviousState ([ordered]@{state=$entry.state;error=$entry.error;idleAfter=$entry.idleAfter;cloudSaved=$entry.cloudSaved})
    $entry.state='cancelled'
    $entry.cloudSaved=$true
    $entry.idleAfter=$true
    # Preserve writeStarted, ACK count and original error; no emission replay.
    Save-Journal $entry
    $saved=Read-Journal $id
    if($saved.state -cne 'cancelled' -or $saved.manualCancellation.documentNumber -cne '1163-0006'){throw 'Verifica del salvataggio fallita.'}
    Assert-NoUncertainReceipt
  } finally {$lock.Dispose()}
}
if($LibraryOnly){return}
try {
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Eseguire sul PC Windows della cassa.'}
  $base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
  $connector=Join-Path $base 'rch-optyker-connector.ps1'
  $health=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 5
  if($health.connector -cne 'Optyker RCH' -or $health.printer -cne '192.168.1.10'){throw 'Connettore locale non corrispondente.'}
  if(-not (Test-Path -LiteralPath $connector)){throw 'Connettore installato non trovato.'}
  Write-Host 'VERSIONE V2 - policy PowerShell effettiva:'
  Get-ExecutionPolicy -List | Format-Table -AutoSize | Out-Host
  $effectivePolicy=[string](Get-ExecutionPolicy)
  if($effectivePolicy -notin @('RemoteSigned','Unrestricted','Bypass')){throw ('Windows impone la policy '+$effectivePolicy+'. Allineamento non eseguito; inviare questa schermata.')}
  . $connector -PrinterIp '192.168.1.10' -LibraryOnly
  Resolve-VerifiedCancelledReceipt
  Write-Host 'Pratica da 10 euro allineata al documento annullato 1163-0006.' -ForegroundColor Green
  Write-Host 'Nessuno scontrino emesso. Nessun annullo inviato alla RCH.'
  Write-Host 'In Optyker riapri la vendita da 5 euro gia registrata, poi Emissione / esito RCH.'
  Write-Host 'Non registrare nuovamente il pagamento.'
} catch {Write-Host ('VERIFICA NECESSARIA: '+$_.Exception.Message) -ForegroundColor Red}
Read-Host 'Premi INVIO per chiudere'
