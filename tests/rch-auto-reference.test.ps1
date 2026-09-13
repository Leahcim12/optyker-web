$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
function Assert($value,$message){if(-not $value){throw $message}}
function Assert-WindowsFiscalPlatform {}
function Protect-JournalToken([string]$v){return 'test-'+$v}
function Unprotect-JournalToken([string]$v){return $v.Substring(5)}
$script:ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
$marker='OPTYKER 12345678123442348234123456789ABC'
$script:document=[pscustomobject]@{operation='sale';serial='72IV6003831';automaticReference=$true;receiptMarker=$marker;totalCents=1250;paymentCode=4;talkingReceipt=$true;fiscalCode='RSSMRA80A01H501U';lines=@([pscustomobject]@{department=1;quantity=1;unitPriceCents=1250;description='ARTICOLO'});commands=@('=R1/$1250/*1/(ARTICOLO)','="/?C/(RSSMRA80A01H501U)',('="/?A/('+$marker+')'),'=T4')}
$script:journalText="ARTICOLO   4%   12,50`n$marker`nRSSMRA80A01H501U`nTOTALE COMPLESSIVO 12,50`n13-09-2026 14:28`nDOCUMENTO N. 1162-0017`n*** 72IV6003831 ***`n"
function JournalXml([string]$t){return '<Service>'+$script:ack+'<EJ>'+[Security.SecurityElement]::Escape($t)+'</EJ></Service>'}
$ref=Parse-ReceiptJournal (JournalXml $journalText) $document
Assert ($ref.number -eq '1162-0017' -and $ref.date -eq '2026-09-13' -and $ref.totalCents -eq 1250) 'Actual printed number, date and total must be read'
foreach($bad in @($journalText.Replace($marker,'OTHER'),$journalText.Replace('12,50','13,50'),$journalText.Replace('72IV6003831','72IV6003832'),$journalText.Replace('RSSMRA80A01H501U','RSSMRA80A01H501X'),($journalText+"`nDOCUMENTO N. 1162-0018`n"),$journalText.Replace('DOCUMENTO N.','DOC. GESTIONALE N.'))){
 $rejected=$false;try{$null=Parse-ReceiptJournal (JournalXml $bad) $document}catch{$rejected=$true};Assert $rejected 'Mismatching journal must not create an automatic reference'
}
function Invoke-FiscalCloud($action,$payload){
 if($action -eq 'bridge_claim'){return @{document=$script:document;result_token=('a'*64)}}
 if($script:cloudFail){throw 'cloud offline'}
 $script:result=$payload.result;return @{ok=$true}
}
function Send-RchCommand([string]$command){
 $script:commands.Add($command)
 if($command -eq '=C3'){$script:mode='Z'}
 if($command -eq '=C1'){$script:mode='REG'}
 if($command -eq '=C453/$0'){
  Assert ($script:mode -eq 'Z') 'Journal read requires Z'
  if($script:readFail){throw 'journal unavailable'}
  return JournalXml $script:journalText
 }
 if($command -eq '<</?m'){return '<Service>'+$script:ack+'<Enq><name>m</name><value>72IV6003831</value></Enq></Service>'}
 if($command -eq '<</?i/*3'){return '<Service>'+$script:ack+'<Enq><name>i/*3</name><value>111000</value></Enq></Service>'}
 return '<Service>'+$script:ack+'<ECRStatus><mode>'+$script:mode+'</mode><idleState>0</idleState></ECRStatus></Service>'
}
foreach($readFail in @($false,$true)){
 $script:JournalRoot=Join-Path ([IO.Path]::GetTempPath()) ('optyker-auto-test-'+[guid]::NewGuid());$script:commands=New-Object 'System.Collections.Generic.List[string]';$script:mode='REG';$script:readFail=$readFail;$script:cloudFail=$true
 try{
  $id=[guid]::NewGuid().ToString();$r=Emit-Receipt @{jobId=$id;token=('b'*64)}
  Assert ($r.state -eq 'closing_acknowledged' -and $script:mode -eq 'REG') 'Readback failure cannot undo closure or leave the printer in Z'
  Assert ((-not $readFail -and $r.reference.number -eq '1162-0017') -or ($readFail -and -not $r.reference)) 'Reference is present only for a matching journal'
  Assert (-not $commands.Contains('=C10')) 'No fiscal daily closure is allowed'
  $count=$commands.Count;$script:cloudFail=$false;$r=Read-ReceiptStatus $id
  Assert ($r.cloudSaved -and $commands.Count -eq $count) 'Cloud retry must use the local reference without printer IO'
  Assert ((Get-Content -Raw (Journal-Path $id)) -notmatch 'RSSMRA|ARTICOLO|TOTALE COMPLESSIVO') 'Journal must not store CF, items or receipt text'
  $null=Emit-Receipt @{jobId=$id;token=('c'*64)};Assert ($commands.Count -eq $count) 'Repeat clicks cannot print another receipt'
 }finally{Remove-Item -LiteralPath $JournalRoot -Recurse -Force}
}
Write-Host 'Automatic journal reference, correlation, REG restoration, cloud retry and privacy passed.'
