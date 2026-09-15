$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
function Assert($value,$message){if(-not $value){throw $message}}
function Assert-WindowsFiscalPlatform {}
function Protect-JournalToken([string]$v){return 'test-'+$v}
function Unprotect-JournalToken([string]$v){return $v.Substring(5)}
$script:ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
function JournalXml([string]$number,[string]$amount='12,50',[string]$cf='RSSMRA80A01H501U') {
 $text="ARTICOLO`n$cf`nTOTALE COMPLESSIVO $amount`n15-09-2026 14:28`nDOCUMENTO N. $number`n*** 72IV6003831 ***`n"
 return '<Service>'+$script:ack+'<EJ>'+[Security.SecurityElement]::Escape($text)+'</EJ></Service>'
}
function Invoke-FiscalCloud($action,$payload){
 if($action -eq 'bridge_claim'){return @{document=$script:document;result_token=('a'*64)}}
 if($script:cloudFail){throw 'cloud offline'}
 $script:result=$payload.result;return @{ok=$true}
}
function Send-RchCommand([string]$command){
 $script:commands.Add($command)
 if($command -eq '=C3'){$script:mode='Z'}
 if($command -eq '=C1'){
  if($script:scenario -eq 'reg-failure' -and $script:reads -eq 1){throw 'REG failed'}
  $script:mode='REG'
 }
 if($command -eq '=T4'){$script:printed=$true}
 if($command -eq '=C453/$0'){
  Assert ($script:mode -eq 'Z') 'Must select journal reading mode'
  $script:reads++
  if($script:scenario -eq 'read-failure' -or ($script:scenario -eq 'after-failure' -and $script:printed)){throw 'read failed'}
  if(-not $script:printed){return JournalXml '1164-0004'}
  if($script:scenario -eq 'stale'){return JournalXml '1164-0004'}
  if($script:scenario -eq 'skipped'){return JournalXml '1164-0006'}
  if($script:scenario -eq 'wrong-total'){return JournalXml '1164-0005' '13,50'}
  if($script:scenario -eq 'wrong-cf'){return JournalXml '1164-0005' '12,50' 'RSSMRA80A01H501X'}
  return JournalXml '1164-0005'
 }
 if($command -eq '<</?m'){return '<Service>'+$script:ack+'<Enq><name>m</name><value>72IV6003831</value></Enq></Service>'}
 if($command -eq '<</?i/*3'){return '<Service>'+$script:ack+'<Enq><name>i/*3</name><value>111000</value></Enq></Service>'}
 return '<Service>'+$script:ack+'<ECRStatus><mode>'+$script:mode+'</mode><idleState>0</idleState></ECRStatus></Service>'
}
foreach($scenario in @('ok','stale','skipped','wrong-total','wrong-cf','read-failure','after-failure','reg-failure','legacy')){
 $script:JournalRoot=Join-Path ([IO.Path]::GetTempPath()) ('optyker-successor-'+[guid]::NewGuid())
 $script:commands=New-Object 'System.Collections.Generic.List[string]';$script:mode='REG';$script:scenario=$scenario;$script:cloudFail=$true;$script:printed=$false;$script:reads=0
 $id=[guid]::NewGuid().ToString()
 $script:document=[pscustomobject]@{operation='sale';serial='72IV6003831';automaticReference=$false;totalCents=1250;paymentCode=4;talkingReceipt=$true;fiscalCode='RSSMRA80A01H501U';lines=@([pscustomobject]@{department=1;quantity=1;unitPriceCents=1250;description='ARTICOLO'});commands=@('=R1/$1250/*1/(ARTICOLO)','="/?C/(RSSMRA80A01H501U)','=T4');referenceReadback=@{strategy='ej-successor-v1';jobId=$id;date='2026-09-15'}}
 if($scenario -eq 'legacy'){$document.referenceReadback=$null}
 try{
  $r=Emit-Receipt @{jobId=$id;token=('b'*64)}
  if($scenario -eq 'reg-failure'){
   Assert ($r.state -eq 'not_started' -and -not $r.writeStarted -and -not $script:printed) 'Failed REG restoration before printing must prevent fiscal writes'
  }else{
   Assert ($r.state -eq 'closing_acknowledged' -and $script:mode -eq 'REG') 'Readback failure must preserve closure and return to REG'
   if($scenario -eq 'ok'){
    Assert ($r.reference.number -eq '1164-0005' -and $r.reference.previous.number -eq '1164-0004' -and $r.reference.jobId -eq $id -and $r.reference.totalCents -eq 1250) 'Read actual number with matching before/after proof'
   }else{Assert (-not $r.reference) 'Unverified readback must never fill a number'}
   $fiscal=@($commands | Where-Object {$_ -match '^=R|^=T|^="'})
   Assert (($fiscal -join '|') -ceq ($document.commands -join '|')) 'Fiscal command sequence must remain identical'
   if($scenario -eq 'legacy'){Assert ($script:reads -eq 0) 'Legacy documents must not acquire unrelated references'}
  }
  Assert (-not $commands.Contains('=C10')) 'Never perform a daily closure'
  $count=$commands.Count;$script:cloudFail=$false;$r=Read-ReceiptStatus $id
  Assert ($r.cloudSaved -and $commands.Count -eq $count) 'Sync must only deliver cached outcome'
  if($scenario -ne 'reg-failure'){$null=Emit-Receipt @{jobId=$id;token=('c'*64)};Assert ($commands.Count -eq $count) 'Duplicate click must never print again'}
  Assert ((Get-Content -Raw (Journal-Path $id)) -notmatch 'RSSMRA|ARTICOLO|TOTALE COMPLESSIVO') 'Do not persist fiscal code or raw journal'
 }finally{Remove-Item -LiteralPath $JournalRoot -Recurse -Force}
}
Write-Host 'Consecutive readback, unchanged fiscal writes, safe failures, retry, REG and privacy checks passed.'
