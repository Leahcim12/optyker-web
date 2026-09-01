@echo off
title Optyker RCH Connector
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0rch-optyker-connector.ps1" -PrinterIp 192.168.1.10 -Port 8765
pause
