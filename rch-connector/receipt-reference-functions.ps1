# BEGIN OPTYKER_RCH_REFERENCE_V2
# Reuse the documented read-only EJ operation already used by Read-PrintedReceipt.
# The exclusive Emit-Receipt printer lock encloses BOTH observations and the sale.
# No marker, barcode, daily closure, inferred document number or additional sale.
function Get-ReceiptEvidence([string]$raw,$document,[bool]$identityOnly=$false) {
  $status=Parse-Rch $raw
  if(-not $status.ok -or $status.lastCmd -ne 1){throw 'Lettura giornale non confermata.'}
  $nodes=(Read-SafeXml $raw).SelectNodes('/Service/EJ')
  if($nodes.Count -ne 1){throw 'Giornale assente o ambiguo.'}
  $text=$nodes[0].InnerText.Replace("`r",'')
  $serial=[string]$document.serial
  if(-not [regex]::IsMatch($text,'(?<![A-Z0-9])'+[regex]::Escape($serial)+'(?![A-Z0-9])')){throw 'Matricola non corrispondente.'}
  $numbers=[regex]::Matches($text,'(?m)^\s*DOCUMENTO(?:\s+COMMERCIALE)?\s+N[.°]?\s*(\d{4}-\d{4})\s*$')
  $dates=[regex]::Matches($text,'(?m)^\s*(\d{2}[-/]\d{2}[-/]\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*$')
  if($numbers.Count -ne 1 -or $dates.Count -ne 1){throw 'Numero o data non univoci.'}
  $date=[datetime]::MinValue
  $printedDate=$dates[0].Groups[1].Value.Replace('/','-')+' '+$dates[0].Groups[2].Value
  if(-not [datetime]::TryParseExact($printedDate,[string[]]@('dd-MM-yyyy HH:mm','dd-MM-yyyy HH:mm:ss'),[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$date)){throw 'Data RCH non valida.'}
  $evidence=@{serial=$serial;number=$numbers[0].Groups[1].Value;date=$date.ToString('yyyy-MM-dd');time=$date.ToString('HH:mm:ss')}
  if($identityOnly){return $evidence}
  if($text -match '(?i)DOCUMENTO\s+(?:COMMERCIALE\s+)?(?:DI\s+)?(?:ANNULL|RESO)'){throw 'Il giornale non contiene una vendita.'}
  $totals=[regex]::Matches($text,'(?m)^\s*TOTALE COMPLESSIVO\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:EUR|€)?\s*$')
  if($totals.Count -ne 1){throw 'Importo non univoco.'}
  $amount=[decimal]::Parse($totals[0].Groups[1].Value.Replace('.','').Replace(',','.'),[Globalization.CultureInfo]::InvariantCulture)*100
  if($amount -ne [long]$document.totalCents){throw 'Totale diverso dal pagamento.'}
  if($document.talkingReceipt -eq $true -and -not [regex]::IsMatch($text,'(?<![A-Z0-9])'+[regex]::Escape([string]$document.fiscalCode)+'(?![A-Z0-9])')){throw 'Codice fiscale non corrispondente.'}
  $evidence.totalCents=[long]$amount;$evidence.fiscalCodeMatched=$true
  return $evidence
}
function Read-ReceiptEvidence($document,[bool]$identityOnly=$false) {
  Assert-IdleRegister
  try {
    $z=Parse-Rch (Send-RchCommand '=C3')
    if(-not $z.ok -or $z.lastCmd -ne 1){throw 'Accesso al giornale non confermato.'}
    return Get-ReceiptEvidence (Send-RchCommand '=C453/$0') $document $identityOnly
  } finally {
    $reg=Parse-Rch (Send-RchCommand '=C1')
    if(-not $reg.ok -or $reg.lastCmd -ne 1){throw 'Ritorno in REG non confermato.'}
    Assert-IdleRegister
  }
}
function Start-ReceiptReference($document,[string]$jobId) {
  $plan=$document.referenceReadback
  if($document.operation -cne 'sale' -or $plan.strategy -cne 'ej-successor-v1' -or $plan.jobId -cne $jobId){return $null}
  try {return Read-ReceiptEvidence $document $true}
  catch {return $null}
  # Emit-Receipt must independently recheck REG/idle before the first fiscal write.
}
function Complete-ReceiptReference($document,[string]$jobId,$previous) {
  if(-not $previous -or $document.referenceReadback.jobId -cne $jobId){return $null}
  $actual=Read-ReceiptEvidence $document $false
  $p=([string]$previous.number).Split('-');$n=([string]$actual.number).Split('-')
  if($p.Count -ne 2 -or $n.Count -ne 2 -or [int]$p[0] -le 0 -or [int]$p[1] -le 0){throw 'Numero precedente non valido.'}
  $successor=(([int]$n[0] -eq [int]$p[0] -and [int]$n[1] -eq ([int]$p[1]+1)) -or ([int]$n[0] -eq ([int]$p[0]+1) -and [int]$n[1] -eq 1))
  if(-not $successor -or $actual.date -cne $document.referenceReadback.date -or $previous.date -gt $actual.date){throw 'Il giornale non identifica univocamente la nuova vendita.'}
  $actual.source='rch_ej';$actual.strategy='ej-successor-v1';$actual.jobId=$jobId
  $actual.previous=@{number=$previous.number;date=$previous.date}
  return $actual
}
# END OPTYKER_RCH_REFERENCE_V2
