param(
  [string]$PrinterIp = "192.168.1.10",
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$base = Join-Path $env:LOCALAPPDATA "OptykerRCH"
$connector = Join-Path $base "rch-optyker-connector.ps1"
$launcher = Join-Path $base "Avvia-Optyker-RCH-Nascosto.vbs"
$startup = [Environment]::GetFolderPath("Startup")
$startupLink = Join-Path $startup "Optyker RCH.lnk"
$source = "https://www.optyker.it/rch-connector/rch-optyker-connector.ps1?v=20260903-giftreceipt1"

New-Item -ItemType Directory -Force -Path $base | Out-Null

Write-Host "Installazione Optyker RCH..." -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing -Uri $source -OutFile $connector

$vbs = @"
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$connector"" -PrinterIp $PrinterIp -Port $Port"
sh.Run cmd, 0, False
"@
Set-Content -Path $launcher -Value $vbs -Encoding ASCII

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($startupLink)
$sc.TargetPath = "wscript.exe"
$sc.Arguments = '"' + $launcher + '"'
$sc.WorkingDirectory = $base
$sc.WindowStyle = 7
$sc.Description = "Optyker RCH Connector"
$sc.Save()

# Kill only a previous Optyker RCH connector instance and restart hidden.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*rch-optyker-connector.ps1*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $launcher + '"') -WindowStyle Hidden

Start-Sleep -Seconds 2
try {
  $r = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 4
  if($r.ok){
    Write-Host ""
    Write-Host "Installazione completata." -ForegroundColor Green
    Write-Host "Il connettore parte automaticamente con Windows e resta nascosto."
    Write-Host "Registratore: $PrinterIp"
    Write-Host "Bridge: 127.0.0.1:$Port"
  } else {
    throw "Health check non valido"
  }
} catch {
  Write-Host ""
  Write-Host "Installazione completata, ma il test locale non ha risposto subito." -ForegroundColor Yellow
  Write-Host "Riapri Optyker e premi Test collegamento RCH."
}

Write-Host ""
Write-Host "Puoi chiudere questa finestra."
Read-Host "Premi INVIO per terminare"
