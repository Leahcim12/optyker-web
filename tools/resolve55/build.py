from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
ps=(root/'Archive-55-Focus.ps1').read_text(encoding='utf-8-sig')
header='''@echo off
setlocal
set "OPTYKER_ARCHIVE55_SELF=%~f0"
powershell.exe -NoLogo -NoProfile -Command "$text=[IO.File]::ReadAllText($env:OPTYKER_ARCHIVE55_SELF);$marker='# OPTYKER_ARCHIVE55_BEGIN';$pos=$text.LastIndexOf($marker);if($pos -lt 0){exit 1};& ([scriptblock]::Create($text.Substring($pos+$marker.Length)))"
set "OPTYKER_ARCHIVE55_RESULT=%ERRORLEVEL%"
echo.
echo Premi un tasto per chiudere.
pause >nul
exit /b %OPTYKER_ARCHIVE55_RESULT%
# OPTYKER_ARCHIVE55_BEGIN
'''
out=root/'Optyker-Rimuovi-Blocco-55.bat'
out.write_bytes((header+ps).replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))
(root/'manifest.json').write_text(json.dumps({'archive_id':'focus-55-20260922','sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'printer_commands':0,'network_requests':0,'payment_changes':0})+'\n')
print((root/'manifest.json').read_text())
