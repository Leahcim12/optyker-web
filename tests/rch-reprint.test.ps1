$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
function Assert($v,$m){if(-not $v){throw $m}}
function Assert-WindowsFiscalPlatform {}
$script:job=[pscustomobject]@{state='completed';serial='72IV6003831';document_number='1162-0017';document_date='2026-09-13'}
function Get-ReprintJob($r){return $script:job}
$script:ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
function Send-RchCommand([string]$cmd){
 $script:commands.Add($cmd)
 if($cmd -eq '=C3'){$script:mode='Z'}
 if($cmd -eq '=C1'){$script:mode='REG'}
 if($cmd -eq '<</?m'){return '<Service>'+$script:ack+'<Enq><name>m</name><value>72IV6003831</value></Enq></Service>'}
 if($cmd -like '=C452/$0*'){
   if($script:readFail){throw 'read failed'}
   return '<Service>'+$script:ack+'<EJ>'+[Security.SecurityElement]::Escape($script:text)+'</EJ></Service>'
 }
 if($cmd -like '=C452/$1*' -and $script:printFail){throw 'lost response'}
 return '<Service>'+$script:ack+'<ECRStatus><mode>'+$script:mode+'</mode><idleState>0</idleState></ECRStatus></Service>'
}
$good="DOCUMENTO N. 1162-0017`n13-09-2026 14:28`n*** 72IV6003831 ***"
$script:JournalRoot=Join-Path ([IO.Path]::GetTempPath()) ('rch-reprint-test-'+[guid]::NewGuid())
try{
 foreach($case in @('ok','wrong closure','wrong date','wrong serial','duplicate','read fail','print fail','uncertain','bad number')){
  $script:commands=New-Object 'Collections.Generic.List[string]';$script:mode='REG';$script:text=$good;$script:readFail=$case -eq 'read fail';$script:printFail=$case -eq 'print fail';$script:job.document_number='1162-0017'
  if($case -eq 'wrong closure'){$script:text=$good.Replace('1162','1161')}
  if($case -eq 'wrong date'){$script:text=$good.Replace('13-09','12-09')}
  if($case -eq 'wrong serial'){$script:text=$good.Replace('3831','3832')}
  if($case -eq 'duplicate'){$script:text=$good+"`nDOCUMENTO N. 1162-0017"}
  if($case -eq 'bad number'){$script:job.document_number='1162-0017/=C10'}
  if($case -eq 'uncertain'){'{"state":"uncertain"}' | Set-Content (Join-Path $JournalRoot 'blocked.json')}
  $failed=$false
  try{$result=Reprint-Receipt @{jobId='12345678-1234-4234-8234-123456789abc'}}catch{$failed=$true}
  Assert ($failed -eq ($case -ne 'ok')) ('Unexpected outcome: '+$case)
  Assert ($script:mode -eq 'REG') ('REG restoration: '+$case)
  $prints=@($commands | Where-Object {$_ -like '=C452/$1*'})
  Assert ($prints.Count -eq $(if($case -in @('ok','print fail')){1}else{0})) ('Wrong document printed: '+$case)
  if($prints.Count){Assert ($prints[0] -ceq '=C452/$1/&130926/[17/]17') 'Only selected receipt range may print'}
  Assert (-not ($commands | Where-Object {$_ -match '^=(R|T|k)' -or $_ -eq '=C10'})) 'No emission, void or daily closure'
  Remove-Item (Join-Path $JournalRoot 'blocked.json') -ErrorAction SilentlyContinue
 }
}finally{Remove-Item $JournalRoot -Recurse -Force -ErrorAction SilentlyContinue}
Write-Host 'RCH selected receipt, mismatch guards, uncertain lock, no fiscal writes and REG restoration passed.'
