@echo off
setlocal
title Avvio automatico Optyker RCH
echo Configurazione avvio automatico del connettore Optyker RCH...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference='Stop'; $taskFile=Join-Path ([IO.Path]::GetTempPath()) ('Optyker-RCH-startup-'+[guid]::NewGuid().ToString()+'.ps1'); try { Invoke-WebRequest -UseBasicParsing -Uri 'https://www.optyker.it/rch-connector/Attiva-Avvio-Automatico-RCH.ps1?v=20260913-autostart1' -OutFile $taskFile -TimeoutSec 60; & $taskFile -NoPause } catch { Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red; exit 1 } finally { if(Test-Path -LiteralPath $taskFile){Remove-Item -LiteralPath $taskFile -Force} } }"
if errorlevel 1 (
  echo Configurazione non completata. Leggi il messaggio sopra.
  pause
  exit /b 1
)
pause
endlocal
