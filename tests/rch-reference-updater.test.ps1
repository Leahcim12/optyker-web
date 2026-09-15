$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$fixture=Get-Content (Join-Path $repo 'rch-connector/rch-optyker-connector.ps1') -Raw
$oldLocal=$env:LOCALAPPDATA
$env:LOCALAPPDATA=Join-Path ([IO.Path]::GetTempPath()) ('rch-reference-update-'+[guid]::NewGuid())
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH';New-Item -ItemType Directory -Path $base -Force | Out-Null
$target=Join-Path $base 'rch-optyker-connector.ps1'
$previous=$fixture
foreach($name in @('OPTYKER_RCH_REFERENCE_V2','OPTYKER_REFERENCE_BEFORE_V2','OPTYKER_REFERENCE_AFTER_V2')){$previous=[regex]::Replace($previous,'(?s)# BEGIN '+$name+'.*?# END '+$name,'')}
$previous=$previous.Replace(';journalReference=$true','').Replace("'1.8-auto-receipt'","'1.9-pos'")
$previous=$previous.Replace('automaticReference=$true;manualReference=$true','automaticReference=$false;manualReference=$true;regSafeReceipt=$true;zeroReceipt=$true')
$previous=[regex]::Replace($previous,'(?s)\s*if\(\$claimed\.document\.automaticReference -eq \$true -and \$operation -eq ''sale''\)\{.*?\r?\n\s*\}',"`r`n      # POS 1.9: legacy marker read disabled",1)
$previous+="`n# Existing POS QR customisation must survive`n"
[IO.File]::WriteAllText($target,$previous)
function Invoke-WebRequest {param([switch]$UseBasicParsing,$Uri,$OutFile) [IO.File]::WriteAllText($OutFile,$fixture)}
function Invoke-RestMethod {param($Uri,$TimeoutSec) return @{ok=$true;printer='192.168.1.10';capabilities=@{journalReference=$true};mode='REG';idleState='0'}}
function Get-CimInstance {param($ClassName) return @()}
function Start-Process {param($FilePath,$ArgumentList,$WindowStyle)}
function Start-Sleep {param($Milliseconds)}
try{
 $journal=Join-Path $base 'receipts';New-Item -ItemType Directory -Path $journal -Force | Out-Null
 foreach($state in @('uncertain','claiming','sending')){[IO.File]::WriteAllText((Join-Path $journal ($state+'.json')),('{"state":"'+$state+'","writeStarted":true}'))}
 $snapshots=@{};Get-ChildItem $journal -Filter '*.json' | ForEach-Object {$snapshots[$_.Name]=[IO.File]::ReadAllText($_.FullName)}
 foreach($attempt in 1..2){
  & (Join-Path $repo 'rch-connector/Aggiorna-Riferimenti-RCH.ps1')
  $actual=Get-Content $target -Raw
  foreach($s in @("'1.9-pos'",'zeroReceipt=$true','automaticReference=$false','Existing POS QR customisation must survive','POS 1.9: legacy marker read disabled','reprintReceipt=$true','journalReference=$true')){if(-not $actual.Contains($s)){throw ('Lost installed customization: '+$s)}}
  foreach($function in @('Start-ReceiptReference','Complete-ReceiptReference','Get-ReceiptEvidence')){if(([regex]::Matches($actual,'function '+$function)).Count -ne 1){throw 'Function missing or duplicated'}}
  foreach($name in $snapshots.Keys){if([IO.File]::ReadAllText((Join-Path $journal $name)) -cne $snapshots[$name]){throw 'Pending journal changed'}}
 }
 Write-Host 'Updater preserves POS, zero, disabled legacy marker, reprint, journals and remains idempotent.'
}finally{Remove-Item $env:LOCALAPPDATA -Recurse -Force;$env:LOCALAPPDATA=$oldLocal}
