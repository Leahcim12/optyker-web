$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$fixture=Get-Content (Join-Path $repo 'rch-connector/rch-optyker-connector.ps1') -Raw
$oldLocal=$env:LOCALAPPDATA
$env:LOCALAPPDATA=Join-Path ([IO.Path]::GetTempPath()) ('rch-update-test-'+[guid]::NewGuid())
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH';New-Item -ItemType Directory -Path $base -Force | Out-Null
$target=Join-Path $base 'rch-optyker-connector.ps1'
# Simulate a POS-patched connector without the new reprint addition.
$previous=[regex]::Replace($fixture,'(?s)# BEGIN OPTYKER_RCH_REPRINT_V1.*?# END OPTYKER_RCH_REPRINT_V1','')
$previous=$previous.Replace('reconcileReceipt=$true;','').Replace('reprintReceipt=$true;','').Replace("'1.8-auto-receipt'","'1.9-pos'")
$previous=[regex]::Replace($previous,"(?s)\} elseif\(\`$request.method -eq 'POST' -and \`$request.path -eq '/receipt/reprint'\)\{.*?(?=\} elseif)",'')
$previous+="`n# Existing POS QR customisation must survive`n"
[IO.File]::WriteAllText($target,$previous)
function Invoke-WebRequest {param([switch]$UseBasicParsing,$Uri,$OutFile) [IO.File]::WriteAllText($OutFile,$fixture)}
function Invoke-RestMethod {param($Uri,$TimeoutSec) return @{ok=$true;printer='192.168.1.10';capabilities=@{reprintReceipt=$true;reconcileReceipt=$true};mode='REG';idleState='0'}}
function Get-CimInstance {param($ClassName) return @()}
function Start-Process {param($FilePath,$ArgumentList,$WindowStyle)}
function Start-Sleep {param($Milliseconds)}
try{
 $journal=Join-Path $base 'receipts';New-Item -ItemType Directory -Path $journal -Force | Out-Null
 foreach($state in @('uncertain','claiming','sending')){[IO.File]::WriteAllText((Join-Path $journal ($state+'.json')),('{"state":"'+$state+'","writeStarted":true}'))}
 $snapshots=@{};Get-ChildItem $journal -Filter '*.json' | ForEach-Object {$snapshots[$_.Name]=[IO.File]::ReadAllText($_.FullName)}
 & (Join-Path $repo 'rch-connector/Aggiorna-Ristampa-RCH.ps1')
 $actual=Get-Content $target -Raw
 if(-not $actual.Contains("'1.9-pos'") -or -not $actual.Contains('Existing POS QR customisation must survive')){throw 'Existing version or POS customisations overwritten'}
 if(-not $actual.Contains("`$request.path -eq '/receipt/reconcile'") -or -not $actual.Contains('reconcileReceipt=$true') -or -not $actual.Contains("`$request.path -eq '/receipt/reprint'")){throw 'Missing route'}
 & (Join-Path $repo 'rch-connector/Aggiorna-Ristampa-RCH.ps1')
 $again=Get-Content $target -Raw
 if(([regex]::Matches($again,'function Reprint-Receipt')).Count -ne 1){throw 'Updater duplicated functions'}
 foreach($name in $snapshots.Keys){if([IO.File]::ReadAllText((Join-Path $journal $name)) -cne $snapshots[$name]){throw 'Pending fiscal journal changed'}}
 Write-Host 'Pending journals preserved verbatim. Updater preserves installed version and POS changes; repeated installation remains valid.'
}finally{Remove-Item $env:LOCALAPPDATA -Recurse -Force;$env:LOCALAPPDATA=$oldLocal}
