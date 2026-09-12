@echo off
setlocal
title Optyker - Lettura configurazione RCH
echo OPTYKER - LETTURA CONFIGURAZIONE RCH
echo Esegui dal PC del negozio, con la cassa libera e senza usare Focus o Optyker.
echo Sulla tastiera RCH premi 4 poi CHIAVE: il display deve indicare PRG.
echo Al termine torna a REG premendo 1 poi CHIAVE.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $taskDir=Join-Path ([IO.Path]::GetTempPath()) ('Optyker-RCH-Configurazione-'+[guid]::NewGuid().ToString('N')); try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $null=New-Item -ItemType Directory -Path $taskDir; $files=@(@{name='rch-optyker-connector.ps1';hash='3dae065a21596c646c2d75d4dd9ce42d2fd5ca0d8e28c66d7e903792aee09125'},@{name='Diagnostica-Protocollo-RCH.ps1';hash='60021a79a86ccdbdaef99df3f4b48f79d8d53bb4b197589b16a65fa612da07fb'},@{name='Diagnostica-Configurazione-RCH.ps1';hash='5d71b627f0b96aa802bce30bcc05efebcba83891371fe52ad567f4f40725bafc'}); foreach($file in $files){ $path=Join-Path $taskDir $file.name; Invoke-WebRequest -UseBasicParsing -Uri ('https://www.optyker.it/rch-connector/'+$file.name+'?v=20260912-config-readback-1') -OutFile $path -TimeoutSec 30; if((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash -ine $file.hash){throw ('File non verificato: '+$file.name+'. Scarica di nuovo la diagnostica da Optyker.')} }; & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskDir 'Diagnostica-Configurazione-RCH.ps1'); if($LASTEXITCODE -ne 0){throw 'Diagnostica terminata con un errore.'} } catch { Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red; exit 1 } finally { Write-Host 'Sulla tastiera RCH premi 1 poi CHIAVE per tornare a REG.' -ForegroundColor Cyan; if(Test-Path -LiteralPath $taskDir){Remove-Item -LiteralPath $taskDir -Recurse -Force -ErrorAction SilentlyContinue} }"
echo.
pause
endlocal
