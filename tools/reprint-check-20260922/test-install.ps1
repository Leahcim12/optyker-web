$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'reprint-match-output/Install-ReprintMatch.ps1') -LibraryOnly
function Assert($v,[string]$m){if(-not $v){throw $m}}
$source=[IO.File]::ReadAllText((Join-Path $root 'rch-connector/rch-optyker-connector.ps1'))
$source=[regex]::Replace($source,"reprintMatchVersion='[a-zA-Z0-9-]+';",'');$source+="`n# POS customization must survive`n"
$old=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path ([IO.Path]::GetTempPath()) ('reprint-install-'+[guid]::NewGuid())
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH';$target=Join-Path $base 'rch-optyker-connector.ps1';$journal=Join-Path $base 'receipts';[void](New-Item -ItemType Directory -Path $journal -Force)
$script:launches=0;$script:busy=$false;$script:badHealth=$false
function Find-ConnectorProcesses($path){return @([pscustomobject]@{ProcessId=123})}
function Stop-Process {param($Id,[switch]$Force,$ErrorAction)}
function Start-InstalledReprintConnector($path,$ip){$script:launches++;return @{Id=456}}
function Start-Sleep {param($Milliseconds)}
function Get-LocalReprintHealth {
 $v=if(-not $script:badHealth -and ([IO.File]::ReadAllText($target)).Contains("reprintMatchVersion='20260922-match1';")){'20260922-match1'}else{''}
 return @{ok=$true;printer='192.168.1.10';capabilities=@{reprintReceipt=$true;reprintMatchVersion=$v}}
}
function Invoke-RestMethod {param($Uri,$Method,$Headers,$TimeoutSec)
 if($Uri -cne 'http://127.0.0.1:8765/status' -or $Method -cne 'Get'){throw 'Installer attempted non-status network request'}
 return @{ok=$true;mode='REG';idleState='0';errorCode=0;printerError=0;paperEnd=0;coverOpen=0;busy=$(if($script:busy){1}else{0})}
}
try{
 foreach($state in @('uncertain','cancelled','completed')){[IO.File]::WriteAllText((Join-Path $journal ($state+'.json')),('{"state":"'+$state+'","secret":"not-to-touch"}'))}
 $before=@{};Get-ChildItem $journal -Filter '*.json' | ForEach-Object {$before[$_.Name]=[IO.File]::ReadAllText($_.FullName)}
 [IO.File]::WriteAllText($target,$source)
 $script:busy=$true;$failed=$false;try{Install-ReprintMatch}catch{$failed=$true};Assert $failed 'Busy printer must block installer';Assert ([IO.File]::ReadAllText($target) -ceq $source) 'Busy installer changed source'
 $script:busy=$false;Install-ReprintMatch
 $done=[IO.File]::ReadAllText($target);Assert ($done.Contains('OPTYKER_REPRINT_MATCH_20260922') -and $done.Contains('POS customization must survive')) 'Patch or POS customization missing'
 Assert ($launches -eq 1) 'Connector not restarted exactly once'
 Install-ReprintMatch;Assert ($launches -eq 1) 'Idempotent install restarted again'
 $backup=@(Get-ChildItem $base -Filter '*.before-reprint-*');Assert ($backup.Count -eq 1) 'Original backup missing';Assert ([IO.File]::ReadAllText($backup[0].FullName) -ceq $source) 'Original backup differs'
 [IO.File]::WriteAllText($target,$source);$script:badHealth=$true;$failed=$false;try{Install-ReprintMatch}catch{$failed=$true};Assert $failed 'Missing health confirmation accepted';Assert ([IO.File]::ReadAllText($target) -ceq $source) 'Failed install did not restore original'
 foreach($name in $before.Keys){Assert ([IO.File]::ReadAllText((Join-Path $journal $name)) -ceq $before[$name]) 'Financial journal modified'}
 Write-Host 'PASS installer syntax, busy refusal, backup, exact source preservation, idempotency, failed-start rollback, journal preservation'
}finally{Remove-Item $env:LOCALAPPDATA -Recurse -Force;$env:LOCALAPPDATA=$old}
