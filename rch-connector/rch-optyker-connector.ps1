param(
  [string]$PrinterIp = '192.168.1.10',
  [int]$Port = 8765,
  [switch]$LibraryOnly
)

$ErrorActionPreference = 'Stop'
$ConnectorVersion = '1.5-status-compatibility'
$printerAddress = $null
if(-not [System.Net.IPAddress]::TryParse($PrinterIp, [ref]$printerAddress) -or $printerAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork){throw 'Indirizzo IPv4 del registratore non valido.'}
$PrinterUrl = "http://$PrinterIp/service.cgi"
$AllowedOrigins = @('https://optyker.it', 'https://www.optyker.it')
$ResponseOrigin = ''

function Read-SafeXml([string]$text) {
  if($text.Length -gt 1048576){throw 'Risposta RCH troppo grande.'}
  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver = $null
  $inputText = New-Object System.IO.StringReader($text)
  $reader = [System.Xml.XmlReader]::Create($inputText, $settings)
  try {
    $doc = New-Object System.Xml.XmlDocument
    $doc.XmlResolver = $null
    $doc.Load($reader)
    return ,$doc
  } finally { $reader.Dispose(); $inputText.Dispose() }
}

function Parse-Rch([string]$xmlText) {
  $out = [ordered]@{ok=$false;rchResponse=$false;errorCode=-1;printerError=-1;paperEnd=-1;coverOpen=-1;lastCmd=-1;busy=-1;raw=$xmlText}
  try {
    $doc = Read-SafeXml $xmlText
    $request = $doc.SelectSingleNode('/Service/Request')
    if($null -eq $request){throw 'Risposta RCH senza esito Request.'}
    $out.rchResponse=$true
    foreach($name in @('errorCode','printerError','paperEnd','coverOpen','lastCmd','busy')){
      $nodes = $request.SelectNodes($name)
      $value = 0
      if($nodes.Count -ne 1 -or -not [int]::TryParse($nodes[0].InnerText,[ref]$value) -or $value -lt 0){throw "Risposta RCH incompleta: $name"}
      $out[$name] = $value
    }
    $out.ok = ($out.errorCode -eq 0 -and $out.printerError -eq 0 -and $out.paperEnd -eq 0 -and $out.coverOpen -eq 0 -and $out.busy -eq 0)
    if(-not $out.ok){$out.error = "RCH: errore $($out.errorCode), stampante $($out.printerError), carta $($out.paperEnd), coperchio $($out.coverOpen), occupata $($out.busy)."}
    $state = $doc.SelectSingleNode('/Service/ECRStatus')
    if($state){
      $out.mode = [string]$state.mode
      $out.idleState = [string]$state.idleState
    }
  } catch { $out.ok=$false; $out.error=$_.Exception.Message }
  return [pscustomobject]$out
}

function Flatten-RchXml([string]$xmlText) {
  $rows = New-Object 'System.Collections.Generic.List[object]'
  try {
    $doc = Read-SafeXml $xmlText
    function Walk-Node($node,[string]$path) {
      $p = if($path){$path+'/'+$node.Name}else{$node.Name}
      $children = @($node.ChildNodes | Where-Object {$_.NodeType -eq [System.Xml.XmlNodeType]::Element})
      if($children.Count -eq 0){$rows.Add([pscustomobject]@{path=$p;value=[string]$node.InnerText})}
      else {foreach($child in $children){Walk-Node $child $p}}
    }
    Walk-Node $doc.DocumentElement ''
  } catch { $rows.Add([pscustomobject]@{path='parseError';value=$_.Exception.Message}) }
  return ,$rows.ToArray()
}

function Request-Printer([string]$method,[string]$body='') {
  $req = [System.Net.HttpWebRequest]::Create($PrinterUrl)
  $req.Method = $method
  $req.AllowAutoRedirect = $false
  $req.Proxy = $null
  $req.ServicePoint.Expect100Continue = $false
  $req.KeepAlive = $false
  $req.SendChunked = $false
  $req.Timeout = 10000
  $req.ReadWriteTimeout = 10000
  if($method -eq 'POST'){
    $req.ContentType = 'application/xml'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    try {$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
  }
  $response = $req.GetResponse()
  try {
    if([int]$response.StatusCode -ne 200){throw "Risposta HTTP RCH $([int]$response.StatusCode)."}
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    try {
      $buffer = New-Object char[] 4096
      $result = New-Object System.Text.StringBuilder
      while(($n = $reader.Read($buffer,0,$buffer.Length)) -gt 0){
        if($result.Length+$n -gt 1048576){throw 'Risposta RCH troppo grande.'}
        [void]$result.Append($buffer,0,$n)
      }
      return $result.ToString()
    } finally {$reader.Dispose()}
  } finally {$response.Dispose()}
}
function Build-RchXml([string]$command) {
  $escaped = [System.Security.SecurityElement]::Escape($command)
  # Match the multiline envelope used by the public RCH client implementation.
  return '<?xml version="1.0" encoding="UTF-8"?>' + "`n<Service>`n  <cmd>" + $escaped + "</cmd>`n</Service>`n"
}
function Send-RchCommand([string]$command) {
  return Request-Printer 'POST' (Build-RchXml $command)
}
function Read-StatusProbe([string]$command) {
  # Only these two independently published status queries may be probed.
  if($command -cnotin @('<</?s','</?i/*4')){throw 'Comando diagnostico non consentito.'}
  $xml=Build-RchXml $command
  try {
    $raw=Request-Printer 'POST' $xml
    $parsed=Parse-Rch $raw
    return [pscustomobject]@{
      label='Stato registratore';command=$command;requestXml=$xml
      httpReached=$true;rchResponse=$parsed.rchResponse;ok=$parsed.ok
      errorCode=$parsed.errorCode;error=$parsed.error
      values=(Flatten-RchXml $raw);raw=$raw;result=$parsed
    }
  } catch {
    return [pscustomobject]@{
      label='Stato registratore';command=$command;requestXml=$xml
      httpReached=$false;rchResponse=$false;ok=$false;errorCode=-1
      error=$_.Exception.Message;values=@();raw=''
      result=[pscustomobject]@{ok=$false;rchResponse=$false;error=$_.Exception.Message}
    }
  }
}
function Get-StatusProbes {
  $probes=New-Object 'System.Collections.Generic.List[object]'
  $first=Read-StatusProbe '<</?s'
  $probes.Add($first)
  # 101 is not reliably documented for every firmware. Try the alternate
  # read-only syntax only on this observed refusal, never after a timeout,
  # a busy/hardware error, or a successful response. No write command is retried.
  if(-not $first.ok -and $first.errorCode -eq 101 -and $first.result.busy -eq 0 -and $first.result.printerError -eq 0 -and $first.result.paperEnd -eq 0 -and $first.result.coverOpen -eq 0){
    $probes.Add((Read-StatusProbe '</?i/*4'))
  }
  return ,$probes.ToArray()
}
function Status-Rch {
  $probes=Get-StatusProbes
  return $probes[$probes.Length-1].result
}
function Drawer-Rch { return Parse-Rch (Send-RchCommand '=C86') }
function GiftReceipt-Rch { return Parse-Rch (Send-RchCommand '=C453/$2') }

function Diagnostics-Rch {
  $probes=Get-StatusProbes
  $reached=@($probes | Where-Object {$_.rchResponse -eq $true}).Count -gt 0
  $accepted=@($probes | Where-Object {$_.ok -eq $true}).Count -gt 0
  return [pscustomobject]@{
    ok=$true;reportGenerated=$true;version=$ConnectorVersion;readOnly=$true
    emittedFiscalDocument=$false;changedProgramming=$false
    printer=$PrinterIp;generatedAt=(Get-Date).ToString('o')
    printerReached=$reached;statusAccepted=$accepted;printerReady=$accepted
    probes=$probes
    readiness=@{receipt=$false;talkingReceipt=$false;adeOutcome='unverified';tsSubmission=$false}
    missing=@('Configurazione reparti IVA e pagamenti verificata sul registratore','Protocollo RCH per codice fiscale e riferimento documento','Accesso e integrazione diretta Sistema TS')
    note='printerReached indica una risposta RCH; statusAccepted indica una richiesta di stato accettata. Nessuno dei due certifica emissione o invio fiscale.'
  }
}

function Read-HttpRequest($stream) {
  $headerBytes = New-Object 'System.Collections.Generic.List[byte]'
  while($true){
    $value = $stream.ReadByte()
    if($value -lt 0){throw 'Richiesta HTTP interrotta.'}
    $headerBytes.Add([byte]$value)
    $n=$headerBytes.Count
    if($n -gt 16384){throw 'Intestazioni troppo grandi.'}
    if($n -ge 4 -and $headerBytes[$n-4] -eq 13 -and $headerBytes[$n-3] -eq 10 -and $headerBytes[$n-2] -eq 13 -and $headerBytes[$n-1] -eq 10){break}
  }
  $lines = [System.Text.Encoding]::ASCII.GetString($headerBytes.ToArray()).Split(@("`r`n"),[System.StringSplitOptions]::None)
  if($lines[0] -notmatch '^(GET|POST|OPTIONS) (/[^ ]*) HTTP/1\.[01]$'){throw 'Richiesta HTTP non valida.'}
  $method=$Matches[1]; $path=$Matches[2].Split('?')[0]
  $headers=@{}
  foreach($line in $lines[1..($lines.Length-1)]){
    if(-not $line){continue}
    if($line -notmatch '^([A-Za-z0-9-]+):[ \t]*(.*)$'){throw 'Intestazione non valida.'}
    $name=$Matches[1].ToLowerInvariant(); $value=$Matches[2].Trim()
    if($headers.ContainsKey($name)){throw 'Intestazione duplicata.'}
    $headers[$name]=$value
  }
  if($headers.ContainsKey('transfer-encoding')){throw 'Transfer-Encoding non supportato.'}
  $length=0
  if($headers.ContainsKey('content-length') -and (-not [int]::TryParse($headers['content-length'],[ref]$length) -or $length -lt 0 -or $length -gt 65536)){throw 'Dimensione richiesta non valida.'}
  $bytes=New-Object byte[] $length
  $offset=0
  while($offset -lt $length){
    $read=$stream.Read($bytes,$offset,$length-$offset)
    if($read -le 0){throw 'Corpo HTTP incompleto.'}
    $offset+=$read
  }
  $encoding=New-Object System.Text.UTF8Encoding($false,$true)
  return [pscustomobject]@{method=$method;path=$path;headers=$headers;body=$encoding.GetString($bytes)}
}
function Test-HttpAccess($request) {
  if($request.headers['host'] -cnotin @("127.0.0.1:$Port","localhost:$Port")){return $false}
  $origin=$request.headers['origin']
  if($origin -and $origin -cnotin $AllowedOrigins){return $false}
  if($request.method -eq 'POST'){
    if(-not $origin -or $request.headers['content-type'] -notmatch '^application/json(?:\s*;.*)?$'){return $false}
  }
  return $true
}
function Json-Response($stream,[int]$status,$obj) {
  $json=ConvertTo-Json -InputObject $obj -Depth 20 -Compress
  $bytes=[System.Text.Encoding]::UTF8.GetBytes($json)
  $headers=New-Object 'System.Collections.Generic.List[string]'
  $headers.Add("HTTP/1.1 $status Response")
  $headers.Add('Content-Type: application/json; charset=utf-8')
  $headers.Add("Content-Length: $($bytes.Length)")
  if($ResponseOrigin){
    $headers.Add("Access-Control-Allow-Origin: $ResponseOrigin")
    $headers.Add('Access-Control-Allow-Methods: GET, POST, OPTIONS')
    $headers.Add('Access-Control-Allow-Headers: Content-Type')
    $headers.Add('Access-Control-Allow-Private-Network: true')
  }
  $headers.Add('Vary: Origin');$headers.Add('Cache-Control: no-store');$headers.Add('Connection: close')
  $head=[System.Text.Encoding]::ASCII.GetBytes(($headers.ToArray() -join "`r`n")+"`r`n`r`n")
  $stream.Write($head,0,$head.Length);$stream.Write($bytes,0,$bytes.Length);$stream.Flush()
}

if($LibraryOnly){return}
$listener=New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback,$Port)
$listener.Start()
Write-Host "Optyker RCH $ConnectorVersion - $PrinterUrl - porta locale $Port"
try {
  while($true){
    $client=$listener.AcceptTcpClient()
    $stream=$null; $ResponseOrigin=''
    try {
      $stream=$client.GetStream(); $stream.ReadTimeout=5000; $stream.WriteTimeout=5000
      $request=Read-HttpRequest $stream
      if(-not (Test-HttpAccess $request)){Json-Response $stream 403 @{ok=$false;error='Richiesta consentita solo da Optyker sul PC della cassa.'};continue}
      $ResponseOrigin=[string]$request.headers['origin']
      if($request.method -eq 'OPTIONS'){Json-Response $stream 200 @{ok=$true};continue}
      if($request.method -eq 'GET' -and $request.path -eq '/health'){
        Json-Response $stream 200 @{ok=$true;connector='Optyker RCH';version=$ConnectorVersion;printer=$PrinterIp;port=$Port;capabilities=@{diagnostics=$true;receipt=$false;talkingReceipt=$false;adeOutcome=$false}}
      } elseif($request.method -eq 'GET' -and $request.path -eq '/status'){
        Json-Response $stream 200 (Status-Rch)
      } elseif($request.method -eq 'GET' -and $request.path -eq '/diagnostics'){
        Json-Response $stream 200 (Diagnostics-Rch)
      } elseif($request.method -eq 'POST' -and $request.path -eq '/receipt'){
        Json-Response $stream 409 @{ok=$false;error='Emissione fiscale non configurata: verificare reparti, pagamenti, codice fiscale e numero documento RCH.';emittedFiscalDocument=$false}
      } elseif($request.method -eq 'POST' -and $request.path -eq '/drawer'){
        Json-Response $stream 200 (Drawer-Rch)
      } elseif($request.method -eq 'POST' -and $request.path -eq '/gift-receipt'){
        Json-Response $stream 200 (GiftReceipt-Rch)
      } else {Json-Response $stream 404 @{ok=$false;error='Endpoint non valido'}}
    } catch {
      try {if($stream){Json-Response $stream 400 @{ok=$false;error=$_.Exception.Message}}} catch {}
    } finally {$client.Close()}
  }
} finally {$listener.Stop()}
