$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$batch=Get-Content (Join-Path $repo 'rch-connector/Correggi-Ristampa-Giornale.bat') -Raw
$marker=':: OVC_REPRINT_PATCH_BASE64'
$payload=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($batch.Substring($batch.LastIndexOf($marker)+$marker.Length).Trim()))
$env:OPTYKER_REPRINT_PATCH_LIBRARY_ONLY='1'
. ([scriptblock]::Create($payload))
$env:OPTYKER_REPRINT_PATCH_LIBRARY_ONLY=$null
$fixture=Get-Content (Join-Path $repo 'rch-connector/rch-optyker-connector.ps1') -Raw
$previous=$fixture.Replace("'1.8-auto-receipt'","'2.0-mixed-safe'")+"`n# Installed POS QR customisation`n"
$expected=Get-PatchedReprintSource $previous
if((Get-PatchedReprintSource $expected) -cne $expected){throw 'Patch is not idempotent'}
if(-not $expected.Contains("'2.0-mixed-safe'") -or -not $expected.Contains('Installed POS QR customisation')){throw 'Existing connector features overwritten'}
$start=$previous.IndexOf('function Emit-Receipt(');$end=$previous.IndexOf('# BEGIN OPTYKER_RCH_REPRINT_V1')
if(-not $expected.Contains($previous.Substring($start,$end-$start))){throw 'Emission implementation changed'}
$invalid=$false;try{Get-PatchedReprintSource 'function Other {}' | Out-Null}catch{$invalid=$true};if(-not $invalid){throw 'Unknown connector accepted'}
$oldLocal=$env:LOCALAPPDATA
$env:LOCALAPPDATA=Join-Path ([IO.Path]::GetTempPath()) ('reprint-patch-test-'+[guid]::NewGuid())
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$journal=Join-Path $base 'receipts'
New-Item -ItemType Directory -Path $journal -Force | Out-Null
$target=Join-Path $base 'rch-optyker-connector.ps1'
[IO.File]::WriteAllText($target,$previous)
[IO.File]::WriteAllText((Join-Path $journal 'pending.json'),'{"state":"uncertain","error":"preserve evidence"}')
$script:busy=1
function Invoke-RestMethod {param($Uri,$TimeoutSec)
  if($Uri.EndsWith('/health')){return @{ok=$true;printer='192.168.1.10';capabilities=@{reprintReceipt=$true;reprintJournalV2=([IO.File]::ReadAllText($target).Contains('reprintJournalV2=$true;'))}}}
  return @{ok=$true;mode='REG';idleState='0';busy=$script:busy;errorCode=0;printerError=0;paperEnd=0;coverOpen=0}
}
function Get-CimInstance {param($ClassName) return @()}
function Start-Process {param($FilePath,$ArgumentList,$WindowStyle)}
function Start-Sleep {param($Milliseconds)}
try {
  $blocked=$false;try{Install-ReprintJournalPatch}catch{$blocked=$true}
  if(-not $blocked -or [IO.File]::ReadAllText($target) -cne $previous){throw 'Busy printer did not block update'}
  $script:busy=0
  Install-ReprintJournalPatch
  if([IO.File]::ReadAllText($target) -cne $expected){throw 'Installed content differs from validated patch'}
  $backups=@(Get-ChildItem $base -Filter '*.prima-ristampa-giornale-*')
  if($backups.Count -ne 1 -or [IO.File]::ReadAllText($backups[0].FullName) -cne $previous){throw 'Original connector backup missing'}
  if([IO.File]::ReadAllText((Join-Path $journal 'pending.json')) -cne '{"state":"uncertain","error":"preserve evidence"}'){throw 'Fiscal journal changed'}
  Install-ReprintJournalPatch
  if(@(Get-ChildItem $base -Filter '*.prima-ristampa-giornale-*').Count -ne 1){throw 'Repeated install must be a no-op'}
  Write-Host 'Updater checks passed: busy guard, backup, idempotence, emission and pending journal preserved.'
} finally {Remove-Item $env:LOCALAPPDATA -Recurse -Force;$env:LOCALAPPDATA=$oldLocal}
