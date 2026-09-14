param(
  [string]$PrinterIp = "192.168.1.10",
  [int]$Port = 8765,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
trap {
  $message = if($_.Exception -and $_.Exception.Message){$_.Exception.Message}else{[string]$_}
  Write-Host ""
  Write-Host "ERRORE INSTALLAZIONE OPTYKER RCH" -ForegroundColor Red
  Write-Host $message -ForegroundColor Red
  Write-Host ""
  Write-Host "La finestra resta aperta per permettere di leggere l'errore. Nessuno scontrino viene emesso dall'installazione." -ForegroundColor Yellow
  if(-not $NoPause){$null=Read-Host "Premi INVIO per chiudere"}
  exit 1
}

$base = Join-Path $env:LOCALAPPDATA "OptykerRCH"
$connector = Join-Path $base "rch-optyker-connector.ps1"
$worker = Join-Path $base "rch-optyker-cloud-worker.ps1"
$relayConfig = Join-Path $base 'cloud-relay.json'
$startup = [Environment]::GetFolderPath("Startup")
$startupHelper = Join-Path $base 'Attiva-Avvio-Automatico-RCH.ps1'
$publicRoot = 'https://leahcim12.github.io/optyker-web/rch-connector'
$source = "$publicRoot/rch-optyker-connector.ps1?v=20260914-cloud3"
$workerSource = "$publicRoot/rch-optyker-cloud-worker.ps1?v=20260914-cloud3"
$startupSource = "$publicRoot/Attiva-Avvio-Automatico-RCH.ps1?v=20260914-cloud3"
$relayApi='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api'

New-Item -ItemType Directory -Force -Path $base | Out-Null

$journal = Join-Path $base "receipts"
if(Test-Path -LiteralPath $journal){
  foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json'){
    $j=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
    if($j.state -in @('claiming','sending','uncertain')){throw "Emissione in corso o esito incerto: verificare la cassa prima di aggiornare il connettore."}
  }
}

function Protect-OptykerSecret([string]$value){
  Add-Type -AssemblyName System.Security
  $b=[Text.Encoding]::UTF8.GetBytes($value)
  return [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
}
function New-HexSecret {
  $b=New-Object byte[] 32
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try {$rng.GetBytes($b)} finally {$rng.Dispose()}
  return -join ($b | ForEach-Object {$_.ToString('x2')})
}
function Enroll-CloudRelay {
  if(Test-Path -LiteralPath $relayConfig -PathType Leaf){
    Write-Host "PC cassa gia configurato per il Cloud Relay." -ForegroundColor DarkGreen
    return
  }
  Write-Host ""
  Write-Host "Attivazione collegamento iPad / Cloud Relay" -ForegroundColor Cyan
  Write-Host "Le credenziali servono una sola volta e NON verranno salvate."
  $username=(Read-Host 'Utente Optyker').Trim()
  if(-not $username){throw 'Utente Optyker obbligatorio per attivare il collegamento iPad.'}
  $secure=Read-Host 'Password Optyker' -AsSecureString
  $ptr=[IntPtr]::Zero
  $password=$null
  try {
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if([string]::IsNullOrWhiteSpace($password) -or $password.Length -lt 8){throw 'Password Optyker non valida.'}
    $machineId=[guid]::NewGuid().ToString()
    $secret=New-HexSecret
    $payload=@{action='enroll';username=$username;password=$password;payload=@{machine_id=$machineId;secret=$secret;serial='72IV6003831';connector_version='1.9-cloud-relay'}}
    $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Depth 10 -Compress $payload))
    $r=Invoke-RestMethod -Uri $relayApi -Method Post -ContentType 'application/json' -Body $bytes -TimeoutSec 25 -MaximumRedirection 0
    if($r.ok -ne $true){throw 'Optyker non ha autorizzato questo PC come PC cassa.'}
    $config=@{machine_id=$machineId;secret_protected=(Protect-OptykerSecret $secret);serial='72IV6003831';created_at=(Get-Date).ToString('o')}
    $tmp=$relayConfig+'.tmp'
    [IO.File]::WriteAllText($tmp,(ConvertTo-Json -Compress $config),(New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmp -Destination $relayConfig -Force
    Write-Host 'PC cassa associato. L iPad potra usare la RCH tramite Optyker.' -ForegroundColor Green
  } finally {
    if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
    $password=$null;$secure=$null
  }
}

Write-Host "Installazione Optyker RCH..." -ForegroundColor Cyan
Write-Host "Controllo componenti..." -ForegroundColor DarkGray
$candidate = Join-Path $base "rch-optyker-connector.download.ps1"
$workerCandidate = Join-Path $base "rch-optyker-cloud-worker.download.ps1"
$startupCandidate = Join-Path $base 'Attiva-Avvio-Automatico-RCH.download.ps1'
Invoke-WebRequest -UseBasicParsing -Uri $source -OutFile $candidate -TimeoutSec 60
Invoke-WebRequest -UseBasicParsing -Uri $workerSource -OutFile $workerCandidate -TimeoutSec 60
Invoke-WebRequest -UseBasicParsing -Uri $startupSource -OutFile $startupCandidate -TimeoutSec 60

$startupTokens=$null;$startupErrors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($startupCandidate,[ref]$startupTokens,[ref]$startupErrors)
if($startupErrors.Count -gt 0 -or (Get-Content -Raw -LiteralPath $startupCandidate) -notmatch 'Set-OptykerRchCloudAutostart'){throw 'Download avvio automatico non valido. Installazione sospesa.'}
$tokens=$null;$parseErrors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($candidate,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -gt 0 -or (Get-Content -Raw -LiteralPath $candidate) -notmatch '1\.8-auto-receipt'){throw "Download del connettore locale non valido. La versione precedente e rimasta invariata."}
$workerTokens=$null;$workerErrors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($workerCandidate,[ref]$workerTokens,[ref]$workerErrors)
if($workerErrors.Count -gt 0 -or (Get-Content -Raw -LiteralPath $workerCandidate) -notmatch '1\.9-cloud-relay'){throw 'Download Cloud Relay non valido. Installazione sospesa.'}

Write-Host "Componenti verificati." -ForegroundColor Green
Enroll-CloudRelay

if(Test-Path -LiteralPath $connector){Copy-Item -LiteralPath $connector -Destination ($connector+'.previous') -Force}
if(Test-Path -LiteralPath $worker){Copy-Item -LiteralPath $worker -Destination ($worker+'.previous') -Force}
if(Test-Path -LiteralPath $journal){
  foreach($f in Get-ChildItem -LiteralPath $journal -Filter '*.json'){
    $j=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
    if($j.state -in @('claiming','sending','uncertain')){throw "Emissione in corso: aggiornamento sospeso."}
  }
}
Move-Item -LiteralPath $candidate -Destination $connector -Force
Move-Item -LiteralPath $workerCandidate -Destination $worker -Force
Move-Item -LiteralPath $startupCandidate -Destination $startupHelper -Force

. $startupHelper -LibraryOnly -PrinterIp $PrinterIp -Port $Port -NoPause:$NoPause
$powerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$startupPlan = Set-OptykerRchAutostart $base $startup $powerShell $PrinterIp $Port
$cloudPlan = Set-OptykerRchCloudAutostart $base $startup $powerShell $PrinterIp $Port

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*rch-optyker-connector.ps1*" -or $_.CommandLine -like "*rch-optyker-cloud-worker.ps1*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $startupPlan.Target -ArgumentList $startupPlan.Arguments -WorkingDirectory $base -WindowStyle Hidden
Start-Process -FilePath $cloudPlan.Target -ArgumentList $cloudPlan.Arguments -WorkingDirectory $base -WindowStyle Hidden

Start-Sleep -Seconds 3
try {
  $r = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 4
  if(-not ($r.ok -and $r.version -eq "1.8-auto-receipt")){throw "Health check locale non valido"}
  Write-Host ""
  Write-Host "Installazione completata." -ForegroundColor Green
  Write-Host "PC Windows: collegamento locale attivo."
  Write-Host "iPad: Cloud Relay attivo tramite questo PC."
  Write-Host "Registratore: $PrinterIp"
} catch {
  Write-Host ""
  Write-Host "Installazione completata, ma il test locale non ha risposto subito." -ForegroundColor Yellow
  Write-Host "Riapri Optyker e premi Test collegamento RCH."
}

Write-Host ""
Write-Host "Puoi chiudere questa finestra."
if(-not $NoPause){$null=Read-Host "Premi INVIO per terminare"}
