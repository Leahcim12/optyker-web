@echo off
setlocal
title Diagnostica RCH Optyker - sola lettura
set "OUT=%USERPROFILE%\Desktop\Diagnostica-RCH-Optyker.json"
echo.
echo OPTYKER - DIAGNOSTICA RCH DI SOLA LETTURA
echo Nessuno scontrino verra emesso e nessuna programmazione verra modificata.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $h=Invoke-RestMethod -UseBasicParsing -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 4; if(-not $h.ok){throw 'Bridge RCH non disponibile'}; if($h.version -notmatch 'readonly-diagnostics'){Write-Host 'Il connettore RCH deve essere aggiornato da Optyker > Cassa > RCH > Installa / aggiorna connettore.' -ForegroundColor Yellow; exit 2}; Write-Host ('Connettore: '+$h.version) -ForegroundColor Green; Write-Host 'Lettura configurazione in corso...' -ForegroundColor Cyan; $r=Invoke-RestMethod -UseBasicParsing -Uri 'http://127.0.0.1:8765/diagnostics' -TimeoutSec 60; $r | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 -Path '%OUT%'; Write-Host ''; Write-Host 'DIAGNOSTICA COMPLETATA' -ForegroundColor Green; Write-Host 'File creato sul Desktop: Diagnostica-RCH-Optyker.json'; Start-Process notepad.exe '%OUT%' } catch { Write-Host ''; Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red; Write-Host 'Se il connettore non e aggiornato, reinstallalo da Optyker.' }; Write-Host ''; Read-Host 'Premi INVIO per chiudere'"
endlocal
