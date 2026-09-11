param(
  [string]$PrinterIp = '192.168.1.10',
  [string]$OutputDirectory = '',
  [switch]$LibraryOnly
)

$ErrorActionPreference = 'Stop'
# The dependency is downloaded and SHA-256 checked by the .bat launcher.
# Import only its XML/HTTP helpers: do not start or replace the installed bridge.
$runProtocolDiagnostic = -not $LibraryOnly
. (Join-Path $PSScriptRoot 'rch-optyker-connector.ps1') -PrinterIp $PrinterIp -LibraryOnly
$ProtocolDiagnosticVersion = '20260911-protocol-v14-1'

function Get-ProtocolQueryList {
  # RCH PRINT! F protocol v14, rel.2102, section 2.5.10, pp.58-61.
  # These queries do not print, change mode, program the RT, or send fiscal data.
  return @(
    [pscustomobject]@{key='status';label='Stato del registratore';command='<</?s';page=58},
    [pscustomobject]@{key='firmware';label='Versione firmware';command='<</?f';page=59},
    [pscustomobject]@{key='serial';label='Matricola fiscale';command='<</?m';page=59},
    [pscustomobject]@{key='rtState';label='Stato telematico RT';command='<</?i/*3';page=60},
    [pscustomobject]@{key='clock';label='Data e ora del registratore';command='<</?d';page=59},
    [pscustomobject]@{key='closureCounter';label='Numero azzeramenti';command='<</?7';page=59},
    [pscustomobject]@{key='pendingFiles';label='Stato file pendenti';command='<</?i/*5';page=61}
  )
}

function Read-ProtocolQuery([string]$command) {
  $definitions = @(Get-ProtocolQueryList | Where-Object {$_.command -ceq $command})
  if($definitions.Count -ne 1){throw 'Comando non consentito nella diagnostica di sola lettura.'}
  $definition = $definitions[0]
  $requestXml = Build-RchXml $command
  $raw = ''
  try {
    $raw = Request-Printer 'POST' $requestXml
    $result = Parse-Rch $raw
    # A generic successful HTTP/Request is not evidence that the query ran.
    $accepted = $result.ok -and $result.lastCmd -eq 1
    $message = $null
    if(-not $accepted){
      $message = if($result.error){$result.error}else{'La RCH non conferma l esecuzione del comando.'}
    }
    return [pscustomobject]@{
      key=$definition.key;label=$definition.label;command=$command;manualPage=$definition.page
      httpReached=$true;queryAccepted=[bool]$accepted;error=$message
      requestXml=$requestXml;raw=$raw;values=(Flatten-RchXml $raw);result=$result
    }
  } catch {
    return [pscustomobject]@{
      key=$definition.key;label=$definition.label;command=$command;manualPage=$definition.page
      httpReached=$false;queryAccepted=$false;error=$_.Exception.Message
      requestXml=$requestXml;raw=$raw;values=@();result=$null
    }
  }
}

function Test-ProtocolIdle($result) {
  # Real store response has ECRStatus.idleState=0. Unknown/missing states fail closed.
  return ($null -ne $result -and $result.ok -and $result.lastCmd -eq 1 -and
    [string]$result.idleState -cmatch '^0{1,2}$' -and
    [string]$result.mode -cmatch '^(R|REG(?: \(OP [0-9]+\))?|X|Z|P|PRG|S|SERVICE)$')
}

function Get-ProtocolDiagnostic {
  $queries = @(Get-ProtocolQueryList)
  $probes = New-Object 'System.Collections.Generic.List[object]'
  $stoppedAt = $null
  $stopReason = $null
  foreach($query in $queries){
    Write-Host ('Lettura: ' + $query.label + '...')
    $probe = Read-ProtocolQuery $query.command
    $probes.Add($probe)
    if(-not $probe.queryAccepted){
      $stoppedAt = $query.key
      $stopReason = $probe.error
      break
    }
    if($query.key -eq 'status' -and -not (Test-ProtocolIdle $probe.result)){
      $stoppedAt = 'status'
      $stopReason = 'Registratore non inattivo o stato non riconosciuto. Terminare le operazioni in corso prima della diagnostica.'
      break
    }
    # A state included in a later reply can report concurrent activity.
    if($query.key -ne 'status' -and $null -ne $probe.result.mode -and -not (Test-ProtocolIdle $probe.result)){
      $stoppedAt = $query.key
      $stopReason = 'Lo stato del registratore e cambiato durante la lettura. Diagnostica interrotta.'
      break
    }
  }
  $accepted = @($probes | Where-Object {$_.queryAccepted}).Count
  return [pscustomobject]@{
    version=$ProtocolDiagnosticVersion;reportGenerated=$true;readOnly=$true
    printer=$PrinterIp;generatedAt=(Get-Date).ToString('o')
    sourceManual='RCH PRINT! F protocol v14, rel.2102, section 2.5.10, pp.58-61'
    expectedSerialFromUser='72IV6003831'
    queriesPlanned=$queries.Count;queriesAttempted=$probes.Count;queriesAccepted=$accepted
    allQueriesAccepted=($accepted -eq $queries.Count -and $null -eq $stoppedAt)
    stoppedAt=$stoppedAt;stopReason=$stopReason;probes=$probes.ToArray()
    emittedFiscalDocument=$false;changedProgramming=$false;changedMode=$false;tsSubmitted=$false
    compatibilityVerified=$false;fiscalEmissionEnabled=$false;adeOutcome='unverified'
    note='Le risposte originali devono essere esaminate: comandi accettati non certificano firmware compatibile, dati restituiti, emissione fiscale o invio ad AdE/TS.'
  }
}

function Save-ProtocolDiagnostic($report,[string]$directory) {
  if(-not $directory){$directory=[Environment]::GetFolderPath('Desktop')}
  if(-not $directory -or -not (Test-Path -LiteralPath $directory -PathType Container)){
    throw 'Cartella di destinazione non disponibile.'
  }
  $name = 'Diagnostica-Protocollo-RCH-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.json'
  $destination = Join-Path $directory $name
  $json = ConvertTo-Json -InputObject $report -Depth 20
  [System.IO.File]::WriteAllText($destination,$json,(New-Object System.Text.UTF8Encoding($true)))
  return $destination
}

if(-not $runProtocolDiagnostic){return}
try {
  Write-Host 'OPTYKER - LETTURA COMPATIBILITA RCH' -ForegroundColor Cyan
  Write-Host 'Lascia libera la cassa durante la lettura. Nessuno scontrino verra emesso.'
  $report = Get-ProtocolDiagnostic
  $destination = Save-ProtocolDiagnostic $report $OutputDirectory
  Write-Host ('File salvato: ' + $destination) -ForegroundColor Green
  if($report.stoppedAt){Write-Host ('Lettura interrotta: ' + $report.stopReason) -ForegroundColor Yellow}
  Write-Host 'Allega questo file JSON alla chat Optyker, anche se la lettura si e interrotta.'
} catch {
  Write-Host ('ERRORE: ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
