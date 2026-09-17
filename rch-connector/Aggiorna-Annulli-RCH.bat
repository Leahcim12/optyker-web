@echo off
setlocal
title Optyker - Aggiorna funzione annullo RCH
echo.
echo OPTYKER - AGGIORNAMENTO FUNZIONE ANNULLO RCH
echo Questo file aggiorna il connettore; NON annulla nessuno scontrino.
echo Non esegue chiusure fiscali e non invia cancellazioni al TS.
echo.
echo Chiudi le schede Optyker prima di continuare.
echo Non usare la cassa durante l'aggiornamento.
pause

set "SETUP=%TEMP%\Optyker-Annulli-%RANDOM%-%RANDOM%.ps1"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/Installa-RCH-Optyker.ps1' -OutFile $env:SETUP -TimeoutSec 60; $tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:SETUP,[ref]$tokens,[ref]$errors); if($errors.Count -gt 0){throw 'Installatore non valido.'}; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 goto DOWNLOAD_ERROR

rem Deliberately call the complete existing installer, not the relay-only BAT.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SETUP%" -NoPause
set "RC=%ERRORLEVEL%"
del /q "%SETUP%" >nul 2>&1
if not "%RC%"=="0" goto SETUP_ERROR

rem Health is read-only: verify the real local capability, not the version label.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -Headers @{Origin='https://optyker.it'} -TimeoutSec 5; if($h.ok -ne $true -or $h.capabilities.automaticVoidReference -ne $true){throw 'Funzione annulli NON ancora attiva. Il programma potrebbe aver protetto una precedente operazione incerta: non cancellare i registri locali.'}; Write-Host ('Connettore locale: '+$h.version); Write-Host 'automaticVoidReference: true' -ForegroundColor Green; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 goto CAPABILITY_ERROR

echo.
echo AGGIORNAMENTO VERIFICATO: funzione annulli disponibile.
echo Nessuno scontrino e stato annullato da questo programma.
echo Non e stata eseguita alcuna chiusura fiscale.
echo Comunica questo esito prima di confermare nuovamente l'annullo.
pause
exit /b 0

:DOWNLOAD_ERROR
del /q "%SETUP%" >nul 2>&1
echo.
echo Download o controllo installatore fallito. Nessuna installazione avviata.
pause
exit /b 1

:SETUP_ERROR
echo.
echo Installazione NON completata. Conserva il messaggio di errore qui sopra.
echo Non ripetere l'annullo e non eliminare i registri della cassa.
pause
exit /b 1

:CAPABILITY_ERROR
echo.
echo Aggiornamento annulli NON confermato. Non ripetere l'annullo.
echo Invia una foto di questa finestra per verificare il motivo.
pause
exit /b 1
