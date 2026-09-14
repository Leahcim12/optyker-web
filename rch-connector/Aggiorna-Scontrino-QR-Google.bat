@echo off
setlocal
chcp 65001 >nul
title Optyker RCH - Scontrino pulito + QR recensioni
echo.
echo Optyker RCH - aggiornamento scontrino
echo Rimuove la scritta tecnica OPTYKER e imposta il QR recensioni Google.
echo Non emette scontrini e non esegue chiusure fiscali.
echo.
set "PSURL=https://leahcim12.github.io/optyker-web/rch-connector/Aggiorna-Scontrino-QR-Google.ps1?v=20260914-reviewqr2"
set "TMPPS=%TEMP%\Aggiorna-Scontrino-QR-Google.ps1"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%PSURL%' -OutFile '%TMPPS%'; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 goto :error
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS%"
if errorlevel 1 goto :error
del /q "%TMPPS%" >nul 2>&1
exit /b 0
:error
echo.
echo ERRORE AGGIORNAMENTO. Nessuno scontrino e stato emesso.
pause
exit /b 1
