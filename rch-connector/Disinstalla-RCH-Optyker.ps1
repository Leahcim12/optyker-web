$ErrorActionPreference="SilentlyContinue"
$base = Join-Path $env:LOCALAPPDATA "OptykerRCH"
$startup = [Environment]::GetFolderPath("Startup")
$link = Join-Path $startup "Optyker RCH.lnk"

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like "*rch-optyker-connector.ps1*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Remove-Item -Force $link
Remove-Item -Recurse -Force $base

Write-Host "Avvio automatico Optyker RCH rimosso."
Read-Host "Premi INVIO per chiudere"
