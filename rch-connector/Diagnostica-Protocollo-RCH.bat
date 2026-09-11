@echo off
setlocal
title Optyker - Diagnostica protocollo RCH
echo OPTYKER - LETTURA FIRMWARE E COMPATIBILITA RCH
echo Esegui questo file dal PC del negozio, con la cassa libera.
echo Nessuno scontrino verra emesso. Il connettore installato non verra modificato.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $taskDir=Join-Path ([IO.Path]::GetTempPath()) ('Optyker-RCH-Protocollo-'+[guid]::NewGuid().ToString('N')); try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $null=New-Item -ItemType Directory -Path $taskDir; $files=@(@{name='rch-optyker-connector.ps1';hash='3dae065a21596c646c2d75d4dd9ce42d2fd5ca0d8e28c66d7e903792aee09125'},@{name='Diagnostica-Protocollo-RCH.ps1';hash='60021a79a86ccdbdaef99df3f4b48f79d8d53bb4b197589b16a65fa612da07fb'}); foreach($file in $files){ $path=Join-Path $taskDir $file.name; Invoke-WebRequest -UseBasicParsing -Uri ('https://www.optyker.it/rch-connector/'+$file.name+'?v=20260911-protocol-v14-1') -OutFile $path -TimeoutSec 30; if((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash -ine $file.hash){throw ('File non verificato: '+$file.name+'. Scarica di nuovo la diagnostica da Optyker.')} }; & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskDir 'Diagnostica-Protocollo-RCH.ps1'); if($LASTEXITCODE -ne 0){throw 'Diagnostica terminata con un errore.'} } catch { Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red; exit 1 } finally { if(Test-Path -LiteralPath $taskDir){Remove-Item -LiteralPath $taskDir -Recurse -Force -ErrorAction SilentlyContinue} }"
echo.
pause
endlocal
