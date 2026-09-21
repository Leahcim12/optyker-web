# Real HttpWebRequest transport to a loopback fixture, not a mocked command sender.
# Load the EXACT script embedded in the downloadable BAT, without running main.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$out=Join-Path $root 'rch-pending-v3-check'
$bat=[IO.File]::ReadAllText((Join-Path $out 'Optyker-Verifica-Giornale-V3.bat'))
$marker='# OPTYKER_PS_BEGIN'
$code=$bat.Substring($bat.LastIndexOf($marker)+$marker.Length).TrimStart("`r","`n")
$standalone=[IO.File]::ReadAllText((Join-Path $out 'Verifica-Giornale-V3.ps1'))
if($code.Replace("`r`n","`n") -cne $standalone.Replace("`r`n","`n")){throw 'BAT payload differs from tested PS1'}
$tok=$null;$err=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($code,[ref]$tok,[ref]$err)
if($err.Count){throw ($err|Out-String)}
. ([scriptblock]::Create($code)) -LibraryOnly
function Assert($ok,[string]$message){if(-not $ok){throw $message}}
$script:OriginalFactory=(Get-Item Function:New-DiagnosticHttpRequest).ScriptBlock
$temp=Join-Path $env:TEMP ('rch-http-test-'+[guid]::NewGuid().ToString('N'))
$journal=Join-Path $temp 'receipts';[void](New-Item -ItemType Directory -Path $journal)
[IO.File]::WriteAllText((Join-Path $journal 'printer.lock'),'')
$entry=Join-Path $journal ($TargetJobIds[0]+'.json')
$original=@{jobId=$TargetJobIds[0];state='uncertain';operation='sale';writeStarted=$true;commandsAcknowledged=0;cloudSaved=$true;error='PRIVATE_ERROR';protectedResultToken='NEVER_EXPORT_TOKEN';password='NEVER_EXPORT_PASSWORD';fiscalCode='RSSMRA80A01H501U'}|ConvertTo-Json
[IO.File]::WriteAllText($entry,$original);[IO.File]::WriteAllText(($entry+'.previous'),$original)
$portFile=Join-Path $temp 'port.txt'
$fixture=Join-Path $PSScriptRoot 'rch-diagnostic-http-server.py'
$process=Start-Process -FilePath 'python' -ArgumentList @(('"'+$fixture+'"'),('"'+$portFile+'"')) -PassThru -WindowStyle Hidden
try {
  for($i=0;$i -lt 100 -and -not (Test-Path $portFile);$i++){Start-Sleep -Milliseconds 100}
  Assert (Test-Path $portFile) 'Loopback fixture did not start'
  $script:FixturePort=[int][IO.File]::ReadAllText($portFile)
  # TEST ONLY address substitution. All configuration/stream operations stay real.
  function New-DiagnosticHttpRequest([string]$url,[string]$method){
    $u=[uri]$url
    if($u.AbsolutePath -cnotin @('/health','/service.cgi')){throw 'Unexpected diagnostic path'}
    if($u.Host -cnotin @('127.0.0.1','192.168.1.10')){throw 'Unexpected diagnostic host'}
    return & $script:OriginalFactory ('http://127.0.0.1:'+$script:FixturePort+$u.AbsolutePath) $method
  }
  function Control([string]$path){
    $r=& $script:OriginalFactory ('http://127.0.0.1:'+$script:FixturePort+$path) 'GET'
    return (Read-LimitedHttp $r | ConvertFrom-Json)
  }
  # Reproduce the exact V2 Proxy exception in Windows PowerShell 5/.NET Framework.
  $legacy=[IO.File]::ReadAllText((Join-Path $root 'rch-pending-v2-check/Verifica-Giornale-V2.ps1'))
  $legacyAst=[Management.Automation.Language.Parser]::ParseInput($legacy,[ref]$tok,[ref]$err)
  $fn=$legacyAst.Find({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -ceq 'Read-LimitedHttp'},$true)
  $body=$fn.Body.Extent.Text
  $oldRead=[scriptblock]::Create('param($request)'+"`n"+$body.Substring(1,$body.Length-2))
  [void](Control '/reset?scenario=normal')
  $req=New-DiagnosticHttpRequest 'http://192.168.1.10/service.cgi' 'POST'
  $bytes=[Text.Encoding]::UTF8.GetBytes('<Service><cmd>&lt;&lt;/?s</cmd></Service>')
  $req.ContentType='application/xml';$req.ContentLength=$bytes.Length
  $stream=$req.GetRequestStream();try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  $reproduced=$false
  try{[void](& $oldRead $req)}catch{$reproduced=($_.Exception.Message -match 'Proxy')}finally{$req.Abort()}
  if($PSVersionTable.PSEdition -eq 'Desktop'){Assert $reproduced 'V2 Proxy failure was not reproduced on .NET Framework'}
  Write-Host ('V2_PROXY_REPRODUCED='+$reproduced+' runtime='+$PSVersionTable.PSVersion)
  $results=@()
  foreach($scenario in @('normal','headerOnly','noEJ','busy','wrongSerial','dayFails','oversized','restoreFails','redirect')){
    [void](Control ('/reset?scenario='+$scenario))
    $report=Get-PendingDiagnostic $temp
    $network=Control '/report'
    $json=ConvertTo-Json -InputObject $report -Depth 12
    Assert (-not $report.emittedFiscalDocument -and -not $report.changedPayments -and -not $report.changedJournal -and -not $report.dailyClosureExecuted) 'Financial write reported'
    Assert ([IO.File]::ReadAllText($entry) -ceq $original) 'Journal modified'
    Assert ([IO.File]::ReadAllText(($entry+'.previous')) -ceq $original) 'Previous journal modified'
    Assert ($json -notmatch 'NEVER_EXPORT_TOKEN|NEVER_EXPORT_PASSWORD|PRIVATE_ERROR|PRIVATE CUSTOMER|RSSMRA80A01H501U') 'Private content leaked'
    Assert (-not ($network.commands | Where-Object {$_ -cnotin @('<</?s','<</?m','<</?d','<</?7','=C3','=C453/$0','=C451/$0/&210926/[210926','=C1')})) 'Non-read command reached HTTP'
    Assert (-not ($network.requests | Where-Object {$_ -notin @('GET /health','POST /service.cgi')})) 'Unexpected HTTP path or redirect followed'
    if($scenario -in @('normal','headerOnly','noEJ')){
      Assert $report.collectionCompleted ('HTTP collection failed: '+$report.stopReason)
      Assert ($report.regRestored -eq $true -and $network.reg) 'REG not restored'
      Assert ($network.commands.Count -eq 10) ('Unexpected request count: '+$network.commands.Count)
      Assert ($report.dailyJournal.absenceOfReceiptProven -eq $false) 'Absence must never authorize reprinting'
      if($scenario -eq 'noEJ'){Assert ($report.dailyJournal.ejNodes -eq 0 -and $report.warnings.Count -gt 0) 'Missing journal hidden'}
      else{Assert ($report.dailyJournal.totalCents -eq 5500) 'Daily total not parsed'}
    }elseif($scenario -in @('busy','wrongSerial','redirect')){
      Assert (-not $report.collectionCompleted -and -not $report.transientReadModeAttempted) 'Unsafe read mode switch'
      Assert (-not ($network.commands -contains '=C3')) 'Mode changed despite failed precheck'
    }elseif($scenario -eq 'restoreFails'){
      Assert (-not $report.collectionCompleted -and $report.regRestored -eq $false) 'REG recovery failure hidden'
    }else{
      Assert (-not $report.collectionCompleted -and $report.regRestored -eq $true) 'Read failure did not restore REG'
      Assert ($network.commands -contains '=C1') 'No REG recovery request'
    }
    $results+=@{scenario=$scenario;passed=$true;actualHttp=$true;requests=$network.requests.Count;realPrinterContacted=$false}
    Write-Host ('PASS_REAL_HTTP '+$scenario+' runtime='+$PSVersionTable.PSVersion)
  }
  foreach($command in @('=C10','=T1','=C453/$1','=C453/$2','=C450/$0','=C451/$0/&010100/[210926')){
    $denied=$false;try{Invoke-RchReadCommand $command}catch{$denied=$true}
    Assert $denied ('Forbidden command allowed: '+$command)
  }
  $version=$PSVersionTable.PSVersion.Major
  [IO.File]::WriteAllText((Join-Path $out ('http-test-powershell-'+$version+'.json')),(ConvertTo-Json -Depth 8 -InputObject @{runtime=[string]$PSVersionTable.PSVersion;v2ProxyReproduced=$reproduced;results=$results;productionDataChanged=$false;realPrinterContacted=$false}))
  Write-Host 'EXACT BAT PAYLOAD PASSED REAL LOOPBACK HTTP TESTS. NO REAL PRINTER CONTACTED.'
} finally {
  if($process -and -not $process.HasExited){Stop-Process -Id $process.Id -Force}
  Remove-Item -LiteralPath $temp -Recurse -Force
}
