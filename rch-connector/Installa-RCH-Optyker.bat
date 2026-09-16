@echo off
setlocal
title Installa Optyker RCH
echo.
echo Optyker RCH - aggiornamento PC cassa + collegamento iPad
echo.
set "TMPPS1=%TEMP%\Installa-RCH-Optyker.ps1"
echo Download installazione Optyker RCH...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://leahcim12.github.io/optyker-web/rch-connector/Installa-RCH-Optyker.ps1?v=20260916-manualreg1' -OutFile '%TMPPS1%' -TimeoutSec 60; exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Download non riuscito. La finestra resta aperta per leggere l'errore.
  pause
  exit /b 1
)
echo Avvio installazione...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%" -NoPause
set "RC=%ERRORLEVEL%"
del /q "%TMPPS1%" >nul 2>&1
echo.
if not "%RC%"=="0" (
  echo Installazione non completata. Leggi il messaggio sopra e comunicamelo.
  pause
  exit /b %RC%
)
echo Installazione completata.
echo Ora il pulsante Porta RCH in REG e disponibile in Optyker.
echo Il ritorno in REG avviene solo quando premi il pulsante: non e automatico.
pause
endlocal