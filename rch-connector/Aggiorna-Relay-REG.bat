@echo off
setlocal
title Aggiorna Optyker RCH - REG manuale
echo.
echo Optyker RCH - aggiornamento SOLO Cloud Relay
echo Il connettore fiscale non verra modificato.
echo Nessuna chiusura fiscale e nessuno scontrino vengono eseguiti.
echo.
set "TMPPS1=%TEMP%\Aggiorna-Relay-REG.ps1"
echo Download aggiornamento...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/Aggiorna-Relay-REG.ps1' -OutFile '%TMPPS1%' -TimeoutSec 60; exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Download non riuscito. Nessuna modifica e stata applicata.
  pause
  exit /b 1
)
echo Avvio aggiornamento Cloud Relay...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%" -NoPause
set "RC=%ERRORLEVEL%"
del /q "%TMPPS1%" >nul 2>&1
echo.
if not "%RC%"=="0" (
  echo Aggiornamento non completato. Leggi il messaggio sopra.
  pause
  exit /b %RC%
)
echo AGGIORNAMENTO COMPLETATO.
echo Ora riapri Optyker e usa Porta RCH in REG.
echo Il passaggio in REG NON e automatico.
pause
endlocal
