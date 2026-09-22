$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'reprint-match-output/Install-ReprintMatch.ps1') -LibraryOnly
function Assert($v,[string]$m){if(-not $v){throw $m}}
$source=[IO.File]::ReadAllText((Join-Path $root 'rch-connector/rch-optyker-connector.ps1'))
$patched=Get-ReprintPatch $source
Assert ((Get-ReprintPatch $patched) -ceq $patched) 'Patch must be idempotent'
$bat=[IO.File]::ReadAllText((Join-Path $root 'reprint-match-output/Optyker-Aggiorna-Ristampa-RCH.bat'))
$mark='# OPTYKER_REPRINT_SCRIPT';$extracted=$bat.Substring($bat.LastIndexOf($mark)+$mark.Length).Trim()
$tok=$null;$err=$null;[void][Management.Automation.Language.Parser]::ParseInput($extracted,[ref]$tok,[ref]$err);Assert ($err.Count -eq 0) 'User BAT payload does not parse'
$temp=Join-Path ([IO.Path]::GetTempPath()) ('reprint-check-'+[guid]::NewGuid());[void](New-Item -ItemType Directory -Path $temp)
$scriptfile=Join-Path $temp 'connector.ps1';[IO.File]::WriteAllText($scriptfile,$patched)
. $scriptfile -LibraryOnly
$JournalRoot=Join-Path $temp 'receipts';[void](New-Item -ItemType Directory -Path $JournalRoot)
$script:job=[pscustomobject]@{id='12345678-1234-4234-8234-123456789abc';state='completed';operation='sale';total=100;serial='72IV6003831';document_number='1168-0009';document_date='2026-09-19'}
function Get-ReprintJob($r){return $script:job}
$ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
function Send-RchCommand([string]$cmd){
 $script:commands.Add($cmd)
 if($cmd -ceq '=C3'){$script:mode='Z'}
 if($cmd -ceq '=C1'){$script:mode='REG'}
 if($cmd -ceq '<</?m'){return '<Service>'+$ack+'<Enq><name>m</name><value>72IV6003831</value></Enq></Service>'}
 if($cmd -like '=C452/$0*'){if($script:readFail){throw 'Synthetic read failure'};return '<Service>'+$ack+'<EJ>'+[Security.SecurityElement]::Escape($script:text)+'</EJ></Service>'}
 if($cmd -like '=C452/$1*' -and $script:printFail){throw 'Synthetic print timeout'}
 return '<Service>'+$ack+'<ECRStatus><mode>'+$script:mode+'</mode><idleState>0</idleState></ECRStatus></Service>'
}
$good="DOCUMENTO COMMERCIALE`nTOTALE COMPLESSIVO 100,00`n19-09-2026 22:32`nDOCUMENTO N. 1168-0009`n*** 72IV6003831 ***"
$cases=@('normal','CRLF','CR-only','spaces','number-label','report-dates','wrong-number','wrong-date','wrong-total','wrong-serial','duplicate-number','ambiguous-date','missing-total','return','read-failure','print-failure','uncertain')
try{
 foreach($case in $cases){
  $script:commands=New-Object 'Collections.Generic.List[string]';$script:mode='REG';$script:text=$good;$script:readFail=$case -eq 'read-failure';$script:printFail=$case -eq 'print-failure'
  switch($case){
   'CRLF' {$script:text=$good.Replace("`n","`r`n")}
   'CR-only' {$script:text=$good.Replace("`n","`r")}
   'spaces' {$script:text=$good.Replace(' ',[char]0x00a0)}
   'number-label' {$script:text=$good.Replace('DOCUMENTO N.','DOCUMENTO NUMERO:')}
   'report-dates' {$script:text="22-09-2026 10:03`nGIORNALE ELETTRONICO`nLETTURA`nCOPIA`nDETTAGLIO`n"+$good}
   'wrong-number' {$script:text=$good.Replace('1168-0009','1168-0008')}
   'wrong-date' {$script:text=$good.Replace('19-09','18-09')}
   'wrong-total' {$script:text=$good.Replace('100,00','99,00')}
   'wrong-serial' {$script:text=$good.Replace('3831','3832')}
   'duplicate-number' {$script:text=$good+"`nDOCUMENTO N. 1168-0009"}
   'ambiguous-date' {$script:text=$good+"`n22-09-2026 10:03"}
   'missing-total' {$script:text=$good.Replace('TOTALE COMPLESSIVO','IMPORTO')}
   'return' {$script:text=$good.Replace('DOCUMENTO COMMERCIALE','DOCUMENTO COMMERCIALE DI RESO')}
   'uncertain' {[IO.File]::WriteAllText((Join-Path $JournalRoot 'other.json'),'{"state":"uncertain"}')}
  }
  $allowed=$case -in @('normal','CRLF','CR-only','spaces','number-label','report-dates');$failed=$false;$errMsg=''
  try{$r=Reprint-Receipt @{jobId=$job.id}}catch{$failed=$true;$errMsg=$_.Exception.Message}
  Assert ($failed -ne $allowed) ('Unexpected '+$case+': '+$errMsg)
  $prints=@($commands|Where-Object {$_ -like '=C452/$1*'})
  Assert ($prints.Count -eq $(if($allowed -or $case -eq 'print-failure'){1}else{0})) ('Unsafe print count '+$case)
  if($prints.Count){Assert ($prints[0] -ceq '=C452/$1/&190926/[9/]9') 'Wrong print range'}
  Assert ($script:mode -ceq 'REG') ('REG not restored '+$case)
  Assert (-not @($commands|Where-Object {$_ -match '^=(R|T|k)' -or $_ -ceq '=C10'}).Count) 'Fiscal write/closure requested'
  if($case -eq 'wrong-number'){Assert ($errMsg.Contains('1168-0009') -and $errMsg.Contains('1168-0008')) 'Expected/received evidence missing'}
  Remove-Item (Join-Path $JournalRoot 'other.json') -ErrorAction SilentlyContinue
  Write-Host ('PASS reprint '+$case)
 }
 $legacyDates=[regex]::Matches(("22-09-2026 10:03`nGIORNALE`n"+$good),'(?m)^\s*(\d{2}[-/]\d{2}[-/]\d{4})\s+\d{2}:\d{2}(?::\d{2})?\s*$')
 Assert ($legacyDates.Count -eq 2) 'Legacy two-date rejection not reproduced'
 Write-Host 'PASS legacy extra-date and carriage-return regression coverage'
}finally{Remove-Item $temp -Recurse -Force}
Write-Host 'ALL SELECTED-REPRINT TESTS PASSED; NO REAL PRINTER, PAYMENTS OR CLOUD DATA USED'
