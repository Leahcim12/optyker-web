$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$source=Join-Path $root 'rch-pending-v2-check/Verifica-Giornale-V2.ps1'
$tok=$null;$err=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tok,[ref]$err)
if($err.Count){throw ($err|Out-String)}
. $source -LibraryOnly
function Assert($condition,[string]$message){if(-not $condition){throw $message}}
foreach($command in @('=C10','=T1','=C451/$1/&210926/[210926','=C451/$0/&010126/[210926','=C452/$1/&210926/[1/]9999','=C453/$1','=C86')){
 $rejected=$false;try{Invoke-RchReadCommand $command}catch{$rejected=$true};Assert $rejected ('Unsafe command permitted: '+$command)
}
$fixture=Join-Path $env:TEMP ('optyker-day-read-test-'+[guid]::NewGuid().ToString('N'))
$journal=Join-Path $fixture 'receipts';[void](New-Item -ItemType Directory -Path $journal)
[IO.File]::WriteAllText((Join-Path $journal 'printer.lock'),'')
$id=$TargetJobIds[0];$entry=Join-Path $journal ($id+'.json')
$original=@{jobId=$id;state='uncertain';operation='sale';writeStarted=$true;commandsAcknowledged=0;idleAfter=$false;cloudSaved=$true;createdAt='2026-09-21T09:49:44+02:00';protectedResultToken='NEVER_EXPORT_ME';password='PASSWORD_SECRET';error='PRIVATE_ERROR_WITH_SECRET';fiscalCode='RSSMRA80A01H501U'}|ConvertTo-Json
[IO.File]::WriteAllText($entry,$original);[IO.File]::WriteAllText(($entry+'.previous'),$original)
function Read-BridgeHealth{return @{ok=$true;connector='Optyker RCH';version='fixture';printer='192.168.1.10'}}
function XmlReply([string]$extra,[int]$busy=0){return '<Service><Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><busy>'+[string]$busy+'</busy><lastCmd>1</lastCmd></Request>'+$extra+'</Service>'}
function Invoke-RchReadCommand([string]$command){
 $script:ReadCommands.Add($command)
 switch -CaseSensitive ($command){
  '<</?s' {$busy=if($script:scenario -eq 'busy'){1}else{0};$mode=if($script:scenario -eq 'unknownMode'){''}else{'REG'};return XmlReply ('<ECRStatus><mode>'+$mode+'</mode><idleState>0</idleState><fiscalDocCounter>9</fiscalDocCounter></ECRStatus>') $busy}
  '<</?m' {$serial=if($script:scenario -eq 'wrongSerial'){'TEST_OTHER'}else{$ExpectedSerial};return XmlReply ('<Enq><name>m</name><value>'+$serial+'</value></Enq>')}
  '<</?d' {return XmlReply '<Enq><name>d</name><value>21-09-2026 19:27:00 LUN</value></Enq>'}
  '<</?7' {return XmlReply '<Enq><name>7</name><value>1168</value></Enq>'}
  '=C3' {if($script:scenario -eq 'modeTimeout'){throw 'SIMULATED_MODE_TIMEOUT'};return XmlReply ''}
  '=C1' {if($script:scenario -eq 'restoreTimeout'){throw 'SIMULATED_RESTORE_TIMEOUT'};return XmlReply ''}
  '=C453/$0' {
   return XmlReply ("<EJ><![CDATA[DOCUMENTO GESTIONALE`n19-09-2026 22:34`nCHIUSURA GIORNALIERA 1168`n"+$ExpectedSerial+"`nPRIVATE CUSTOMER`nRSSMRA80A01H501U`n]]></EJ>")
  }
  '=C451/$0/&210926/[210926' {
   if($script:scenario -eq 'dayTimeout'){throw 'SIMULATED_DAY_TIMEOUT'}
   if($script:scenario -eq 'noEJ'){return XmlReply ''}
   if($script:scenario -eq 'emptyDay'){return XmlReply '<EJ></EJ>'}
   $text="DOCUMENTO  COMMERCIALE`nDOCUMENTO N. 1169-0001`n21-09-2026 09:49`nTOTALE  COMPLESSIVO 55,00`n"+$ExpectedSerial+"`nPRIVATE CUSTOMER`nRSSMRA80A01H501U`nDATA CLIENTE PRIVATEPERSON`nPAGATO CARTA 55,00 CARTASECRET12345678`n"
   if($script:scenario -eq 'multiple'){$text+=$text}
   return XmlReply ('<EJ><![CDATA['+$text+']]></EJ>')
  }
  default {throw ('Unexpected command: '+$command)}
 }
}
try{
 foreach($scenario in @('normal','multiple','emptyDay','noEJ','busy','wrongSerial','unknownMode','dayTimeout','modeTimeout','restoreTimeout')){
  $script:scenario=$scenario;$r=Get-PendingDiagnostic $fixture
  Assert (-not $r.emittedFiscalDocument -and -not $r.dailyClosureExecuted -and -not $r.changedJournal -and -not $r.changedPayments) 'A fiscal write was reported'
  Assert ([IO.File]::ReadAllText($entry) -ceq $original) 'Journal changed'
  Assert ([IO.File]::ReadAllText(($entry+'.previous')) -ceq $original) 'Backup changed'
  $json=$r|ConvertTo-Json -Depth 15
  Assert ($json -notmatch 'NEVER_EXPORT_ME|PASSWORD_SECRET|PRIVATE_ERROR_WITH_SECRET|PRIVATE CUSTOMER|RSSMRA80A01H501U|protectedResultToken|PRIVATEPERSON|CARTASECRET') 'Secret or personal data leaked'
  if($scenario -in @('normal','multiple','emptyDay','noEJ')){
   Assert $r.collectionCompleted ('Collection failed: '+$r.stopReason)
   Assert ($r.regRestored -eq $true) 'REG not restored'
   Assert (-not $r.lastReceipt.fieldsUnambiguous) 'Old noncommercial report was considered a sale'
   Assert ($r.lastReceipt.documentDate -ceq '19-09-2026') 'Old date lost'
   Assert ($r.closureCounter -ceq '1168') 'Counter lost'
   Assert ($r.clockShape -match '21-09-2026 19:27:00') 'Clock discarded because it contains a weekday'
   Assert ($r.statusBefore.numericStatusFields.fiscalDocCounter -ceq '9') 'Alternate status counter lost'
   Assert (-not $r.dailyJournal.operationAutomaticallyResolved -and -not $r.dailyJournal.absenceOfReceiptProven) 'Missing evidence changed receipt state'
   if($scenario -eq 'normal'){
    Assert ($r.dailyJournal.documentNumber -ceq '1169-0001' -and $r.dailyJournal.totalCents -eq 5500) 'Date-bounded receipt metadata incorrect'
    Assert ($r.dailyJournal.fieldsUnambiguous -eq $true) 'Unambiguous fixture not recognized'
   }elseif($scenario -eq 'multiple'){
    Assert (-not $r.dailyJournal.fieldsUnambiguous -and $r.dailyJournal.documentNumbers.Count -eq 2) 'Multiple documents misidentified as one'
   }else {Assert (-not $r.dailyJournal.fieldsUnambiguous) 'Missing journal data became proof'}
  }elseif($scenario -in @('busy','wrongSerial','unknownMode')){
   Assert (-not $r.collectionCompleted -and -not $r.transientReadModeAttempted) 'Unsafe mode switch'
  }elseif($scenario -eq 'restoreTimeout'){
   Assert (-not $r.collectionCompleted -and $r.regRestored -eq $false) 'Failed REG recovery hidden'
  }else{
   Assert (-not $r.collectionCompleted -and $r.regRestored -eq $true) 'Failed read did not restore REG'
  }
  Assert (-not ($r.commands|Where-Object {$_ -cnotin @('<</?s','<</?m','<</?d','<</?7','=C3','=C453/$0','=C451/$0/&210926/[210926','=C1')})) 'Unexpected command'
  Write-Host ('PASS V2 '+$scenario+' - no financial changes; journal preserved; metadata only')
 }
 $rejected=$false;try{Parse-SafeXml '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///NONEXISTENT">]><x>&x;</x>'}catch{$rejected=$true};Assert $rejected 'XML external entities accepted'
 $r=Get-PendingDiagnostic (Join-Path $fixture 'missing');Assert (-not $r.collectionCompleted -and $r.commands.Count -eq 0) 'Missing installation contacted printer'
 $bat=[IO.File]::ReadAllText((Join-Path $root 'rch-pending-v2-check/Optyker-Verifica-Giornale-V2.bat'));$marker='# OPTYKER_PS_BEGIN';$body=$bat.Substring($bat.LastIndexOf($marker)+$marker.Length).TrimStart()
 Assert ($body.Replace("`r`n","`n") -ceq [IO.File]::ReadAllText($source).Replace("`r`n","`n")) 'Packaged batch differs from tested code'
 Write-Host 'ALL V2 OFFLINE TESTS PASSED. REAL PRINTER NOT CONTACTED.'
}finally{Remove-Item -LiteralPath $fixture -Force -Recurse}
