$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/Diagnostica-Configurazione-RCH.ps1') -LibraryOnly
function Assert-True($condition,[string]$message){if(-not $condition){throw $message}}
$script:fixtureRequestXml='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
$script:fixtureStatusXml='<Service>'+$script:fixtureRequestXml+'<ECRStatus><mode>PRG</mode><idleState>0</idleState></ECRStatus></Service>'
$script:fixtureIdentityXml='<Service>'+$script:fixtureRequestXml+'<Enq><name>m</name><value>72IV6003831</value></Enq></Service>'
# Real response shape observed in the shop diagnostic, no invented result schema.
$firmware='<Service>'+$script:fixtureRequestXml+'<Enq><name>f</name><value>FW v.  3.1.0  </value></Enq></Service>'
Assert-True ((Get-RchEnquiryValue $firmware 'f') -ceq 'FW v.  3.1.0') 'Read the value from the observed Enq shape.'
$leaves=Get-RchXmlLeafValues $firmware
Assert-True (@($leaves | Where-Object {$_.path -ceq 'Service/Enq/name'}).Count -eq 1) 'Child name must not shadow the XML element name.'
Assert-True (@($leaves | Where-Object {$_.path -ceq 'Service/f/name'}).Count -eq 0) 'Do not invent XML paths using the name child value.'
foreach($bad in @(
  ($firmware -replace '<name>f</name>','<name>m</name>'),
  ($firmware -replace '</Enq>','<value>OTHER</value></Enq>'),
  ($firmware -replace '<value>FW v.  3.1.0  </value>','<value><x>FW v.  3.1.0</x></value>'),
  ($firmware -replace '</Service>','<Enq><name>f</name><value>OTHER</value></Enq></Service>'),
  ($firmware -replace '<lastCmd>1','<lastCmd>0'),
  '<Service><Request/></Service>',
  '<!DOCTYPE Service [<!ENTITY x SYSTEM "file:///nonexistent">]><Service>&x;</Service>'
)){
  $failed=$false;try{$null=Get-RchEnquiryValue $bad 'f'}catch{$failed=$true}
  Assert-True $failed 'Reject mismatched, duplicated, nested, unacknowledged, or unsafe enquiry data.'
}
$script:commands=New-Object 'System.Collections.Generic.List[string]'
$script:scenario='success'
function Request-Printer([string]$method,[string]$body='') {
  Assert-True ($method -ceq 'POST') 'Use the already verified HTTP transport.'
  $doc=Read-SafeXml $body
  Assert-True ($doc.SelectNodes('/Service/cmd').Count -eq 1) 'One command per request.'
  $command=[string]$doc.Service.cmd;$script:commands.Add($command)
  Assert-True ($command -cin @('<</?s','<</?m','<</?C')) 'No mode changes, programming writes, or print commands.'
  if($script:scenario -eq 'offline'){throw 'Simulated timeout'}
  if($command -ceq '<</?s'){
    if($script:scenario -eq 'reg'){return ($script:fixtureStatusXml -replace '<mode>PRG','<mode>REG')}
    if($script:scenario -eq 'open'){return ($script:fixtureStatusXml -replace '<idleState>0','<idleState>1')}
    if($script:scenario -eq 'busy'){return ($script:fixtureStatusXml -replace '<busy>0','<busy>1')}
    if($script:scenario -eq 'unknown'){return ($script:fixtureStatusXml -replace '<mode>PRG','<mode>SERVICE')}
    if($script:scenario -eq 'changed' -and $script:commands.Count -eq 4){return ($script:fixtureStatusXml -replace '<mode>PRG','<mode>REG')}
    return $script:fixtureStatusXml
  }
  if($command -ceq '<</?m'){
    if($script:scenario -eq 'wrong-device'){return ($script:fixtureIdentityXml -replace '72IV6003831','72IV6000000')}
    if($script:scenario -eq 'missing-serial'){return $script:fixtureStatusXml}
    return $script:fixtureIdentityXml
  }
  if($script:scenario -eq 'refused'){return ($script:fixtureStatusXml -replace '<errorCode>0','<errorCode>101')}
  if($script:scenario -eq 'timeout'){throw 'Simulated programming timeout'}
  if($script:scenario -eq 'empty'){return $script:fixtureStatusXml}
  # Synthetic configuration payload: evidence capture must not claim it is verified.
  return ('<Service>'+$script:fixtureRequestXml+'<Enq><name>C</name><value>UNVERIFIED TEST PAYLOAD</value></Enq></Service>')
}
Assert-True ($script:commands.Count -eq 0) 'Library import must have no printer I/O.'
$report=Get-RchConfigurationDiagnostic
Assert-True ($report.collectionCompleted -and $report.identityMatched -and $report.configurationPayloadPresent) 'Capture only after explicit PRG and matching serial.'
Assert-True (($script:commands.ToArray() -join '|') -ceq '<</?s|<</?m|<</?C|<</?s') 'Exact read-only sequence, no repeated programming query.'
Assert-True (-not $report.programmingVerified -and -not $report.fiscalEmissionEnabled -and -not $report.emittedFiscalDocument -and -not $report.changedMode -and -not $report.changedProgramming -and -not $report.tsSubmitted) 'Successful collection cannot enable fiscal actions.'
foreach($scenario in @('offline','reg','open','busy','unknown','wrong-device','missing-serial','refused','timeout','empty','changed')){
  $script:commands.Clear();$script:scenario=$scenario;$bad=Get-RchConfigurationDiagnostic
  $expectedCount=if($scenario -in @('wrong-device','missing-serial')){2}elseif($scenario -in @('refused','timeout')){3}elseif($scenario -in @('empty','changed')){4}else{1}
  Assert-True ($script:commands.Count -eq $expectedCount -and -not $bad.collectionCompleted -and $bad.stopReason) "Stop correctly for $scenario."
  Assert-True $bad.reportGenerated 'Keep incomplete report available.'
}
$directory=Join-Path ([IO.Path]::GetTempPath()) ('rch-config-test-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $directory
try {
  $a=Save-RchConfigurationDiagnostic $report $directory;$b=Save-RchConfigurationDiagnostic $bad $directory
  Assert-True ($a -cne $b) 'Keep prior reports intact.'
  $saved=Get-Content -LiteralPath $a -Raw | ConvertFrom-Json
  Assert-True ($saved.probes.Count -eq 4 -and -not $saved.programmingVerified) 'Save full evidence without upgrading readiness.'
} finally {Remove-Item -LiteralPath $directory -Recurse -Force}
Write-Host 'PASS: canonical Enq parser, XML name collision, mode/identity guards, no retries, raw evidence and local reports.'
