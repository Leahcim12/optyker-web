param([switch]$LibraryOnly)
$ErrorActionPreference = 'Stop'
$TargetJobId = 'c6609e8d-397f-4a78-a2e9-8860821473b7'
$ArchiveId = 'focus-55-20260922'

# One specifically authorized operational cancellation, not a fiscal void.
# The corresponding cloud job has already been cancelled. Never reissue it.
# No network, printer, database, service, configuration or payment operation.
function Get-BytesHash([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant() }
  finally { $sha.Dispose() }
}
function Save-ExactBackup([string]$path,[byte[]]$bytes) {
  if ([IO.File]::Exists($path)) {
    if ((Get-BytesHash ([IO.File]::ReadAllBytes($path))) -cne (Get-BytesHash $bytes)) {
      throw 'La copia di sicurezza esistente e diversa: nessuna modifica eseguita.'
    }
    return
  }
  $f = [IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $f.Write($bytes,0,$bytes.Length); $f.Flush($true) } finally { $f.Dispose() }
  if ((Get-BytesHash ([IO.File]::ReadAllBytes($path))) -cne (Get-BytesHash $bytes)) {
    throw 'Copia di sicurezza non verificata: nessuna modifica eseguita.'
  }
}
function Clear-ExactFailedAttempt([string]$base) {
  if (-not [IO.Directory]::Exists($base)) { throw 'Apri questo file sul PC della cassa con il consueto utente Windows.' }
  $journal = Join-Path $base 'receipts'
  if (-not [IO.Directory]::Exists($journal)) { throw 'Registro Optyker non trovato per questo utente Windows.' }
  foreach ($dir in @($base,$journal)) {
    if (([IO.File]::GetAttributes($dir) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Percorso del registro non standard: nessuna modifica eseguita.' }
  }
  $path = Join-Path $journal ($TargetJobId+'.json')
  $lock = $null
  $tmp = $null
  try {
    # Shares the exact exclusive lock used by the installed connector and relay.
    # Do not interrupt an emission, stop a process, or remove a lock.
    try { $lock = [IO.File]::Open((Join-Path $journal 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
    catch { throw 'Il connettore sta lavorando. Attendi che termini e riapri questo file.' }
    if (-not [IO.File]::Exists($path)) {
      return [pscustomobject]@{state='not_present';changed=$false;replayAllowed=$false;message='Il vecchio tentativo da 55 euro non e presente nel registro di questo utente.'}
    }
    if (([IO.File]::GetAttributes($path) -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (Get-Item -LiteralPath $path).Length -gt 1048576) {
      throw 'File del tentativo non valido: nessuna modifica eseguita.'
    }
    $bytes = [IO.File]::ReadAllBytes($path)
    $text = [Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF)
    $entry = $text | ConvertFrom-Json
    if ([string]$entry.jobId -cne $TargetJobId -or [string]$entry.operation -cne 'sale') { throw 'Identificativo del tentativo diverso: nessuna modifica eseguita.' }
    if ([string]$entry.state -ceq 'cancelled' -and [string]$entry.operationalArchive.archiveId -ceq $ArchiveId) {
      if ($entry.cloudSaved -ne $true) { throw 'Archiviazione locale incompleta: non ripetere incassi.' }
      return [pscustomobject]@{state='cancelled';changed=$false;replayAllowed=$false;message='Blocco da 55 euro gia rimosso.'}
    }
    if ([string]$entry.state -cne 'uncertain' -or ($null -ne $entry.reference -and [string]$entry.reference -ne '')) {
      throw 'Lo stato del documento e cambiato: il file non modifica questa operazione.'
    }
    $backupDir = Join-Path $journal 'archived-focus-55-20260922'
    if ([IO.Directory]::Exists($backupDir) -and (([IO.File]::GetAttributes($backupDir) -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
      throw 'Percorso copia non valido.'
    }
    [void][IO.Directory]::CreateDirectory($backupDir)
    $backup = Join-Path $backupDir ($TargetJobId+'.original.json')
    Save-ExactBackup $backup $bytes
    # Retain tokens, timestamps, original error and ACK evidence in the original backup.
    # The existing .previous and .attempt.* files are not deleted or overwritten.
    $beforeState = [string]$entry.state
    $entry | Add-Member -Force NoteProperty operationalArchive ([pscustomobject]@{
      archiveId=$ArchiveId
      scope='cancel_optyker_transmission_only'
      source='user_reported_external_issue'
      externalSystem='Focus'
      externalReceiptVerified=$false
      externalReceiptNumber=$null
      externalReceiptDate=$null
      reportedAt='2026-09-22T06:42:43Z'
      cloudCancelledAt='2026-09-22T06:53:28.699428Z'
      archivedAt=[DateTime]::UtcNow.ToString('o')
      previousState=$beforeState
      originalSha256=(Get-BytesHash $bytes)
      replayAllowed=$false
      fiscalVoidExecuted=$false
      changedPayments=$false
    })
    $entry.state = 'cancelled'
    $entry.cloudSaved = $true
    $newBytes = [Text.Encoding]::UTF8.GetBytes(($entry | ConvertTo-Json -Depth 30 -Compress))
    $tmp = $path+'.archive-'+[guid]::NewGuid().ToString('N')+'.tmp'
    $file = [IO.File]::Open($tmp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $file.Write($newBytes,0,$newBytes.Length); $file.Flush($true) } finally { $file.Dispose() }
    $check = [IO.File]::ReadAllText($tmp) | ConvertFrom-Json
    if ([string]$check.jobId -cne $TargetJobId -or [string]$check.state -cne 'cancelled' -or $check.cloudSaved -ne $true) {
      throw 'Nuovo stato non verificato: originale conservato.'
    }
    # Compare again immediately before the atomic replacement. All legacy states stay intact on failure.
    if ((Get-BytesHash ([IO.File]::ReadAllBytes($path))) -cne (Get-BytesHash $bytes)) { throw 'Registro cambiato durante il controllo: nessuna sostituzione eseguita.' }
    [IO.File]::Replace($tmp,$path,$null)
    $tmp = $null
    $done = [IO.File]::ReadAllText($path) | ConvertFrom-Json
    if ([string]$done.state -cne 'cancelled' -or [string]$done.operationalArchive.archiveId -cne $ArchiveId) { throw 'Verifica finale locale non riuscita.' }
    return [pscustomobject]@{state='cancelled';changed=$true;replayAllowed=$false;message='Blocco da 55 euro rimosso. Pagamento conservato. Nessuna stampa inviata.'}
  } finally {
    if ($tmp -and [IO.File]::Exists($tmp)) { [IO.File]::Delete($tmp) }
    if ($null -ne $lock) { $lock.Dispose() }
  }
}
if ($LibraryOnly) { return }
try {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not $env:LOCALAPPDATA) { throw 'Esegui sul PC Windows della cassa, con il solito utente.' }
  Write-Host 'OPTYKER - RIMOZIONE BLOCCO 55 EURO GIA GESTITO DA FOCUS' -ForegroundColor Cyan
  Write-Host 'Non stampa, non cambia modalita RCH e non modifica gli incassi.'
  $result = Clear-ExactFailedAttempt (Join-Path $env:LOCALAPPDATA 'OptykerRCH')
  if ($result.state -eq 'not_present') { Write-Host $result.message -ForegroundColor Yellow }
  else { Write-Host $result.message -ForegroundColor Green }
  Write-Host 'Chiudi la finestra. In Optyker premi Aggiorna esito, oppure ricarica dopo aver salvato eventuali modifiche.'
  Write-Host 'Non reinviare la vendita da 55 euro: lo scontrino e gia stato emesso da Focus, come hai indicato.'
  exit 0
} catch {
  Write-Host ('OPERAZIONE NON COMPLETATA: '+$_.Exception.Message) -ForegroundColor Red
  Write-Host 'Non sono stati inviati comandi alla stampante.'
  exit 1
}
