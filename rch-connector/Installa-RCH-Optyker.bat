@echo off
setlocal
title Installa / aggiorna Optyker RCH
echo.
echo Optyker RCH - installazione / aggiornamento PC cassa
echo.
set "BASE=%LOCALAPPDATA%\OptykerRCH"
set "TMPPS1=%TEMP%\Optyker-RCH-Setup.ps1"

if exist "%BASE%\rch-optyker-connector.ps1" if exist "%BASE%\cloud-relay.json" goto RELAYONLY

echo Prima installazione completa...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/Installa-RCH-Optyker.ps1' -OutFile '%TMPPS1%' -TimeoutSec 60; exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 goto DOWNLOADERR
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%" -NoPause
goto ENDSETUP

:RELAYONLY
echo Installazione esistente rilevata.
echo Aggiorno SOLO il Cloud Relay per il pulsante manuale Porta RCH in REG.
echo Il connettore fiscale non verra modificato.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/Aggiorna-Relay-REG.ps1' -OutFile '%TMPPS1%' -TimeoutSec 60; exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 goto DOWNLOADERR
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%" -NoPause

:ENDSETUP
set "RC=%ERRORLEVEL%"
del /q "%TMPPS1%" >nul 2>&1
echo.
if not "%RC%"=="0" (
  echo Operazione non completata. Leggi il messaggio sopra e comunicamelo.
  pause
  exit /b %RC%
)
echo Operazione completata.
echo Se era un aggiornamento, riapri Optyker e usa Porta RCH in REG.
echo Il passaggio in REG NON e automatico.
pause
exit /b 0

:DOWNLOADERR
echo.
echo Download non riuscito. Nessuna modifica e stata applicata.
pause
exit /b 1
