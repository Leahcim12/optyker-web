@echo off
setlocal
title Optyker RCH - Riconcilia nessuna stampa
color 0F
echo.
echo Optyker RCH - riconciliazione emissione NON stampata
echo.
set "PS1=%TEMP%\Riconcilia-RCH-Nessuna-Stampa.ps1"
set "URL=https://leahcim12.github.io/optyker-web/rch-connector/Riconcilia-RCH-Nessuna-Stampa.ps1?v=20260914-noprint1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%PS1%'"
if errorlevel 1 goto :fail
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
if errorlevel 1 goto :fail
echo.
echo Operazione completata.
echo Premi un tasto per chiudere...
pause >nul
exit /b 0

:fail
echo.
color 0C
echo ERRORE RICONCILIAZIONE OPTYKER RCH
echo Nessuna nuova emissione fiscale e stata eseguita da questo correttore.
echo Leggi il messaggio sopra e comunicalo.
echo.
pause
exit /b 1
