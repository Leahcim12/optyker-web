@echo off
setlocal
title Optyker RCH - collega iPad
echo.
echo Optyker RCH - installazione SOLO collegamento iPad
echo Il connettore fiscale locale non verra aggiornato.
echo.
set "TMPPS1=%TEMP%\Installa-iPad-Optyker-RCH.ps1"
echo Download collegamento iPad...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/Installa-iPad-Optyker-RCH.ps1?20260914-ipad1' -OutFile '%TMPPS1%' -TimeoutSec 60; exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Download non riuscito. La finestra resta aperta.
  pause
  exit /b 1
)
echo Avvio collegamento iPad...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%" -NoPause
set "RC=%ERRORLEVEL%"
del /q "%TMPPS1%" >nul 2>&1
echo.
if not "%RC%"=="0" (
  echo Collegamento iPad non completato. Leggi il messaggio sopra.
  pause
  exit /b %RC%
)
echo Collegamento iPad completato.
echo Ora puoi chiudere questa finestra e riaprire Optyker sull'iPad.
pause
endlocal
