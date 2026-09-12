$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
function Assert($x,$m){if(-not $x){throw $m}}
function Assert-WindowsFiscalPlatform {}
function Protect-JournalToken([string]$v){return 'test-protected-'+$v}
function Unprotect-JournalToken([string]$v){return $v.Substring(15)}
$script:ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
$script:doc=[pscustomobject]@{serial='72IV6003831';totalCents=1250;paymentCode=1;talkingReceipt=$false;lines=@([pscustomobject]@{department=1;quantity=1;unitPriceCents=1250;description='OCCHIALI'});commands=@('=R1/$1250/*1/(OCCHIALI)','=T1')}
function Invoke-FiscalCloud($action,$payload){
 if($action -eq 'bridge_claim'){$script:claims++;return @{document=$script:doc;result_token=('b'*64)}}
 if($script:cloudFail){throw 'Cloud unavailable'}
 $script:outcome=$payload.result;return @{ok=$true}
}
function Send-RchCommand([string]$command){
 $script:commands.Add($command)
 if($command.StartsWith('=')){
  $saved=Read-Journal $script:jobId;Assert ($saved.writeStarted -and $saved.state -eq 'sending') 'Durable intent must precede fiscal IO'
  if($script:failAt -eq $command){throw 'Lost ACK'}
  return '<Service>'+$script:ack+'</Service>'
 }
 if($command -eq '<</?m'){return '<Service>'+$script:ack+'<Enq><name>m</name><value>'+$script:serial+'</value></Enq></Service>'}
 if($command -eq '<</?i/*3'){return '<Service>'+$script:ack+'<Enq><name>i/*3</name><value>111000</value></Enq></Service>'}
 return '<Service>'+$script:ack+'<ECRStatus><mode>REG</mode><idleState>0</idleState></ECRStatus></Service>'
}
function Scenario {
 $script:JournalRoot=Join-Path ([System.IO.Path]::GetTempPath()) ('optyker-emission-test-'+[guid]::NewGuid())
 $script:commands=New-Object 'System.Collections.Generic.List[string]';$script:claims=0;$script:failAt='';$script:cloudFail=$false;$script:serial='72IV6003831';$script:outcome=$null;$script:jobId=[guid]::NewGuid().ToString()
}
Scenario
try{
 $r=Emit-Receipt @{jobId=$jobId;token=('a'*64)}
 Assert ($r.state -eq 'closing_acknowledged' -and $r.commandsAcknowledged -eq 2 -and $r.cloudSaved) 'Full acknowledged receipt should await reference'
 $count=$commands.Count;$null=Emit-Receipt @{jobId=$jobId;token=('a'*64)}
 Assert ($commands.Count -eq $count -and $claims -eq 1) 'Replay must not call printer or claim again'
 Assert ((Get-Content -Raw (Journal-Path $jobId)) -notmatch 'OCCHIALI|=R1') 'Journal must not contain customer lines or commands'
}finally{Remove-Item -Recurse -Force $JournalRoot}
foreach($failure in @('=R1/$1250/*1/(OCCHIALI)','=T1')){
 Scenario
 try{
  $script:failAt=$failure;$r=Emit-Receipt @{jobId=$jobId;token=('a'*64)}
  Assert ($r.state -eq 'uncertain') 'A lost fiscal ACK must be uncertain'
  $count=$commands.Count;$null=Emit-Receipt @{jobId=$jobId;token=('a'*64)}
  Assert ($commands.Count -eq $count) 'Uncertain receipt must not resume or replay'
  $blocked=$false;try{$null=Emit-Receipt @{jobId=[guid]::NewGuid().ToString();token=('a'*64)}}catch{$blocked=$true}
  Assert $blocked 'Another receipt must be blocked while uncertain'
 }finally{Remove-Item -Recurse -Force $JournalRoot}
}
Scenario
try{
 $script:serial='WRONG';$r=Emit-Receipt @{jobId=$jobId;token=('a'*64)}
 Assert ($r.state -eq 'not_started' -and @($commands|Where-Object {$_.StartsWith('=')}).Count -eq 0) 'Wrong serial must not print'
 $script:serial='72IV6003831';$r=Emit-Receipt @{jobId=$jobId;token=('c'*64)}
 Assert ($r.state -eq 'closing_acknowledged' -and $claims -eq 2) 'A confirmed no-write failure may use a renewed capability'
}finally{Remove-Item -Recurse -Force $JournalRoot}
Scenario
try{
 $script:cloudFail=$true;$r=Emit-Receipt @{jobId=$jobId;token=('a'*64)}
 Assert (-not $r.cloudSaved -and $r.state -eq 'closing_acknowledged') 'Cloud timeout must preserve local result'
 $count=$commands.Count;$script:cloudFail=$false;$r=Read-ReceiptStatus $jobId
 Assert ($r.cloudSaved -and $commands.Count -eq $count) 'Status should sync cloud without printer IO'
}finally{Remove-Item -Recurse -Force $JournalRoot}
Write-Host 'Fiscal receipt journaling, duplicate prevention, lost ACK, serial mismatch and cloud recovery passed.'
