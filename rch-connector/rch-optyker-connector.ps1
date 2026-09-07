param(
  [string]$PrinterIp = "192.168.1.10",
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$PrinterUrl = "http://$PrinterIp/service.cgi"

function Json-Response([System.Net.Sockets.NetworkStream]$stream, [int]$status, $obj) {
  $json = $obj | ConvertTo-Json -Depth 12 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $statusText = if ($status -eq 200) {"OK"} elseif ($status -eq 400) {"Bad Request"} else {"Internal Server Error"}
  $nl = [Environment]::NewLine
  $headers = @(
    "HTTP/1.1 $status $statusText",
    "Content-Type: application/json; charset=utf-8",
    "Content-Length: $($bytes.Length)",
    "Access-Control-Allow-Origin: *",
    "Access-Control-Allow-Methods: GET, POST, OPTIONS",
    "Access-Control-Allow-Headers: Content-Type",
    "Access-Control-Allow-Private-Network: true",
    "Cache-Control: no-store",
    "Connection: close",
    "",
    ""
  ) -join $nl
  $hb = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($hb,0,$hb.Length)
  if($bytes.Length){$stream.Write($bytes,0,$bytes.Length)}
  $stream.Flush()
}

function Parse-Rch([string]$xmlText) {
  $out = [ordered]@{ ok=$false; errorCode=-1; printerError=-1; paperEnd=-1; coverOpen=-1; lastCmd=-1; busy=-1; raw=$xmlText }
  try {
    [xml]$x = $xmlText
    $r = $x.Service.Request
    if($r){
      $out.errorCode = [int]$r.errorCode
      $out.printerError = [int]$r.printerError
      $out.paperEnd = [int]$r.paperEnd
      $out.coverOpen = [int]$r.coverOpen
      $out.lastCmd = [int]$r.lastCmd
      $out.busy = [int]$r.busy
      $out.ok = ($out.errorCode -eq 0 -and $out.printerError -eq 0 -and $out.paperEnd -eq 0 -and $out.coverOpen -eq 0 -and $out.busy -eq 0)
    }
    if($x.Service.ECRStatus){
      $out.mode = [string]$x.Service.ECRStatus.mode
      $out.idleState = [string]$x.Service.ECRStatus.idleState
    }
  } catch {
    $out.parseError = $_.Exception.Message
  }
  return [pscustomobject]$out
}

function Flatten-RchXml([string]$xmlText) {
  $rows = New-Object System.Collections.Generic.List[object]
  try {
    [xml]$x = $xmlText
    function Walk-Node($node,[string]$path) {
      if($null -eq $node){return}
      if($node.NodeType -eq [System.Xml.XmlNodeType]::Element){
        $p = if($path){$path + "/" + $node.Name}else{$node.Name}
        $elements = @($node.ChildNodes | Where-Object { $_.NodeType -eq [System.Xml.XmlNodeType]::Element })
        if($elements.Count -eq 0){
          $rows.Add([pscustomobject]@{path=$p;value=[string]$node.InnerText})
        } else {
          foreach($c in $elements){Walk-Node $c $p}
        }
      }
    }
    Walk-Node $x.DocumentElement ""
  } catch {
    $rows.Add([pscustomobject]@{path="parseError";value=$_.Exception.Message})
  }
  return @($rows)
}

function Send-Rch([string]$xmlBody) {
  $req = [System.Net.HttpWebRequest]::Create($PrinterUrl)
  $req.Method = "POST"
  $req.ContentType = "application/xml"
  $req.Timeout = 10000
  $req.ReadWriteTimeout = 10000
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($xmlBody)
  $req.ContentLength = $bytes.Length
  $s = $req.GetRequestStream()
  try { $s.Write($bytes,0,$bytes.Length) } finally { $s.Close() }
  $resp = $req.GetResponse()
  try {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    try { return $sr.ReadToEnd() } finally { $sr.Close() }
  } finally { $resp.Close() }
}

function Send-RchCommand([string]$command) {
  $escaped = [System.Security.SecurityElement]::Escape($command)
  $xml = '<?xml version="1.0" encoding="UTF-8"?><Service><cmd>' + $escaped + '</cmd></Service>'
  return Send-Rch $xml
}

function Read-ServicePage {
  $req = [System.Net.HttpWebRequest]::Create($PrinterUrl)
  $req.Method = "GET"
  $req.Timeout = 5000
  $req.ReadWriteTimeout = 5000
  $resp = $req.GetResponse()
  try {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    try { return $sr.ReadToEnd() } finally { $sr.Close() }
  } finally { $resp.Close() }
}

function Status-Rch {
  return Parse-Rch (Send-RchCommand '<</?s')
}

function Drawer-Rch {
  # RCH protocol key function: C86 = apertura cassetto.
  # It is accepted only with a closed document and outside PRG mode.
  return Parse-Rch (Send-RchCommand '=C86')
}

function GiftReceipt-Rch {
  # RCH PRINT! RT: ristampa l'ultimo documento commerciale senza importi ("scontrino regalo").
  # Il comando va eseguito in REG dopo l'emissione del documento fiscale originale.
  return Parse-Rch (Send-RchCommand '=C453/$2')
}

function ReadOnly-Probe([string]$label,[string]$command) {
  # Sicurezza: questo endpoint accetta esclusivamente comandi Dump/Enquiry RCH (<...).
  if(!$command.StartsWith('<')){throw "Comando diagnostico non di sola lettura: $command"}
  try {
    $raw = Send-RchCommand $command
    $parsed = Parse-Rch $raw
    return [pscustomobject]@{
      label=$label
      command=$command
      ok=$parsed.ok
      errorCode=$parsed.errorCode
      printerError=$parsed.printerError
      busy=$parsed.busy
      values=(Flatten-RchXml $raw)
      raw=$raw
    }
  } catch {
    return [pscustomobject]@{label=$label;command=$command;ok=$false;error=$_.Exception.Message;values=@();raw=""}
  }
}

function Diagnostics-Rch {
  # Tutti i comandi sotto sono di tipo DUMP/ENQUIRY (<): nessuna vendita,
  # nessun azzeramento, nessuna programmazione e nessuna stampa fiscale.
  $probes = New-Object System.Collections.Generic.List[object]
  $probes.Add((ReadOnly-Probe "Stato RT" '<</?s'))
  $probes.Add((ReadOnly-Probe "Data e ora RT" '<</?d'))
  $probes.Add((ReadOnly-Probe "Revisione firmware" '<</?f'))
  $probes.Add((ReadOnly-Probe "Matricola fiscale" '<</?m'))
  $probes.Add((ReadOnly-Probe "Stato stampante compatibilità" '<</?i/*3'))
  $probes.Add((ReadOnly-Probe "Stato inattività/file pendenti compatibilità" '<</?i/*5'))

  # Lettura programmazioni: la struttura DUMP usa '<' e lo stesso identificatore
  # del file residente (R=reparti, T=pagamenti). Sono sonde esclusivamente read-only.
  $departments = New-Object System.Collections.Generic.List[object]
  for($i=1;$i -le 20;$i++){
    $r = ReadOnly-Probe ("Reparto " + $i) ("<R" + $i + "/?A")
    if($r.errorCode -eq 0 -or $r.values.Count -gt 6){$departments.Add($r)}
  }
  $payments = New-Object System.Collections.Generic.List[object]
  for($i=1;$i -le 20;$i++){
    $r = ReadOnly-Probe ("Pagamento " + $i) ("<T" + $i + "/?A")
    if($r.errorCode -eq 0 -or $r.values.Count -gt 6){$payments.Add($r)}
  }

  $passive = $null
  try {
    $rawPage = Read-ServicePage
    $passive = [pscustomobject]@{ok=$true;values=(Flatten-RchXml $rawPage);raw=$rawPage}
  } catch {
    $passive = [pscustomobject]@{ok=$false;error=$_.Exception.Message;values=@();raw=""}
  }

  return [pscustomobject]@{
    ok=$true
    readOnly=$true
    emittedFiscalDocument=$false
    changedProgramming=$false
    printer=$PrinterIp
    service=$PrinterUrl
    generatedAt=(Get-Date).ToString("o")
    passiveServicePage=$passive
    probes=@($probes)
    departments=@($departments)
    payments=@($payments)
    note="Diagnostica di sola lettura. Nessun comando fiscale, di chiusura o di programmazione è stato trasmesso."
  }
}

function Sanitize-Desc([string]$s) {
  if($null -eq $s){return "ARTICOLO"}
  $s = $s -replace '[<>&()/\\]',' '
  $s = $s -replace '\s+',' '
  $s = $s.Trim()
  if($s.Length -gt 20){$s=$s.Substring(0,20)}
  if(!$s){$s="ARTICOLO"}
  return $s
}

function Receipt-Rch($data) {
  if($null -eq $data.lines -or $data.lines.Count -lt 1){ throw "Nessuna riga da stampare." }
  $cmds = New-Object System.Collections.Generic.List[string]
  foreach($line in $data.lines){
    $dept = [int]$line.department
    if($dept -lt 1 -or $dept -gt 99){$dept=2}
    $qty = [int]$line.quantity
    if($qty -lt 1){$qty=1}
    $unit = [decimal]$line.unit_price
    if($unit -le 0){throw "Prezzo articolo non valido."}
    $cents = [int][Math]::Round([double]($unit*100),0,[MidpointRounding]::AwayFromZero)
    $desc = Sanitize-Desc ([string]$line.description)
    $cmds.Add(('=R{0}/1/*{2}/({3})' -f $dept,$cents,$qty,$desc))
  }
  $tender=[int]$data.tender
  if($tender -lt 1 -or $tender -gt 99){throw "Tender RCH non valido."}
  $cmds.Add(('=T{0}' -f $tender))
  $sb=New-Object System.Text.StringBuilder
  [void]$sb.Append('<?xml version="1.0" encoding="UTF-8"?><Service>')
  foreach($c in $cmds){
    $escaped=[System.Security.SecurityElement]::Escape($c)
    [void]$sb.Append("<cmd>$escaped</cmd>")
  }
  [void]$sb.Append('</Service>')
  return Parse-Rch (Send-Rch $sb.ToString())
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback,$Port)
$listener.Start()
$host.UI.RawUI.WindowTitle = "Optyker RCH Connector"
Write-Host ""
Write-Host "Optyker RCH Connector attivo" -ForegroundColor Green
Write-Host "Registratore: $PrinterUrl"
Write-Host "Bridge locale: http://127.0.0.1:$Port"
Write-Host "Lascia aperta questa finestra mentre usi la Cassa Optyker."
Write-Host ""

try {
  while($true){
    $client=$listener.AcceptTcpClient()
    try {
      $stream=$client.GetStream()
      $reader=New-Object System.IO.StreamReader($stream,[System.Text.Encoding]::UTF8,$false,8192,$true)
      $requestLine=$reader.ReadLine()
      if(!$requestLine){$client.Close();continue}
      $parts=$requestLine.Split(' ')
      $method=$parts[0].ToUpperInvariant()
      $path=$parts[1].Split('?')[0]
      $contentLength=0
      while($true){
        $line=$reader.ReadLine()
        if($null -eq $line -or $line -eq ''){break}
        if($line -match '^Content-Length:\s*(\d+)$'){$contentLength=[int]$Matches[1]}
      }
      $body=''
      if($contentLength -gt 0){
        $buf=New-Object char[] $contentLength
        $read=0
        while($read -lt $contentLength){
          $n=$reader.Read($buf,$read,$contentLength-$read)
          if($n -le 0){break}
          $read+=$n
        }
        if($read -gt 0){$body=-join $buf[0..($read-1)]}
      }
      if($method -eq 'OPTIONS'){
        Json-Response $stream 200 @{ok=$true}
      } elseif($path -eq '/health'){
        Json-Response $stream 200 @{ok=$true;connector='Optyker RCH';version='1.3-readonly-diagnostics';printer=$PrinterIp;port=$Port}
      } elseif($path -eq '/status'){
        try {
          $r=Status-Rch
          Json-Response $stream 200 $r
        } catch {
          Json-Response $stream 500 @{ok=$false;error=$_.Exception.Message;printer=$PrinterIp}
        }
      } elseif($path -eq '/diagnostics'){
        try {
          $r=Diagnostics-Rch
          Json-Response $stream 200 $r
        } catch {
          Json-Response $stream 500 @{ok=$false;readOnly=$true;error=$_.Exception.Message;printer=$PrinterIp}
        }
      } elseif($path -eq '/drawer' -and $method -eq 'POST'){
        try {
          $r=Drawer-Rch
          Json-Response $stream 200 $r
        } catch {
          Json-Response $stream 500 @{ok=$false;error=$_.Exception.Message;printer=$PrinterIp}
        }
      } elseif($path -eq '/gift-receipt' -and $method -eq 'POST'){
        try {
          $r=GiftReceipt-Rch
          Json-Response $stream 200 $r
        } catch {
          Json-Response $stream 500 @{ok=$false;error=$_.Exception.Message;printer=$PrinterIp}
        }
      } elseif($path -eq '/receipt' -and $method -eq 'POST'){
        try {
          $data=$body | ConvertFrom-Json
          $r=Receipt-Rch $data
          Json-Response $stream 200 $r
        } catch {
          Json-Response $stream 500 @{ok=$false;error=$_.Exception.Message;printer=$PrinterIp}
        }
      } else {
        Json-Response $stream 400 @{ok=$false;error='Endpoint non valido'}
      }
    } catch {
      try { Json-Response $stream 500 @{ok=$false;error=$_.Exception.Message} } catch {}
    } finally {
      try {$client.Close()} catch {}
    }
  }
} finally {
  $listener.Stop()
}
