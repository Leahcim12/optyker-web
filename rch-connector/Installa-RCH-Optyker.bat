@echo off
setlocal
title Installa Optyker RCH
set "TMPPS1=%TEMP%\Installa-RCH-Optyker.ps1"
echo Download installazione Optyker RCH...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://www.optyker.it/rch-connector/Installa-RCH-Optyker.ps1?v=20260903-giftreceipt1' -OutFile '%TMPPS1%'; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Download non riuscito.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%"
del /q "%TMPPS1%" >nul 2>&1
endlocal
