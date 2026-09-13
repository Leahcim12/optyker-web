param([string]$PrinterIp='192.168.1.10',[int]$Port=8765,[switch]$NoPause,[switch]$LibraryOnly)
$ErrorActionPreference='Stop'

function Get-OptykerRchStartupPlan([string]$Base,[string]$StartupFolder,[string]$PowerShellPath,[string]$PrinterIp,[int]$Port) {
  $ip=$null
  if(-not [System.Net.IPAddress]::TryParse($PrinterIp,[ref]$ip) -or $ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork){throw 'Indirizzo IPv4 del registratore non valido.'}
  if($Port -lt 1024 -or $Port -gt 65535){throw 'Porta locale non valida.'}
  foreach($path in @($Base,$StartupFolder,$PowerShellPath)){
    if([string]::IsNullOrWhiteSpace($path) -or $path -match '["\r\n]'){throw 'Percorso di avvio non valido.'}
  }
  $connector=Join-Path $Base 'rch-optyker-connector.ps1'
  return [pscustomobject]@{
    Connector=$connector; Link=(Join-Path $StartupFolder 'Optyker RCH.lnk'); Target=$PowerShellPath
    Arguments=('-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -PrinterIp {1} -Port {2}' -f $connector,$ip.ToString(),$Port)
    WorkingDirectory=$Base
  }
}
function New-OptykerRchShortcutShell { return New-Object -ComObject WScript.Shell }
function Set-OptykerRchAutostart([string]$Base,[string]$StartupFolder,[string]$PowerShellPath,[string]$PrinterIp,[int]$Port) {
  $plan=Get-OptykerRchStartupPlan $Base $StartupFolder $PowerShellPath $PrinterIp $Port
  if(-not (Test-Path -LiteralPath $plan.Connector -PathType Leaf)){throw 'Connettore Optyker non installato.'}
  if(-not (Test-Path -LiteralPath $plan.Target -PathType Leaf)){throw 'Windows PowerShell non trovato.'}
  $tokens=$null; $parseErrors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($plan.Connector,[ref]$tokens,[ref]$parseErrors)
  if($parseErrors.Count -gt 0){throw 'Il connettore installato non e valido. Usa Installa / aggiorna connettore.'}
  New-Item -ItemType Directory -Force -Path $StartupFolder | Out-Null
  $shell=New-OptykerRchShortcutShell
  $shortcut=$shell.CreateShortcut($plan.Link)
  $shortcut.TargetPath=$plan.Target; $shortcut.Arguments=$plan.Arguments
  $shortcut.WorkingDirectory=$plan.WorkingDirectory; $shortcut.WindowStyle=7
  $shortcut.Description='Connettore Optyker RCH - avvio automatico all accesso a Windows'
  $shortcut.Save()
  $check=$shell.CreateShortcut($plan.Link)
  if(-not (Test-Path -LiteralPath $plan.Link) -or $check.TargetPath -ine $plan.Target -or $check.Arguments -cne $plan.Arguments){throw 'Impossibile verificare il collegamento di avvio automatico.'}
  # Replaces only this user's shortcut. No process, receipt journal, registry
  # startup approval or machine execution policy is changed.
  return $plan
}
if($LibraryOnly){return}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Esegui questo file sul PC Windows della cassa.'}
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
if(-not (Test-Path -LiteralPath (Join-Path $base 'rch-optyker-connector.ps1') -PathType Leaf)){
  Write-Host 'Installazione iniziale del connettore Optyker RCH...' -ForegroundColor Cyan
  $installer=Join-Path ([System.IO.Path]::GetTempPath()) ('Optyker-RCH-install-'+[guid]::NewGuid().ToString()+'.ps1')
  try {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://www.optyker.it/rch-connector/Installa-RCH-Optyker.ps1?v=20260913-autostart1' -OutFile $installer -TimeoutSec 60
    $tokens=$null; $parseErrors=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($installer,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -gt 0 -or (Get-Content -Raw -LiteralPath $installer) -notmatch 'Set-OptykerRchAutostart'){throw 'Download installazione non valido.'}
    & $installer -PrinterIp $PrinterIp -Port $Port -NoPause
  } finally {if(Test-Path -LiteralPath $installer){Remove-Item -LiteralPath $installer -Force}}
} else {
  $powerShell=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $null=Set-OptykerRchAutostart $base ([Environment]::GetFolderPath('Startup')) $powerShell $PrinterIp $Port
  Write-Host 'Avvio automatico configurato.' -ForegroundColor Green
  Write-Host 'Dal prossimo accesso al tuo utente Windows, il connettore partira in background.'
  Write-Host 'Il connettore gia aperto continua a funzionare.'
}
Write-Host 'Se Windows lo mostra disabilitato: Impostazioni > App > Avvio > Optyker RCH > Attivato.'
if(-not $NoPause){$null=Read-Host 'Premi INVIO per chiudere'}
