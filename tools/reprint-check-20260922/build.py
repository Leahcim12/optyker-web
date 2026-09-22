from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[2]
folder=Path(__file__).resolve().parent
helper=(folder/'Assert-ReprintJournal.ps1').read_text(encoding='utf-8').strip()
template=(folder/'install-template.ps1').read_text(encoding='utf-8')
assert template.count('__ASSERT_FUNCTION__')==1
ps=template.replace('__ASSERT_FUNCTION__',helper)
out=root/'reprint-match-output';out.mkdir(exist_ok=True)
(out/'Install-ReprintMatch.ps1').write_text(ps,encoding='utf-8-sig')
header='''@echo off
setlocal
title Optyker - Aggiornamento ristampa RCH
set "OPTYKER_REPRINT_SELF=%~f0"
powershell.exe -NoLogo -NoProfile -Command "$t=[IO.File]::ReadAllText($env:OPTYKER_REPRINT_SELF);$m='# OPTYKER_REPRINT_SCRIPT';$p=$t.LastIndexOf($m);if($p -lt 0){exit 1};& ([scriptblock]::Create($t.Substring($p+$m.Length)))"
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
# OPTYKER_REPRINT_SCRIPT
'''
p=out/'Optyker-Aggiorna-Ristampa-RCH.bat'
p.write_bytes((header+ps).replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))
(out/'manifest.json').write_text(json.dumps({'version':'20260922-match1','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'installer_prints_receipts':False,'installer_changes_financial_records':False},indent=2))
print('Built',p.name,hashlib.sha256(p.read_bytes()).hexdigest())
