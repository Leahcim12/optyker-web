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
