@echo off
setlocal
title Correggi Optyker RCH - REG stabile
echo.
echo Optyker RCH - correzione modalita REG stabile
echo Non viene eseguita alcuna chiusura fiscale.
echo.
set "TMPPS1=%TEMP%\Correggi-RCH-REG.ps1"
echo Download correzione...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://leahcim12.github.io/optyker-web/rch-connector/Correggi-RCH-REG.ps1?v=20260914-regsafe3' -OutFile '%TMPPS1%' -TimeoutSec 60; exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Download non riuscito. La finestra resta aperta.
  pause
  exit /b 1
)
echo Avvio correzione...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%" -NoPause
set "RC=%ERRORLEVEL%"
del /q "%TMPPS1%" >nul 2>&1
echo.
if not "%RC%"=="0" (
  echo Correzione non completata. Leggi il messaggio sopra.
  pause
  exit /b %RC%
)
echo Correzione completata.
echo La RCH non verra piu portata automaticamente in Z per leggere lo scontrino.
pause
endlocal
