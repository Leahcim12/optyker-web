$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'rch-connector/Attiva-Avvio-Automatico-RCH.ps1') -LibraryOnly
. (Join-Path $root 'rch-connector/Disinstalla-RCH-Optyker.ps1') -LibraryOnly
function Assert($condition,[string]$message){if(-not $condition){throw $message}}
function Assert-Throws([scriptblock]$action){$failed=$false; try {& $action | Out-Null} catch {$failed=$true}; Assert $failed 'Expected operation to fail'}

# A real shortcut requires Windows COM. Mock that boundary only; use real files,
# paths and PowerShell's parser for activation and removal logic.
$script:savedShortcuts=@{}
$script:corruptReadback=$false
function New-OptykerRchShortcutShell {
  $shell=[pscustomobject]@{}
  $shell | Add-Member ScriptMethod CreateShortcut {
    param($path)
    if($script:savedShortcuts.ContainsKey($path)){
      $result=$script:savedShortcuts[$path]
      if($script:corruptReadback){$result.Arguments='unexpected arguments'}
      return $result
    }
    $link=[pscustomobject]@{Path=$path;TargetPath='';Arguments='';WorkingDirectory='';WindowStyle=0;Description=''}
    $link | Add-Member ScriptMethod Save {
      [IO.File]::WriteAllText($this.Path,$this.TargetPath+"`n"+$this.Arguments)
      $script:savedShortcuts[$this.Path]=$this
    }
    return $link
  }
  return $shell
}
function Start-Process {throw 'Autostart activation must not start a process'}
function Stop-Process {throw 'Autostart activation must not stop a process'}
function Invoke-WebRequest {throw 'Existing installation must not need a download'}
$temp=Join-Path ([IO.Path]::GetTempPath()) ('optyker-autostart-test-'+[guid]::NewGuid())
try {
  $base=Join-Path $temp "User's App Data/OptykerRCH"
  $startup=Join-Path $temp 'Startup folder'
  New-Item -ItemType Directory -Path (Join-Path $base 'receipts') -Force | Out-Null
  $connector=Join-Path $base 'rch-optyker-connector.ps1'
  [IO.File]::WriteAllText($connector,'param([string]$PrinterIp,[int]$Port)')
  $exe=Join-Path $temp 'Windows PowerShell.exe'
  [IO.File]::WriteAllText($exe,'fixture executable')
  $journal=Join-Path $base 'receipts/receipt.json'
  [IO.File]::WriteAllText($journal,'{"state":"uncertain","document":"1161-0009"}')
  $originalJournal=[IO.File]::ReadAllText($journal)
  $plan=Set-OptykerRchAutostart $base $startup $exe '192.168.1.20' 8876
  Assert ($plan.Arguments.Contains('-File "'+$connector+'"')) 'Connector path must remain one quoted argument'
  Assert ($plan.Arguments.EndsWith('-PrinterIp 192.168.1.20 -Port 8876')) 'Custom connection parameters must be retained'
  Assert ($plan.Target -eq $exe) 'Startup must invoke PowerShell directly'
  Assert ($plan.WorkingDirectory -eq $base) 'Startup working directory must be the installed directory'
  $again=Set-OptykerRchAutostart $base $startup $exe '192.168.1.20' 8876
  Assert ($again.Link -eq $plan.Link) 'Repeated activation must reuse the shortcut'
  Assert (@(Get-ChildItem -LiteralPath $startup).Count -eq 1) 'Repeated activation must not create duplicates'
  Assert ([IO.File]::ReadAllText($journal) -eq $originalJournal) 'Activation must preserve even uncertain receipt records'
  Assert-Throws {Set-OptykerRchAutostart $base $startup $exe '192.168.1.20; evil' 8876}
  Assert-Throws {Set-OptykerRchAutostart $base $startup $exe '192.168.1.20' 65536}
  Assert-Throws {Set-OptykerRchAutostart $base $startup (Join-Path $temp 'missing.exe') '192.168.1.20' 8876}
  [IO.File]::WriteAllText($connector,'function Broken {')
  Assert-Throws {Set-OptykerRchAutostart $base $startup $exe '192.168.1.20' 8876}
  [IO.File]::WriteAllText($connector,'param([string]$PrinterIp,[int]$Port)')
  $script:corruptReadback=$true
  Assert-Throws {Set-OptykerRchAutostart $base $startup $exe '192.168.1.20' 8876}
  $script:corruptReadback=$false
  Remove-OptykerRchAutostart $startup
  Remove-OptykerRchAutostart $startup
  Assert (-not (Test-Path -LiteralPath $plan.Link)) 'Removal must delete the startup shortcut'
  Assert (Test-Path -LiteralPath $connector) 'Removal must preserve the installed connector'
  Assert ([IO.File]::ReadAllText($journal) -eq $originalJournal) 'Removal must preserve receipt records'
  foreach($file in @('Attiva-Avvio-Automatico-RCH.ps1','Installa-RCH-Optyker.ps1','Disinstalla-RCH-Optyker.ps1')){
    $tokens=$null; $errors=$null
    [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $root ('rch-connector/'+$file)),[ref]$tokens,[ref]$errors)
    Assert ($errors.Count -eq 0) ('Invalid script: '+$file)
  }
  # Dot-sourcing must not reset the installer's custom IP, port or NoPause.
  $PrinterIp='192.168.1.21'; $Port=8877; $NoPause=$true
  . (Join-Path $root 'rch-connector/Attiva-Avvio-Automatico-RCH.ps1') -LibraryOnly -PrinterIp $PrinterIp -Port $Port -NoPause:$NoPause
  Assert ($PrinterIp -eq '192.168.1.21' -and $Port -eq 8877 -and $NoPause) 'Helper import must retain installer parameters'
  Write-Host 'PASS: startup activation, idempotency, custom settings, validation, removal, data preservation and script syntax'
} finally {if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Recurse -Force}}
