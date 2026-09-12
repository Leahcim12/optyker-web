param(
  [string]$PrinterIp = '192.168.1.10',
  [string]$OutputDirectory = '',
  [switch]$LibraryOnly
)

$ErrorActionPreference='Stop'
$runConfigurationDiagnostic=-not $LibraryOnly
. (Join-Path $PSScriptRoot 'Diagnostica-Protocollo-RCH.ps1') -PrinterIp $PrinterIp -LibraryOnly
$ConfigurationDiagnosticVersion='20260912-config-readback-1'

function Get-RchEnquiryValue([string]$xmlText,[string]$expectedName) {
  $ack=Parse-Rch $xmlText
  if(-not $ack.ok -or $ack.lastCmd -ne 1){throw 'Risposta RCH senza conferma valida.'}
  $doc=Read-SafeXml $xmlText
  $enquiries=$doc.SelectNodes('/Service/Enq')
  if($enquiries.Count -ne 1){throw 'Risposta senza un singolo dato Enq.'}
  $names=$enquiries[0].SelectNodes('name');$values=$enquiries[0].SelectNodes('value')
  if($names.Count -ne 1 -or $values.Count -ne 1 -or $names[0].InnerText -cne $expectedName){throw 'Dato Enq diverso dalla richiesta o duplicato.'}
  if($names[0].SelectNodes('*').Count -ne 0 -or $values[0].SelectNodes('*').Count -ne 0){throw 'Dato Enq non scalare.'}
  return $values[0].InnerText.Trim()
}

function Get-RchXmlLeafValues([string]$xmlText) {
  $rows=New-Object 'System.Collections.Generic.List[object]'
  try {
    $doc=Read-SafeXml $xmlText
    function Visit-RchElement($node,[string]$parentPath) {
      # XmlNode.Name is shadowed by a child <name> in PowerShell's XML adapter.
      # Use the underlying getter so <Enq><name>f</name> stays Service/Enq/name.
      $path=if($parentPath){$parentPath+'/'+$node.get_Name()}else{$node.get_Name()}
      $children=@($node.get_ChildNodes() | Where-Object {$_.NodeType -eq [System.Xml.XmlNodeType]::Element})
      if($children.Count -eq 0){$rows.Add([pscustomobject]@{path=$path;value=$node.InnerText})}
      else {foreach($child in $children){Visit-RchElement $child $path}}
    }
    Visit-RchElement $doc.DocumentElement ''
  } catch {$rows.Add([pscustomobject]@{path='parseError';value=$_.Exception.Message})}
  return ,$rows.ToArray()
}

function Test-RchProgrammingIdle($result) {
  return ($null -ne $result -and $result.ok -and $result.lastCmd -eq 1 -and
    [string]$result.idleState -cmatch '^0{1,2}$' -and [string]$result.mode -cin @('P','PRG'))
}

function Read-RchProgramming {
  # Manufacturer manual v14, section 2.5.11 p.62: complete read requires PRG/SRV.
  # We require PRG selected by the operator, never enter a service menu or change mode.
  $command='<</?C'
  $requestXml=Build-RchXml $command
  try {
    $raw=Request-Printer 'POST' $requestXml
    $result=Parse-Rch $raw
    $accepted=$result.ok -and $result.lastCmd -eq 1
    $errorMessage=if($accepted){$null}elseif($result.error){$result.error}else{'Comando di lettura non confermato.'}
    return [pscustomobject]@{
      key='programming';label='Programmazione del registratore';command=$command;manualPage=62
      requestXml=$requestXml;raw=$raw;values=(Get-RchXmlLeafValues $raw)
      queryAccepted=[bool]$accepted;result=$result;error=$errorMessage
    }
  } catch {
    return [pscustomobject]@{
      key='programming';label='Programmazione del registratore';command=$command;manualPage=62
      requestXml=$requestXml;raw='';values=@();queryAccepted=$false;result=$null;error=$_.Exception.Message
    }
  }
}

function Get-RchConfigurationDiagnostic {
  $probes=New-Object 'System.Collections.Generic.List[object]'
  $expectedSerial='72IV6003831'
  $actualSerial=$null;$stopReason=$null;$completed=$false
  $configurationPayloadPresent=$false;$readAccepted=$false
  $status=Read-ProtocolQuery '<</?s';$probes.Add($status)
  if(-not $status.queryAccepted){$stopReason=$status.error}
  elseif(-not (Test-RchProgrammingIdle $status.result)){
    $stopReason='Serve la modalita PRG, con cassa libera: sulla tastiera premi 4 e poi CHIAVE. Non e stata letta la programmazione.'
  } else {
    $identity=Read-ProtocolQuery '<</?m';$identity.values=Get-RchXmlLeafValues $identity.raw;$probes.Add($identity)
    try {$actualSerial=Get-RchEnquiryValue $identity.raw 'm'} catch {$stopReason=$_.Exception.Message}
    if(-not $stopReason -and $actualSerial -cne $expectedSerial){$stopReason='Matricola diversa dal registratore previsto. Lettura interrotta.'}
    if(-not $stopReason -and $null -ne $identity.result.mode -and -not (Test-RchProgrammingIdle $identity.result)){$stopReason='Modalita o stato del registratore cambiati. Lettura interrotta.'}
    if(-not $stopReason){
      Write-Host 'Lettura programmazione RCH...'
      $configuration=Read-RchProgramming;$probes.Add($configuration)
      $readAccepted=$configuration.queryAccepted
      if(-not $readAccepted){$stopReason=$configuration.error}
      else {
        # A successful acknowledgement or repeated ECRStatus does not contain configuration.
        $configurationPayloadPresent=@($configuration.values | Where-Object {
          $_.path -notmatch '^Service/(Request|ECRStatus)(/|$)' -and
          $_.path -ne 'Service' -and $_.path -notmatch '/name$' -and -not [string]::IsNullOrWhiteSpace($_.value)
        }).Count -gt 0
        $after=Read-ProtocolQuery '<</?s';$probes.Add($after)
        if(-not $after.queryAccepted){$stopReason=$after.error}
        elseif(-not (Test-RchProgrammingIdle $after.result)){$stopReason='Stato finale diverso da PRG inattivo. Controllare il display della cassa.'}
        elseif(-not $configurationPayloadPresent){$stopReason='La RCH ha confermato il comando senza restituire dati di programmazione. Conservare questo rapporto.'}
        else {$completed=$true}
      }
    }
  }
  return [pscustomobject]@{
    version=$ConfigurationDiagnosticVersion;reportGenerated=$true;readOnly=$true
    printer=$PrinterIp;generatedAt=(Get-Date).ToString('o')
    expectedSerial=$expectedSerial;actualSerial=$actualSerial
    identityMatched=($null -ne $actualSerial -and $actualSerial -ceq $expectedSerial)
    configurationReadAccepted=[bool]$readAccepted;configurationPayloadPresent=[bool]$configurationPayloadPresent
    collectionCompleted=$completed;stopReason=$stopReason;probes=$probes.ToArray()
    programmingVerified=$false;fiscalEmissionEnabled=$false;emittedFiscalDocument=$false
    changedProgramming=$false;changedMode=$false;tsSubmitted=$false;adeOutcome='unverified'
    note='Dati grezzi da esaminare: reparti, aliquote e pagamenti non sono considerati verificati dal solo esito positivo della lettura.'
    nextStep='Al termine premi 1 e poi CHIAVE per tornare a REG. Allega il rapporto alla chat Optyker.'
  }
}

function Save-RchConfigurationDiagnostic($report,[string]$directory) {
  if(-not $directory){$directory=[Environment]::GetFolderPath('Desktop')}
  if(-not $directory -or -not (Test-Path -LiteralPath $directory -PathType Container)){throw 'Cartella Desktop non disponibile.'}
  $name='Configurazione-RCH-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8)+'.json'
  $destination=Join-Path $directory $name
  [System.IO.File]::WriteAllText($destination,(ConvertTo-Json -InputObject $report -Depth 24),(New-Object System.Text.UTF8Encoding($true)))
  return $destination
}

if(-not $runConfigurationDiagnostic){return}
try {
  Write-Host 'OPTYKER - LETTURA CONFIGURAZIONE RCH' -ForegroundColor Cyan
  Write-Host 'La cassa deve essere in PRG: 4 poi CHIAVE. Non usare Focus o Optyker durante la lettura.'
  $report=Get-RchConfigurationDiagnostic
  $saved=Save-RchConfigurationDiagnostic $report $OutputDirectory
  Write-Host ('File salvato: '+$saved) -ForegroundColor Green
  if($report.stopReason){Write-Host $report.stopReason -ForegroundColor Yellow}
  Write-Host 'Allega il file JSON alla chat anche se contiene un errore.'
} catch {Write-Host ('ERRORE: '+$_.Exception.Message) -ForegroundColor Red;exit 1}
finally {Write-Host 'Sulla tastiera della cassa premi 1 poi CHIAVE per tornare a REG.' -ForegroundColor Cyan}
