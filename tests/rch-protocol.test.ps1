$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/Diagnostica-Protocollo-RCH.ps1') -LibraryOnly
function Assert-True($condition,[string]$message){if(-not $condition){throw $message}}
$valid='<Service><Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request><ECRStatus><mode>Z</mode><idleState>0</idleState></ECRStatus></Service>'
$script:scenario='success'
$script:commands=New-Object 'System.Collections.Generic.List[string]'
function Request-Printer([string]$method,[string]$body='') {
  Assert-True ($method -ceq 'POST') 'Queries use the established HTTP POST envelope.'
  $doc=Read-SafeXml $body
  Assert-True ($doc.SelectNodes('/Service/cmd').Count -eq 1) 'Exactly one command per request.'
  $script:commands.Add([string]$doc.Service.cmd)
  if($script:scenario -eq 'offline'){throw 'Simulated timeout'}
  if($script:scenario -eq 'paper'){return ($valid -replace '<paperEnd>0','<paperEnd>1')}
  if($script:scenario -eq 'busy'){return ($valid -replace '<busy>0','<busy>1')}
  if($script:scenario -eq 'open'){return ($valid -replace '<idleState>0','<idleState>1')}
  if($script:scenario -eq 'unknown'){return ($valid -replace '<mode>Z','<mode>OTHER')}
  if($script:scenario -eq 'missing'){return ($valid -replace '<ECRStatus>.*?</ECRStatus>','')}
  if($script:scenario -eq 'zero-last'){return ($valid -replace '<lastCmd>1','<lastCmd>0')}
  if($script:scenario -eq 'refused' -and $script:commands.Count -eq 2){return ($valid -replace '<errorCode>0','<errorCode>101')}
  if($script:scenario -eq 'concurrent' -and $script:commands.Count -eq 3){return ($valid -replace '<idleState>0','<idleState>2')}
  if($script:scenario -eq 'doctype'){return '<!DOCTYPE Service [<!ENTITY x SYSTEM "file:///nonexistent">]><Service>&x;</Service>'}
  # Deliberately return only generic state, not invented firmware/serial XML.
  return $valid
}

Assert-True ($script:commands.Count -eq 0) 'Import must not query printer or start a server.'
$report=Get-ProtocolDiagnostic
Assert-True ($report.allQueriesAccepted -and $report.queriesAttempted -eq 7) 'All seven read queries run once.'
$expected=@('<</?s','<</?f','<</?m','<</?i/*3','<</?d','<</?7','<</?i/*5')
Assert-True (($script:commands.ToArray() -join '|') -ceq ($expected -join '|')) 'Only the manufacturer-documented allowlist may run.'
Assert-True (-not $report.compatibilityVerified) 'Acknowledgements without firmware data cannot verify compatibility.'
Assert-True (-not $report.fiscalEmissionEnabled -and -not $report.emittedFiscalDocument -and -not $report.changedMode -and -not $report.changedProgramming -and -not $report.tsSubmitted) 'Diagnostics must not enable or claim fiscal changes.'
Assert-True ($report.probes[1].raw -ceq $valid -and $report.probes[1].values.Count -eq 8) 'Keep original responses and XML leaf values for review.'
foreach($scenario in @('offline','paper','busy','open','unknown','missing','zero-last','doctype')){
  $script:scenario=$scenario;$script:commands.Clear();$bad=Get-ProtocolDiagnostic
  Assert-True ($script:commands.Count -eq 1 -and $bad.stoppedAt -ceq 'status' -and -not $bad.allQueriesAccepted) "Stop immediately for $scenario without retries."
  Assert-True $bad.reportGenerated 'An incomplete diagnostic still produces a report.'
}
$script:scenario='refused';$script:commands.Clear();$bad=Get-ProtocolDiagnostic
Assert-True ($script:commands.Count -eq 2 -and $bad.stoppedAt -ceq 'firmware') 'Firmware refusal stops without fallback or repeated commands.'
$script:scenario='concurrent';$script:commands.Clear();$bad=Get-ProtocolDiagnostic
Assert-True ($script:commands.Count -eq 3 -and $bad.stoppedAt -ceq 'serial') 'Concurrent receipt activity stops further queries.'
foreach($command in @('=C86','=C1','=T1','=R1/$100','>>/?V/$0/*400','<</?C','<</?F','<</?f <</?m','<</?s`n=T1')){
  $script:commands.Clear();$failed=$false
  try {$null=Read-ProtocolQuery $command} catch {$failed=$true}
  Assert-True ($failed -and $script:commands.Count -eq 0) "Reject non-allowlisted command: $command"
}
foreach($mode in @('R','REG','REG (OP 1)','X','Z','P','PRG','S','SERVICE')){
  Assert-True (Test-ProtocolIdle (Parse-Rch ($valid -replace '<mode>Z',('<mode>'+$mode)))) 'Documented idle modes can be read without changing mode.'
}
$directory=Join-Path ([System.IO.Path]::GetTempPath()) ('optyker-protocol-test-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $directory
try {
  $first=Save-ProtocolDiagnostic $report $directory
  $second=Save-ProtocolDiagnostic $bad $directory
  Assert-True ($first -cne $second) 'Reports must not overwrite previous evidence.'
  $saved=Get-Content -Raw -LiteralPath $first | ConvertFrom-Json
  Assert-True ($saved.probes.Count -eq 7 -and -not $saved.compatibilityVerified) 'Saved JSON preserves evidence and readiness boundaries.'
} finally {Remove-Item -LiteralPath $directory -Recurse -Force}
Write-Host 'PASS: read-only allowlist, no-retry, busy/open/unknown/XXE guards, evidence and report persistence.'
