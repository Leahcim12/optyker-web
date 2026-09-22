$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$source=Join-Path $root 'Archive-55-Focus.ps1'
$tok=$null;$errors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tok,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
. $source -LibraryOnly
function Assert($yes,[string]$message){if(-not $yes){throw $message}}
function WriteUtf8([string]$p,[string]$s){[IO.File]::WriteAllText($p,$s,(New-Object Text.UTF8Encoding($false)))}
$dir=Join-Path $env:TEMP ('optyker-archive55-test-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($dir)
$cases=0
try{
 function Fixture([string]$name,[string]$state='uncertain'){
  $base=Join-Path $dir $name;$journal=Join-Path $base 'receipts';[void][IO.Directory]::CreateDirectory($journal)
  $entry=[ordered]@{jobId=$TargetJobId;operation='sale';state=$state;writeStarted=$true;commandsAcknowledged=0;idleAfter=$false;cloudSaved=$true;protectedResultToken='SYNTHETIC_ONLY';error='ORIGINAL ERROR';reference=$null;createdAt='2026-09-21T09:49:38.5088115+02:00'}
  $original=ConvertTo-Json $entry -Depth 10 -Compress
  $path=Join-Path $journal ($TargetJobId+'.json');WriteUtf8 $path $original
  WriteUtf8 ($path+'.previous') 'EXACT_PREVIOUS_BYTES'
  $other=Join-Path $journal '811a8496-8966-4695-8143-b2dbafc52d35.json';WriteUtf8 $other '{"state":"prepared","amount":200}'
  return @{base=$base;journal=$journal;path=$path;original=$original;other=$other}
 }
 $f=Fixture 'normal';$r=Clear-ExactFailedAttempt $f.base
 Assert ($r.changed -and $r.state -ceq 'cancelled' -and -not $r.replayAllowed) 'Target not cancelled'
 $result=[IO.File]::ReadAllText($f.path)|ConvertFrom-Json
 Assert ($result.state -ceq 'cancelled' -and $result.cloudSaved -eq $true) 'Terminal state missing'
 Assert ($result.writeStarted -eq $true -and $result.commandsAcknowledged -eq 0 -and $result.error -ceq 'ORIGINAL ERROR') 'Original evidence altered'
 Assert ($result.operationalArchive.externalReceiptVerified -eq $false) 'External receipt falsely verified'
 Assert ($result.operationalArchive.originalSha256 -ceq (Get-BytesHash ([Text.Encoding]::UTF8.GetBytes($f.original)))) 'Backup hash differs'
 Assert ([IO.File]::ReadAllText((Join-Path $f.journal ('archived-focus-55-20260922/'+$TargetJobId+'.original.json'))) -ceq $f.original) 'Original backup differs'
 Assert ([IO.File]::ReadAllText(($f.path+'.previous')) -ceq 'EXACT_PREVIOUS_BYTES') 'Previous file changed'
 Assert ([IO.File]::ReadAllText($f.other) -ceq '{"state":"prepared","amount":200}') 'Other payment touched'
 $before=Get-BytesHash ([IO.File]::ReadAllBytes($f.path));$again=Clear-ExactFailedAttempt $f.base
 Assert (-not $again.changed -and (Get-BytesHash ([IO.File]::ReadAllBytes($f.path))) -ceq $before) 'Not idempotent'
 Assert (-not ($result.state -eq 'not_started' -and $result.cloudSaved -eq $true)) 'Native retry would be allowed'
 Assert ($result.state -notin @('claiming','sending','uncertain')) 'Native blocker still active'
 $cases++;Write-Host 'PASS exact target, original byte backup, idempotency, replay prevention, 200 EUR untouched'
 foreach($state in @('sending','claiming','completed','closing_acknowledged','not_started','prepared','cancelled')){
  $f=Fixture ('state-'+$state) $state;$before=[IO.File]::ReadAllText($f.path);$blocked=$false
  try{$null=Clear-ExactFailedAttempt $f.base}catch{$blocked=$true}
  Assert ($blocked -and [IO.File]::ReadAllText($f.path) -ceq $before) ('Changed wrong state '+$state)
  $cases++
 }
 Write-Host 'PASS busy, completed, unrelated cancelled and repeatable states left intact'
 $f=Fixture 'foreign';WriteUtf8 $f.path ($f.original.Replace($TargetJobId,'811a8496-8966-4695-8143-b2dbafc52d35'));$before=[IO.File]::ReadAllText($f.path);$blocked=$false
 try{$null=Clear-ExactFailedAttempt $f.base}catch{$blocked=$true}
 Assert ($blocked -and [IO.File]::ReadAllText($f.path) -ceq $before) 'Wrong ID touched';$cases++
 $f=Fixture 'referenced';WriteUtf8 $f.path ($f.original.Replace('"reference":null','"reference":{"number":"1169-0001"}'));$before=[IO.File]::ReadAllText($f.path);$blocked=$false
 try{$null=Clear-ExactFailedAttempt $f.base}catch{$blocked=$true}
 Assert ($blocked -and [IO.File]::ReadAllText($f.path) -ceq $before) 'Referenced document touched';$cases++
 $f=Fixture 'locked';$lock=[IO.File]::Open((Join-Path $f.journal 'printer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$blocked=$false
 try{try{$null=Clear-ExactFailedAttempt $f.base}catch{$blocked=$true}}finally{$lock.Dispose()}
 Assert ($blocked -and [IO.File]::ReadAllText($f.path) -ceq $f.original) 'Exclusive printer lock ignored';$cases++
 $f=Fixture 'badbackup';$backup=Join-Path $f.journal 'archived-focus-55-20260922';[void][IO.Directory]::CreateDirectory($backup);WriteUtf8 (Join-Path $backup ($TargetJobId+'.original.json')) 'WRONG_BACKUP';$blocked=$false
 try{$null=Clear-ExactFailedAttempt $f.base}catch{$blocked=$true}
 Assert ($blocked -and [IO.File]::ReadAllText($f.path) -ceq $f.original) 'Bad backup did not stop replacement';$cases++
 $f=Fixture 'missing';[IO.File]::Delete($f.path);$r=Clear-ExactFailedAttempt $f.base
 Assert (-not $r.changed -and $r.state -ceq 'not_present' -and -not [IO.File]::Exists($f.path)) 'Missing journal invented';$cases++
 $f=Fixture 'invalid';WriteUtf8 $f.path 'INVALID_JSON';$blocked=$false
 try{$null=Clear-ExactFailedAttempt $f.base}catch{$blocked=$true}
 Assert ($blocked -and [IO.File]::ReadAllText($f.path) -ceq 'INVALID_JSON') 'Invalid JSON overwritten';$cases++
 $code=[IO.File]::ReadAllText($source)
 Assert ($code -notmatch 'Invoke-RestMethod|Invoke-WebRequest|HttpClient|WebRequest|Send-Rch|Invoke-Fiscal|Stop-Process|Start-Service|Set-ExecutionPolicy|=C[0-9]|=R[0-9]|=T[0-9]') 'Network/printer/service command present'
 $batch=[IO.File]::ReadAllText((Join-Path $root 'Optyker-Rimuovi-Blocco-55.bat'));$marker='# OPTYKER_ARCHIVE55_BEGIN';$pos=$batch.LastIndexOf($marker)
 Assert ($pos -gt 0) 'Self-contained BAT marker missing'
 $script=[scriptblock]::Create($batch.Substring($pos+$marker.Length));& $script -LibraryOnly
 Assert ($null -ne (Get-Command Clear-ExactFailedAttempt)) 'Embedded script did not parse'
 $cases++;Write-Host ('ALL '+$cases+' TESTS PASSED; NO NETWORK OR REAL PRINTER CONTACT')
}finally{Remove-Item -LiteralPath $dir -Recurse -Force}
