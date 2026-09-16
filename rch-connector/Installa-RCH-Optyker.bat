@echo off
setlocal
title Aggiorna Optyker RCH - REG manuale
echo.
echo Optyker RCH - aggiornamento corretto per pulsante REG manuale
echo Nessuna chiusura fiscale viene eseguita da questo aggiornamento.
echo.
set "TMPPS1=%TEMP%\Installa-RCH-Optyker-manualreg-fix.ps1"
echo Download installazione aggiornata...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $u='https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/Installa-RCH-Optyker.ps1'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile '%TMPPS1%' -TimeoutSec 60; $c=[IO.File]::ReadAllText('%TMPPS1%'); $c=$c.Replace('https://leahcim12.github.io/optyker-web/rch-connector','https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector'); [IO.File]::WriteAllText('%TMPPS1%',$c,(New-Object Text.UTF8Encoding($false))); exit 0 } catch { Write-Host ''; Write-Host 'ERRORE DOWNLOAD' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Download non riuscito. Nessuna modifica e stata applicata.
  pause
  exit /b 1
)
echo Avvio aggiornamento...
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
echo.
echo Il ritorno RCH in REG NON e automatico.
echo Avverra solo premendo "Porta RCH in REG" dentro Optyker.
echo Nessuna chiusura Z viene eseguita da questo aggiornamento.
echo.
pause
endlocal
