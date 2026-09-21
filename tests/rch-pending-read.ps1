$ErrorActionPreference='Stop'
$source=Join-Path (Split-Path $PSScriptRoot -Parent) 'rch-connector/Verifica-Scontrino-Sospeso.ps1'
$tok=$null;$err=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tok,[ref]$err)
if($err.Count){throw ($err|Out-String)}
. $source -LibraryOnly
function Assert($condition,[string]$message){if(-not $condition){throw $message}}
foreach($command in @('=C10','=T1','=R1/$100/*1/(TEST)','=C453/$1','=C453/$2')){
 $rejected=$false;try{Invoke-RchReadCommand $command}catch{$rejected=$true};Assert $rejected ('Write command permitted: '+$command)
}
$fixture=Join-Path $env:TEMP ('optyker-pending-test-'+[guid]::NewGuid().ToString('N'))
$journal=Join-Path $fixture 'receipts';[void](New-Item -ItemType Directory -Path $journal)
[IO.File]::WriteAllText((Join-Path $journal 'printer.lock'),'')
$id=$TargetJobIds[0];$entry=Join-Path $journal ($id+'.json')
$original=@{jobId=$id;state='uncertain';operation='sale';writeStarted=$true;commandsAcknowledged=0;idleAfter=$false;cloudSaved=$true;createdAt='2026-09-21T09:49:44+02:00';protectedResultToken='NEVER_EXPORT_ME';password='PASSWORD_SECRET';error='PRIVATE_ERROR_WITH_SECRET';fiscalCode='RSSMRA80A01H501U'} | ConvertTo-Json
[IO.File]::WriteAllText($entry,$original);[IO.File]::WriteAllText(($entry+'.previous'),$original)
function Read-BridgeHealth{return @{ok=$true;connector='Optyker RCH';version='fixture';printer='192.168.1.10'}}
function XmlReply([string]$extra,[int]$busy=0){return '<Service><Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><busy>'+[string]$busy+'</busy><lastCmd>1</lastCmd></Request>'+$extra+'</Service>'}
function Invoke-RchReadCommand([string]$command){
 $script:ReadCommands.Add($command)
 switch -CaseSensitive ($command){
  '<</?s' {$busy=if($script:scenario -eq 'busy'){1}else{0};$mode=if($script:scenario -eq 'unknownMode'){''}else{'REG'};return XmlReply ('<ECRStatus><mode>'+$mode+'</mode><idleState>0</idleState><lastZ>1168</lastZ><lastDocF>9</lastDocF></ECRStatus>') $busy}
  '<</?m' {$serial=if($script:scenario -eq 'wrongSerial'){'TEST_OTHER'}else{$ExpectedSerial};return XmlReply ('<Enq><name>m</name><value>'+$serial+'</value></Enq>')}
  '<</?d' {return XmlReply '<Enq><name>d</name><value>210926 190000</value></Enq>'}
  '=C3' {if($script:scenario -eq 'modeTimeout'){throw 'SIMULATED_MODE_TIMEOUT'};return XmlReply ''}
  '=C1' {if($script:scenario -eq 'restoreTimeout'){throw 'SIMULATED_RESTORE_TIMEOUT'};return XmlReply ''}
  '=C453/$0' {
   if($script:scenario -eq 'journalTimeout'){throw 'SIMULATED_READ_TIMEOUT'}
   if($script:scenario -eq 'noEJ'){return XmlReply ''}
   return XmlReply ("<EJ><![CDATA[DOCUMENTO COMMERCIALE`nDOCUMENTO N. 1168-0009`n19-09-2026 22:44:15`nTOTALE COMPLESSIVO 10,00`n"+$ExpectedSerial+"`nPRIVATE CUSTOMER`nRSSMRA80A01H501U`n]]></EJ>")
  }
  default {throw ('Unexpected command: '+$command)}
 }
}
try{
 foreach($scenario in @('normal','busy','wrongSerial','unknownMode','journalTimeout','modeTimeout','noEJ','restoreTimeout')){
  $script:scenario=$scenario;$r=Get-PendingDiagnostic $fixture
  Assert (-not $r.emittedFiscalDocument -and -not $r.dailyClosureExecuted -and -not $r.changedJournal -and -not $r.changedPayments) 'A fiscal write was reported'
  Assert ([IO.File]::ReadAllText($entry) -ceq $original) 'Journal changed'
  Assert ([IO.File]::ReadAllText(($entry+'.previous')) -ceq $original) 'Backup changed'
  $json=$r | ConvertTo-Json -Depth 12
  Assert ($json -notmatch 'NEVER_EXPORT_ME|PASSWORD_SECRET|PRIVATE_ERROR_WITH_SECRET|PRIVATE CUSTOMER|RSSMRA80A01H501U|protectedResultToken') 'Secret or personal data leaked'
  if($scenario -eq 'normal'){
   Assert $r.collectionCompleted ('Collection failed: '+$r.stopReason)
   Assert ($r.regRestored -eq $true) 'REG was not restored'
   Assert ($r.lastReceipt.documentNumber -ceq '1168-0009') 'Wrong printed reference'
   Assert ($r.lastReceipt.totalCents -eq 1000) 'Wrong total'
   Assert ($r.statusBefore.lastDocF -ceq '9') 'Raw counter not retained'
   Assert ($r.localJournal[0].current.commandsAcknowledged -eq 0) 'Missing local acknowledgement count'
   Assert ($r.localJournal[1].current.present -eq $false) 'Missing journal was invented'
  }elseif($scenario -in @('busy','wrongSerial','unknownMode')){
   Assert (-not $r.collectionCompleted -and -not $r.transientReadModeAttempted) 'Unsafe mode switch'
   Assert (-not ($r.commands -contains '=C3')) 'Unsafe reading attempted'
  }elseif($scenario -eq 'restoreTimeout'){
   Assert (-not $r.collectionCompleted -and $r.regRestored -eq $false) 'Failed REG recovery hidden'
  }else{
   Assert (-not $r.collectionCompleted -and $r.regRestored -eq $true) 'Read failure did not restore REG'
   Assert ($r.commands -contains '=C1') 'REG restore command missing'
  }
  Assert (-not ($r.commands | Where-Object {$_ -cnotin @('<</?s','<</?m','<</?d','=C3','=C453/$0','=C1')})) 'Unexpected physical command'
  Write-Host ('PASS '+$scenario+' - no financial changes, journal preserved, secrets excluded')
 }
 $rejected=$false;try{Parse-SafeXml '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///NONEXISTENT">]><x>&x;</x>'}catch{$rejected=$true};Assert $rejected 'XML external entities accepted'
 $r=Get-PendingDiagnostic (Join-Path $fixture 'missing');Assert (-not $r.collectionCompleted -and $r.commands.Count -eq 0) 'Missing installation should not contact printer'
 Write-Host 'PASS XML hardening and wrong-PC checks'
 Write-Host 'ALL READ-ONLY DIAGNOSTIC TESTS PASSED; REAL PRINTER NOT CONTACTED'
}finally{Remove-Item -LiteralPath $fixture -Force -Recurse}
