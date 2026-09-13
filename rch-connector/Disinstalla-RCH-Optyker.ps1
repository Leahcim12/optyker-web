param([switch]$NoPause,[switch]$LibraryOnly)
$ErrorActionPreference='Stop'
function Remove-OptykerRchAutostart([string]$StartupFolder) {
  if([string]::IsNullOrWhiteSpace($StartupFolder)){throw 'Cartella avvio non disponibile.'}
  $link=Join-Path $StartupFolder 'Optyker RCH.lnk'
  if(Test-Path -LiteralPath $link){Remove-Item -LiteralPath $link -Force}
}
if($LibraryOnly){return}
Remove-OptykerRchAutostart ([Environment]::GetFolderPath('Startup'))
Write-Host 'Avvio automatico Optyker RCH disattivato.'
Write-Host 'Il connettore aperto e i suoi dati sono conservati.'
if(-not $NoPause){$null=Read-Host 'Premi INVIO per chiudere'}
