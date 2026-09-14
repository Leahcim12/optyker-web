param(
  [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$JobId = '5bda806e-7151-4a15-8d9e-4bdfd13e347f'
$Base = if($env:LOCALAPPDATA){Join-Path $env:LOCALAPPDATA 'OptykerRCH'}else{Join-Path ([System.IO.Path]::GetTempPath()) 'OptykerRCH'}
$JournalRoot = Join-Path $Base 'receipts'
$JournalPath = Join-Path $JournalRoot ($JobId + '.json')

Write-Host ''
Write-Host 'Optyker RCH - riconciliazione emissione NON stampata' -ForegroundColor Cyan
Write-Host 'Operazione mirata: non emette, non annulla e non chiude fiscalmente la RCH.' -ForegroundColor DarkGray
Write-Host ''

if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Questo correttore deve essere eseguito sul PC Windows della cassa.'}
if(-not (Test-Path -LiteralPath $JournalRoot -PathType Container)){throw 'Cartella giornale Optyker RCH non trovata.'}

# Verify the register is reachable, idle and in REG before touching the local safety journal.
try {
  $status = Invoke-RestMethod -Uri ("http://127.0.0.1:$Port/status") -Method Get -Headers @{Origin='https://optyker.it'} -TimeoutSec 12
} catch {
  throw ('Impossibile verificare lo stato RCH dal connettore locale: ' + $_.Exception.Message)
}
if($status.ok -ne $true){throw 'La RCH non risulta pronta. Non viene modificato nulla.'}
if([string]$status.mode -notmatch '^REG(?:\s*\(OP\s*\d+\))?$'){throw ('La RCH non e in REG (modalita rilevata: ' + [string]$status.mode + '). Non viene modificato nulla.')}
if([string]$status.idleState -ne '0' -or [int]$status.busy -ne 0){throw 'La RCH non risulta inattiva con documento chiuso. Non viene modificato nulla.'}

if(-not (Test-Path -LiteralPath $JournalPath -PathType Leaf)){
  Write-Host 'Il blocco locale specifico non e presente: risulta gia riconciliato.' -ForegroundColor Green
  Write-Host 'RCH verificata in REG e inattiva.' -ForegroundColor Green
  exit 0
}

$entry = Get-Content -LiteralPath $JournalPath -Raw | ConvertFrom-Json
if([string]$entry.jobId -cne $JobId){throw 'Il file locale non corrisponde alla pratica da riconciliare.'}
if([string]$entry.state -cne 'uncertain'){
  throw ('Stato locale inatteso (' + [string]$entry.state + '). Nessuna modifica applicata.')
}
if([int]$entry.commandsAcknowledged -ne 0){
  throw 'La pratica contiene comandi fiscali confermati: non puo essere sbloccata con questa procedura.'
}

# Preserve the original journal byte-for-byte as an audit file outside the *.json scan used by the connector.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $JournalRoot ($JobId + '.verified-not-printed-' + $stamp + '.audit')
Move-Item -LiteralPath $JournalPath -Destination $archive -Force

Write-Host ''
Write-Host 'RICONCILIAZIONE COMPLETATA' -ForegroundColor Green
Write-Host 'La pratica con esito incerto e stata archiviata come NON STAMPATA.' -ForegroundColor Green
Write-Host 'Il file originale e conservato per audit e non viene eliminato.' -ForegroundColor DarkGray
Write-Host ('Archivio: ' + $archive) -ForegroundColor DarkGray
Write-Host 'La RCH resta in REG. Ora Optyker puo avviare una nuova vendita.' -ForegroundColor Green
