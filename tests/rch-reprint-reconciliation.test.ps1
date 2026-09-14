$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
$id='12345678-1234-4234-8234-123456789abc'
$JournalRoot=Join-Path ([IO.Path]::GetTempPath()) ('reconciliation-test-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $JournalRoot | Out-Null
try{
 foreach($scenario in @('valid','missing proof','wrong number','wrong date','wrong total','not completed','unverified identity','wrong job')){
  $original='{"jobId":"'+$id+'","state":"uncertain","cloudSaved":false,"commandsAcknowledged":2,"error":"original error"}'
  [IO.File]::WriteAllText((Journal-Path $id),$original)
  $proof=[pscustomobject]@{source='user_provided_receipt_photo';documentNumber='1162-0017';documentDate='2026-09-13';serialMatched=$true;fiscalCodeMatched=$true;totalCents=1000}
  $job=[pscustomobject]@{id=$id;state='completed';document_number='1162-0017';document_date='2026-09-13';total=10;result=@{manualReconciliation=$proof}}
  switch($scenario){
   'missing proof' {$job.result=@{}}
   'wrong number' {$proof.documentNumber='1162-0018'}
   'wrong date' {$proof.documentDate='2026-09-12'}
   'wrong total' {$proof.totalCents=2000}
   'not completed' {$job.state='uncertain'}
   'unverified identity' {$proof.serialMatched=$false}
   'wrong job' {[IO.File]::WriteAllText((Journal-Path $id),$original.Replace($id,'99999999-1234-4234-8234-123456789abc'));$original=[IO.File]::ReadAllText((Journal-Path $id))}
  }
  $failed=$false;try{Sync-VerifiedReprintJournal $job}catch{$failed=$true}
  if($failed -ne ($scenario -ne 'valid')){throw ('Wrong reconciliation outcome: '+$scenario)}
  if($scenario -eq 'valid'){
   $entry=Read-Journal $id
   if($entry.state -cne 'reconciled_completed' -or -not $entry.cloudSaved -or $entry.commandsAcknowledged -ne 2 -or $entry.error -cne 'original error'){throw 'Original fiscal evidence lost'}
   if([IO.File]::ReadAllText((Journal-Path $id)+'.previous') -cne $original){throw 'Original journal backup not preserved verbatim'}
   Sync-VerifiedReprintJournal $job
   '{"state":"uncertain"}' | Set-Content (Join-Path $JournalRoot 'other.json')
   $blocked=$false;try{Assert-NoUncertainReceipt}catch{$blocked=$true};if(-not $blocked){throw 'Unrelated uncertain receipt must still block printing'}
   Remove-Item (Join-Path $JournalRoot 'other.json')
  }elseif([IO.File]::ReadAllText((Journal-Path $id)) -cne $original){throw 'Unverified journal modified'}
 }
 Write-Host 'Verified cloud reconciliation preserves evidence; invalid proof and unrelated operations remain blocked.'
}finally{Remove-Item $JournalRoot -Recurse -Force}
