param(
  [string]$PrinterIp='192.168.1.10',
  [int]$Port=8765,
  [switch]$NoPause
)

$ErrorActionPreference='Stop'
$RelayApi='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api'
$WorkerSource='https://raw.githubusercontent.com/Leahcim12/optyker-web/main/rch-connector/rch-optyker-cloud-worker.ps1?20260914-ipad2'
$Base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$Connector=Join-Path $Base 'rch-optyker-connector.ps1'
$Worker=Join-Path $Base 'rch-optyker-cloud-worker.ps1'
$Config=Join-Path $Base 'cloud-relay.json'
$Startup=[Environment]::GetFolderPath('Startup')
$Shortcut=Join-Path $Startup 'Optyker RCH Cloud.lnk'
$PowerShell=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'

trap {
  $m=if($_.Exception -and $_.Exception.Message){$_.Exception.Message}else{[string]$_}
  Write-Host ''
  Write-Host 'ERRORE COLLEGAMENTO IPAD' -ForegroundColor Red
  Write-Host $m -ForegroundColor Red
  Write-Host ''
  Write-Host 'Il connettore fiscale, il diario RCH e gli scontrini NON sono stati modificati.' -ForegroundColor Yellow
  if(-not $NoPause){$null=Read-Host 'Premi INVIO per chiudere'}
  exit 1
}

if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Esegui questo file sul PC Windows della cassa.'}
if(-not (Test-Path -LiteralPath $Connector -PathType Leaf)){throw 'Il connettore RCH locale non risulta installato su questo PC.'}
if(-not (Test-Path -LiteralPath $PowerShell -PathType Leaf)){throw 'Windows PowerShell non trovato.'}
New-Item -ItemType Directory -Force -Path $Base | Out-Null

function New-HexSecret {
  $b=New-Object byte[] 32
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($b)}finally{$rng.Dispose()}
  return -join ($b|ForEach-Object{$_.ToString('x2')})
}
function Protect-Secret([string]$value){
  Add-Type -AssemblyName System.Security
  $b=[System.Text.Encoding]::UTF8.GetBytes($value)
  return [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))
}
function Write-RelayConfig([string]$machine,[string]$secret){
  $obj=@{machine_id=$machine;secret_protected=(Protect-Secret $secret);serial='72IV6003831';created_at=(Get-Date).ToString('o')}
  $tmp=$Config+'.tmp'
  [System.IO.File]::WriteAllText($tmp,(ConvertTo-Json -Compress $obj),(New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $tmp -Destination $Config -Force
}
function Invoke-RelayStaff([string]$action,[string]$username,[string]$password,$payload){
  $body=@{action=$action;username=$username;password=$password;payload=$payload}
  $bytes=[System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Depth 10 -Compress $body))
  try{$r=Invoke-RestMethod -Uri $RelayApi -Method Post -ContentType 'application/json' -Body $bytes -TimeoutSec 25 -MaximumRedirection 0}
  catch{throw 'Accesso Optyker non riuscito o servizio Cloud Relay non raggiungibile.'}
  if($r.ok -ne $true){throw ([string]$r.error)}
  return $r.data
}
function Install-CloudShortcut {
  $args='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -PrinterIp {1} -Port {2}' -f $Worker,$PrinterIp,$Port
  $shell=New-Object -ComObject WScript.Shell
  $s=$shell.CreateShortcut($Shortcut)
  $s.TargetPath=$PowerShell;$s.Arguments=$args;$s.WorkingDirectory=$Base;$s.WindowStyle=7;$s.Description='Optyker RCH Cloud Relay - collegamento iPad';$s.Save()
  if(-not (Test-Path -LiteralPath $Shortcut -PathType Leaf)){throw 'Impossibile creare l avvio automatico del Cloud Relay.'}
  return $args
}
function Stop-OldRelay {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object {$_.CommandLine -like '*rch-optyker-cloud-worker.ps1*'} |
    ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
}

Write-Host 'Optyker RCH - riparazione collegamento iPad' -ForegroundColor Cyan
Write-Host 'Il connettore fiscale locale non verra aggiornato, fermato o riavviato.' -ForegroundColor Yellow
Write-Host 'Gli eventuali esiti fiscali incerti restano protetti.' -ForegroundColor Yellow
Write-Host ''

Write-Host 'Download nuovo Cloud Relay...' -ForegroundColor Cyan
$candidate=Join-Path $Base 'rch-optyker-cloud-worker.download.ps1'
Invoke-WebRequest -UseBasicParsing -Uri $WorkerSource -OutFile $candidate -TimeoutSec 60
$tokens=$null;$errors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($candidate,[ref]$tokens,[ref]$errors)
if($errors.Count -gt 0 -or (Get-Content -Raw -LiteralPath $candidate) -notmatch '2\.0-cloud-relay-http'){throw 'Download Cloud Relay non valido.'}
Write-Host 'Cloud Relay 2.0 verificato.' -ForegroundColor Green

if(-not (Test-Path -LiteralPath $Config -PathType Leaf)){
  Write-Host ''
  Write-Host 'Prima associazione del PC cassa' -ForegroundColor Cyan
  Write-Host 'Inserisci le credenziali Optyker una sola volta. Non verranno salvate.'
  $username=(Read-Host 'Utente Optyker').Trim()
  if(-not $username){throw 'Utente Optyker obbligatorio.'}
  $secure=Read-Host 'Password Optyker' -AsSecureString
  $ptr=[IntPtr]::Zero;$password=$null
  try{
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if([string]::IsNullOrWhiteSpace($password) -or $password.Length -lt 8){throw 'Password Optyker non valida.'}
    $machine=[guid]::NewGuid().ToString();$secret=New-HexSecret
    $null=Invoke-RelayStaff 'enroll' $username $password @{machine_id=$machine;secret=$secret;serial='72IV6003831';connector_version='enrolling-ipad-relay-2.0'}
    Write-RelayConfig $machine $secret
    Write-Host 'PC cassa associato.' -ForegroundColor Green
  }finally{
    if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
    $password=$null;$secure=$null
  }
}else{
  Write-Host 'Associazione PC cassa gia presente: la riutilizzo senza chiedere credenziali.' -ForegroundColor DarkGreen
}

Stop-OldRelay
if(Test-Path -LiteralPath $Worker -PathType Leaf){Copy-Item -LiteralPath $Worker -Destination ($Worker+'.previous') -Force}
Move-Item -LiteralPath $candidate -Destination $Worker -Force
$arguments=Install-CloudShortcut

Write-Host 'Test reale Cloud Relay...' -ForegroundColor Cyan
& $PowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Worker -PrinterIp $PrinterIp -Port $Port -Once
if($LASTEXITCODE -ne 0){throw 'Il test Cloud Relay non e riuscito. Vedi il messaggio sopra.'}
Write-Host 'Polling cloud confermato.' -ForegroundColor Green

Start-Process -FilePath $PowerShell -ArgumentList $arguments -WorkingDirectory $Base -WindowStyle Hidden
Start-Sleep -Seconds 2
$running=@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*rch-optyker-cloud-worker.ps1*'}).Count -gt 0
if(-not $running){throw 'Il Cloud Relay non resta in esecuzione. Riprova e inviami la schermata.'}

Write-Host ''
Write-Host 'COLLEGAMENTO IPAD ATTIVO' -ForegroundColor Green
Write-Host 'Il PC sta comunicando realmente con il Cloud Relay.' -ForegroundColor Green
Write-Host 'Avvio automatico configurato.' -ForegroundColor Green
Write-Host 'Ora chiudi e riapri Optyker sull iPad e apri Cassa.' -ForegroundColor Cyan
Write-Host 'Nota: eventuali blocchi fiscali incerti restano attivi e separati dal collegamento iPad.' -ForegroundColor Yellow

if(-not $NoPause){$null=Read-Host 'Premi INVIO per terminare'}
