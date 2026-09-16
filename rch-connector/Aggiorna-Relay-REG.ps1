param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [switch]$NoPause
)

$ErrorActionPreference='Stop'
trap {
  $m=if($_.Exception -and $_.Exception.Message){$_.Exception.Message}else{[string]$_}
  Write-Host ''
  Write-Host 'ERRORE AGGIORNAMENTO CLOUD RELAY RCH' -ForegroundColor Red
  Write-Host $m -ForegroundColor Red
  Write-Host ''
  Write-Host 'Il connettore fiscale NON e stato modificato. Nessuna chiusura e nessuno scontrino sono stati eseguiti.' -ForegroundColor Yellow
  if(-not $NoPause){$null=Read-Host 'Premi INVIO per chiudere'}
  exit 1
}

$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$worker=Join-Path $base 'rch-optyker-cloud-worker.ps1'
$config=Join-Path $base 'cloud-relay.json'
$connector=Join-Path $base 'rch-optyker-connector.ps1'
$candidate=Join-Path $base 'rch-optyker-cloud-worker.download.ps1'
$source='https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/rch-optyker-cloud-worker.ps1'

if(-not (Test-Path -LiteralPath $connector -PathType Leaf)){throw 'Connettore fiscale Optyker non trovato. Usa prima l installazione completa.'}
if(-not (Test-Path -LiteralPath $config -PathType Leaf)){throw 'Cloud Relay non ancora associato a questo PC. Usa prima l installazione completa.'}

Write-Host ''
Write-Host 'Optyker RCH - aggiornamento SOLO Cloud Relay' -ForegroundColor Cyan
Write-Host 'Il connettore fiscale e la RCH non verranno modificati.' -ForegroundColor DarkGray
Write-Host 'Download Cloud Relay 2.1-manual-reg...'

Invoke-WebRequest -UseBasicParsing -Uri $source -OutFile $candidate -TimeoutSec 60
$tokens=$null;$errors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($candidate,[ref]$tokens,[ref]$errors)
$text=Get-Content -Raw -LiteralPath $candidate
if($errors.Count -gt 0 -or $text -notmatch "2\.1-manual-reg" -or $text -notmatch 'Restore-RegManual' -or $text -notmatch '<cmd>=C1</cmd>'){
  Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue
  throw 'Cloud Relay scaricato non valido. Nessuna modifica applicata.'
}

Write-Host 'Componente verificato.' -ForegroundColor Green
if(Test-Path -LiteralPath $worker -PathType Leaf){Copy-Item -LiteralPath $worker -Destination ($worker+'.previous') -Force}

# Stop ONLY the cloud worker. Never stop the fiscal connector.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*rch-optyker-cloud-worker.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Move-Item -LiteralPath $candidate -Destination $worker -Force
$ps=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$args='-NoLogo -NoProfile -ExecutionPolicy Bypass -File "'+$worker+'" -PrinterIp "'+$PrinterIp+'" -Port '+$Port
Start-Process -FilePath $ps -ArgumentList $args -WorkingDirectory $base -WindowStyle Hidden
Start-Sleep -Seconds 4

$running=@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*rch-optyker-cloud-worker.ps1*' })
if($running.Count -lt 1){throw 'Il Cloud Relay aggiornato non risulta avviato. La copia precedente e disponibile come .previous.'}

Write-Host ''
Write-Host 'AGGIORNAMENTO COMPLETATO.' -ForegroundColor Green
Write-Host 'Cloud Relay: 2.1-manual-reg' -ForegroundColor Green
Write-Host 'Il connettore fiscale NON e stato toccato.' -ForegroundColor Cyan
Write-Host 'Il ritorno Z -> REG NON e automatico: avviene soltanto premendo Porta RCH in REG dentro Optyker.' -ForegroundColor Cyan
Write-Host 'Nessuna chiusura fiscale e nessuno scontrino sono stati eseguiti.' -ForegroundColor DarkGray
if(-not $NoPause){$null=Read-Host 'Premi INVIO per terminare'}
