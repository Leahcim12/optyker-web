@echo off
setlocal
title Diagnostica RCH Optyker - sola lettura
echo OPTYKER - DIAGNOSTICA RCH DI SOLA LETTURA
echo Nessuno scontrino verra emesso e nessuna programmazione verra modificata.
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; try { $h=Invoke-RestMethod -UseBasicParsing -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 4; if($h.version -ne '1.5-status-compatibility'){throw 'Aggiorna il connettore da Optyker > Cassa > RCH > Installa / aggiorna connettore.'}; $r=Invoke-RestMethod -UseBasicParsing -Uri 'http://127.0.0.1:8765/diagnostics' -TimeoutSec 30; if(-not $r.reportGenerated){throw 'Diagnosi non disponibile.'}; $out=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Diagnostica-RCH-Optyker.json'; $r | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 -LiteralPath $out; Write-Host ('File salvato: '+$out) -ForegroundColor Green; if($r.printerReached -and -not $r.statusAccepted){Write-Host 'RCH raggiungibile, ma la richiesta di stato non e stata accettata.' -ForegroundColor Yellow} elseif(-not $r.printerReached){Write-Host 'Nessuna risposta RCH valida. Il file contiene i dettagli del problema.' -ForegroundColor Yellow}; Write-Host 'Allega il file JSON nella chat Optyker.' } catch { Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red }; Read-Host 'Premi INVIO per chiudere'"
endlocal
