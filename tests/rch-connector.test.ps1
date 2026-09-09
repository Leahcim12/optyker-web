$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
function Assert-True($condition,[string]$message){if(-not $condition){throw $message}}
$valid='<Service><Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request></Service>'
Assert-True (Parse-Rch $valid).ok 'Complete acknowledgement must parse.'
foreach($field in @('errorCode','printerError','paperEnd','coverOpen','lastCmd','busy')){
  $bad=$valid -replace "<$field>.*?</$field>",''
  Assert-True (-not (Parse-Rch $bad).ok) "Missing $field must not report success."
}
Assert-True (-not (Parse-Rch ($valid -replace '<busy>0','<busy>1')).ok) 'Busy printer must not report ready.'
Assert-True (-not (Parse-Rch ($valid -replace '<paperEnd>0','<paperEnd>1')).ok) 'Paper error must not report ready.'
Assert-True (-not (Parse-Rch '<Service><Request/></Service>').ok) 'Empty response must fail.'
Assert-True (-not (Parse-Rch '<html>OK</html>').ok) 'HTTP 200 HTML must fail.'
Assert-True (-not (Parse-Rch ($valid -replace '<busy>0','<busy>invalid')).ok) 'Invalid integer must fail.'
Assert-True (-not (Parse-Rch ($valid -replace '<busy>0</busy>','<busy>0</busy><busy>0</busy>')).ok) 'Duplicate result must fail.'
$xxe='<!DOCTYPE Service [<!ENTITY external SYSTEM "file:///etc/passwd">]><Service><Request>&external;</Request></Service>'
Assert-True (-not (Parse-Rch $xxe).ok) 'DTD must be rejected.'
$rows=Flatten-RchXml $valid
Assert-True ($rows.Count -eq 6) 'Generic lists must serialize without PowerShell conversion error.'
$body='{"description":"Occhiali più custodia €"}'
$bodyBytes=[System.Text.Encoding]::UTF8.GetBytes($body)
$header="POST /receipt HTTP/1.1`r`nHost: 127.0.0.1:8765`r`nOrigin: https://www.optyker.it`r`nContent-Type: application/json`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
$memory=New-Object System.IO.MemoryStream
$headBytes=[System.Text.Encoding]::ASCII.GetBytes($header)
$memory.Write($headBytes,0,$headBytes.Length);$memory.Write($bodyBytes,0,$bodyBytes.Length);$memory.Position=0
$request=Read-HttpRequest $memory
Assert-True ($request.body -ceq $body) 'UTF-8 request must respect byte length.'
Assert-True (Test-HttpAccess $request) 'Production origin must be allowed.'
$request.headers.origin='https://www.optyker.it.attacker.example'
Assert-True (-not (Test-HttpAccess $request)) 'Origin suffix attack must fail.'
$request.headers.origin='null'
Assert-True (-not (Test-HttpAccess $request)) 'Opaque origin must fail.'
$request.headers.origin='https://optyker.it';$request.headers.host='attacker.example:8765'
Assert-True (-not (Test-HttpAccess $request)) 'DNS rebinding host must fail.'
$request.headers.host='127.0.0.1:8765';$request.headers.Remove('origin')
Assert-True (-not (Test-HttpAccess $request)) 'POST requires origin.'
$request.method='GET'
Assert-True (Test-HttpAccess $request) 'Local Windows diagnostics can read without Origin.'
# Duplicate lengths and truncated multibyte bodies must terminate with an error.
foreach($wire in @("GET /health HTTP/1.1`r`nHost: localhost:8765`r`nContent-Length: 1`r`nContent-Length: 2`r`n`r`nx", "POST /receipt HTTP/1.1`r`nHost: localhost:8765`r`nContent-Length: 20`r`n`r`nx")){
  $bytes=[System.Text.Encoding]::UTF8.GetBytes($wire)
  $stream=New-Object System.IO.MemoryStream(,$bytes)
  $failed=$false
  try {$null=Read-HttpRequest $stream} catch {$failed=$true}
  Assert-True $failed 'Malformed HTTP must fail.'
}
Write-Host 'RCH parser, UTF-8, HTTP and origin checks passed.'

# Real response received from the store's RCH on 2026-09-09, without identifiers.
$refusal=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'fixtures/rch-error-101.xml')
$observed=Parse-Rch $refusal
Assert-True ($observed.rchResponse -and -not $observed.ok -and $observed.errorCode -eq 101) '101 is a reachable RCH, not a ready printer.'
$script:requests=New-Object 'System.Collections.Generic.List[string]'
$script:scenario='fallback'
function Request-Printer([string]$method,[string]$body='') {
  Assert-True ($method -eq 'POST') 'Status queries use POST.'
  $script:requests.Add($body)
  if($script:scenario -eq 'offline'){throw 'Connection refused'}
  if($script:scenario -eq 'busy'){return ($refusal -replace '<busy>0','<busy>1')}
  if($script:scenario -eq 'printer-error'){return ($refusal -replace '<printerError>0','<printerError>2')}
  if($script:scenario -eq 'different-error'){return ($refusal -replace '<errorCode>101','<errorCode>20')}
  if($script:scenario -eq 'refused'){return $refusal}
  if($script:scenario -eq 'fallback' -and $script:requests.Count -eq 1){return $refusal}
  return $valid
}
$report=Diagnostics-Rch
Assert-True ($script:requests.Count -eq 2) '101 should try the second known status syntax once.'
Assert-True ($script:requests[0].Contains('<cmd>&lt;&lt;/?s</cmd>')) 'First query must use the generic RCH status syntax.'
Assert-True ($script:requests[1].Contains('<cmd>&lt;/?i/*4</cmd>')) 'Fallback must use the alternative published status syntax.'
Assert-True ($script:requests[0].Contains("`n<Service>`n")) 'XML envelope must preserve separate lines.'
foreach($xml in $script:requests){
  $doc=Read-SafeXml $xml
  Assert-True ($doc.SelectNodes('/Service/cmd').Count -eq 1) 'Exactly one read command per request.'
  Assert-True ($doc.Service.cmd -cin @('<</?s','</?i/*4')) 'Diagnostics must never send fiscal commands.'
}
Assert-True ($report.printerReached -and $report.statusAccepted -and -not $report.readiness.receipt) 'Accepted status must not enable fiscal printing.'
Assert-True (-not $report.emittedFiscalDocument) 'Diagnostics never issue a fiscal document.'
$script:scenario='accepted';$script:requests.Clear();$report=Diagnostics-Rch
Assert-True ($script:requests.Count -eq 1 -and $report.statusAccepted) 'Successful status must not be repeated.'
$script:scenario='refused';$script:requests.Clear();$report=Diagnostics-Rch
Assert-True ($script:requests.Count -eq 2 -and $report.printerReached -and -not $report.statusAccepted) 'Both 101 responses must remain refused, with reachability recorded.'
foreach($scenario in @('offline','busy','printer-error','different-error')){
  $script:scenario=$scenario;$script:requests.Clear();$report=Diagnostics-Rch
  Assert-True ($script:requests.Count -eq 1 -and -not $report.statusAccepted) "No automatic retry for $scenario."
}
$failed=$false
try {$null=Read-StatusProbe '=C86'} catch {$failed=$true}
Assert-True $failed 'Diagnostics must reject write commands.'
Write-Host 'Real error 101 fixture, compatibility selection and no-retry boundaries passed.'
