@echo off
setlocal
title Aggiorna Optyker RCH - pagamento misto
set "PS1=%TEMP%\Aggiorna-RCH-POS.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://leahcim12.github.io/optyker-web/rch-connector/Aggiorna-RCH-POS.ps1?v=20260926-mixed2' -OutFile '%PS1%'"
if errorlevel 1 (
  echo Download non riuscito.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
set "EC=%ERRORLEVEL%"
del /q "%PS1%" >nul 2>nul
echo.
pause
exit /b %EC%
