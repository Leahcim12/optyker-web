"""Build a bounded read-only follow-up from the previously tested local diagnostic.
No fiscal payment, receipt, closure, database or journal write is added.
"""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'rch-connector/Verifica-Scontrino-Sospeso.ps1'
ps=source.read_text(encoding='utf-8-sig')
assert "20260921-pending-read1" in ps
ps=ps.replace("$DiagnosticVersion='20260921-pending-read1'", "$DiagnosticVersion='20260921-pending-read2'\n$TargetDate='2026-09-21'\n$DayReadCommand='=C451/$0/&210926/[210926'")
ps=ps.replace("@('<</?s','<</?m','<</?d','=C3','=C453/$0','=C1')", "@('<</?s','<</?m','<</?d','<</?7','=C3','=C453/$0','=C451/$0/&210926/[210926','=C1')")
ps=ps.replace("return [pscustomobject]$out\n}\nfunction Assert-IdleReg", """$out.numericStatusFields=[ordered]@{}
  if($ss.Count -eq 1){
    foreach($node in $ss[0].ChildNodes){
      if($node.NodeType -eq [Xml.XmlNodeType]::Element -and $node.Name -match '^[A-Za-z][A-Za-z0-9_]{0,39}$' -and $node.InnerText -match '^\\d{1,15}$'){$out.numericStatusFields[$node.Name]=$node.InnerText}
    }
  }
  return [pscustomobject]$out
}
function Assert-IdleReg""")
start=ps.index('function Get-ReceiptSummary(');end=ps.index('function Safe-JournalEntry(',start)
ps=ps[:start]+r'''# Export fiscal metadata and a masked layout, never names, item descriptions,
# fiscal codes, passwords or the raw journal. No result here authorizes replay.
function Get-MaskedJournalLine([string]$line){
  $known='DOCUMENTO|COMMERCIALE|GESTIONALE|NON|FISCALE|SCONTRINO|N|NR|NUMERO|TOTALE|COMPLESSIVO|PAGATO|PAGARE|PAGAMENTO|CONTANTI|CONTANTE|ELETTRONICO|ELETTRONICA|CARTA|RESTO|RESO|MERCE|ANNULLAMENTO|ANNULLO|CHIUSURA|AZZERAMENTO|GIORNALIERO|GIORNALIERA|GIORNALE|FONDO|FATTURA|COPIA|DATA|ORA|EURO|EUR|IVA|RIEPILOGO|DETTAGLIO|MEMORIA|PERMANENTE|LETTURA|DGFE|RT|ESITO|INVIO|TRASMISSIONE|FINE|DOCUMENTI|NESSUN|ASSENTE|CORRISPETTIVI|NETTO|LORDO|TOTALI|NUM|REPARTO|SERVIZI|BENI'
  $tokens=[regex]::Matches($line,'\p{L}[\p{L}\p{N}_]*|\p{N}[\p{L}\p{N}_]*|[^\p{L}\p{N}]')
  $parts=New-Object Text.StringBuilder
  foreach($t in $tokens){
    $v=$t.Value
    if($v -cmatch '^[0-9]{1,4}$' -or $v -imatch ('^(?:'+$known+')$') -or $v -match '^[\s.,:/()\[\]_=*+\-\u00b0\u00ba\u20ac#]$'){[void]$parts.Append($v)}
    elseif($v -match '^[\x00-\x1f\x7f]$'){[void]$parts.Append('[CTRL]')}
    else {[void]$parts.Append('[...]')}
  }
  return $parts.ToString()
}
function Get-ReceiptSummary([string]$raw){
  $status=Get-StatusEvidence $raw;if(-not $status.ok){throw 'Lettura memoria del registratore non confermata.'}
  $doc=Parse-SafeXml $raw;$nodes=$doc.SelectNodes('/Service/EJ')
  $texts=New-Object 'System.Collections.Generic.List[string]'
  foreach($node in $nodes){$texts.Add($node.InnerText.Replace("`r",''))}
  $t=$texts.ToArray() -join "`n";$sha=[Security.Cryptography.SHA256]::Create()
  try{$hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($t))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  $numbers=New-Object 'System.Collections.Generic.List[object]'
  $dates=New-Object 'System.Collections.Generic.List[object]'
  $totals=New-Object 'System.Collections.Generic.List[object]'
  $layout=New-Object 'System.Collections.Generic.List[object]'
  $kinds=New-Object 'System.Collections.Generic.List[string]'
  $lines=@($t -split "`n");$lineNo=0
  foreach($line in $lines){
    $lineNo++;$normal=[regex]::Replace($line,'[\x00-\x08\x0b-\x1f\x7f]',' ').Trim()
    if($normal -match '(?i)DOCUMENTO\s+(?:COMMERCIALE\s+)?(?:DI\s+)?ANNULL|ANNULLAMENTO'){$kinds.Add('void')}
    elseif($normal -match '(?i)DOCUMENTO\s+(?:COMMERCIALE\s+)?(?:DI\s+)?RESO'){$kinds.Add('return')}
    elseif($normal -match '(?i)DOCUMENTO\s+COMMERCIALE'){$kinds.Add('sale')}
    elseif($normal -match '(?i)DOCUMENTO\s+(?:NON\s+FISCALE|GESTIONALE)'){$kinds.Add('non_fiscal')}
    elseif($normal -match '(?i)CHIUSURA|AZZERAMENTO|ESITO\s+(?:INVIO|TRASMISSIONE)'){$kinds.Add('report_or_transmission')}
    $m=[regex]::Match($normal,'(?i)^(?:DOCUMENTO(?:\s+COMMERCIALE)?|SCONTRINO)\s+(?:N(?:R|UMERO)?[.\u00b0\u00ba]?\s*:?\s*)?(\d{4}-\d{4})\s*$')
    if($m.Success){$numbers.Add(@{line=$lineNo;value=$m.Groups[1].Value})}
    $m=[regex]::Match($normal,'^(\d{2}[-/]\d{2}[-/]\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*$')
    if($m.Success){$dates.Add(@{line=$lineNo;date=$m.Groups[1].Value;time=$m.Groups[2].Value})}
    $m=[regex]::Match($normal,'(?i)^TOTALE\s+COMPLESSIVO\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:EUR|\u20ac)?\s*$')
    if($m.Success){$amount=[decimal]::Parse($m.Groups[1].Value.Replace('.','').Replace(',','.'),[Globalization.CultureInfo]::InvariantCulture);$totals.Add(@{line=$lineNo;cents=[long]($amount*100)})}
    # Only technical headers, document identifiers and totals are retained.
    # Unrecognized content is represented by a length count, not the source text.
    if($normal -match '(?i)^(?:DOCUMENTO|SCONTRINO|TOTALE|PAGATO|RESTO|CHIUSURA|AZZERAMENTO|GIORNALE|FONDO|DATA|ORA|MEMORIA|DGFE|ESITO|FINE|NESSUN|RIEPILOGO|CORRISPETTIVI)\b|^\d{2}[-/]\d{2}[-/]\d{4}\b'){
      if($layout.Count -lt 300){$layout.Add(@{line=$lineNo;masked=(Get-MaskedJournalLine $normal);length=$line.Length})}
    }
  }
  $summary=[ordered]@{source='rch_ej_read_only';sha256=$hash;textLength=$t.Length;ejNodes=$nodes.Count;lineCount=$lines.Count;serialMatched=([regex]::IsMatch($t,'(?<![A-Z0-9])'+$ExpectedSerial+'(?![A-Z0-9])'));documentNumbers=$numbers.ToArray();documentDates=$dates.ToArray();totals=$totals.ToArray();kinds=@($kinds.ToArray()|Select-Object -Unique);technicalLines=$layout.ToArray();technicalLinesTruncated=($layout.Count -ge 300);documentNumber=$null;documentDate=$null;documentTime=$null;totalCents=$null;kind='unknown';fieldsUnambiguous=$false;operationAutomaticallyResolved=$false;absenceOfReceiptProven=$false}
  if($numbers.Count -eq 1){$summary.documentNumber=$numbers[0].value}
  if($dates.Count -eq 1){$summary.documentDate=$dates[0].date;$summary.documentTime=$dates[0].time}
  if($totals.Count -eq 1){$summary.totalCents=$totals[0].cents}
  if($summary.kinds.Count -eq 1){$summary.kind=$summary.kinds[0]}
  $summary.fieldsUnambiguous=($nodes.Count -eq 1 -and $numbers.Count -eq 1 -and $dates.Count -eq 1 -and $totals.Count -eq 1 -and $summary.serialMatched -and $summary.kind -in @('sale','void','return'))
  return [pscustomobject]$summary
}
''' + ps[end:]
ps=ps.replace('statusBefore=$null;clock=$null;lastReceipt=$null;statusAfter=$null;', 'statusBefore=$null;clock=$null;clockShape=$null;closureCounter=$null;lastReceipt=$null;dailyJournal=$null;targetDate=$TargetDate;warnings=@();statusAfter=$null;')
ps=ps.replace("if($clock -match '^[0-9 :./+-]{1,60}$'){$report.clock=$clock}","""$report.clockShape=Get-MaskedJournalLine $clock
    if($clock -match '^[0-9 :./+-]{1,60}$'){$report.clock=$clock}
    $counter=Get-Enquiry (Invoke-RchReadCommand '<</?7') '7'
    if($counter -match '^\\d{1,15}$'){$report.closureCounter=$counter}
    if([datetime]::Now.ToString('yyyy-MM-dd') -lt $TargetDate){throw 'Data del PC precedente al giorno da controllare: nessuna lettura memoria eseguita.'}""")
ps=ps.replace("$report.lastReceipt=Get-ReceiptSummary (Invoke-RchReadCommand '=C453/$0')\n      if(-not $report.lastReceipt.fieldsUnambiguous){throw 'Documento letto ma dati non univoci: richiede verifica tecnica.'}\n      $report.collectionCompleted=$true", """$report.lastReceipt=Get-ReceiptSummary (Invoke-RchReadCommand '=C453/$0')
      if(-not $report.lastReceipt.fieldsUnambiguous){$report.warnings+= 'Ultimo documento non riconosciuto: inclusa la struttura tecnica oscurata.'}
      # PRINT! F v14 p24: /$0 is a PC download, /& and /[ bound the dates.
      # The EXACT fixed range avoids accidentally exporting all fiscal history.
      $report.dailyJournal=Get-ReceiptSummary (Invoke-RchReadCommand $DayReadCommand)
      if($report.dailyJournal.ejNodes -eq 0){$report.warnings+= 'Nessun blocco EJ restituito: non equivale alla prova che non esistano scontrini.'}
      if($report.dailyJournal.kind -eq 'unknown'){$report.warnings+= 'Contenuto giornaliero da verificare: nessuno stato viene modificato.'}
      $report.collectionCompleted=$true""")
ps=ps.replace("'Optyker-Scontrino-Sospeso-'", "'Optyker-Verifica-Giornale-V2-'")
ps=ps.replace("'OPTYKER - VERIFICA SCONTRINO SOSPESO'", "'OPTYKER - VERIFICA GIORNALE 21 SETTEMBRE (V2)'")
ps=ps.replace("'Lettura della memoria: passaggio temporaneo alla lettura e ritorno in REG.'", "'Lettura mirata al 21/09/2026: modalita temporanea Z, poi ritorno in REG. Nessun azzeramento.'")
ps=ps.replace("'Allega alla chat il file Optyker-Scontrino-Sospeso....json appena creato.'", "'Allega alla chat il nuovo file Optyker-Verifica-Giornale-V2....json.'")
ps=ps.replace("  Write-Host 'Lo stato dello scontrino NON e stato cambiato.", "  if($report.warnings){$report.warnings | ForEach-Object {Write-Host $_ -ForegroundColor Yellow}}\n  Write-Host 'Lo stato dello scontrino NON e stato cambiato.")
# Keep the previous serial, coordination lock, transport and restoration rules.
assert ps.count("$report.dailyJournal=Get-ReceiptSummary (Invoke-RchReadCommand $DayReadCommand)")==1
assert '$report.clockShape=Get-MaskedJournalLine $clock' in ps
folder=ROOT/'rch-pending-v2-check';folder.mkdir(exist_ok=True)
(folder/'Verifica-Giornale-V2.ps1').write_text(ps,encoding='utf-8-sig',newline='\n')
header='''@echo off
setlocal
set "OPTYKER_DIAG_SELF=%~f0"
powershell.exe -NoLogo -NoProfile -Command "$text=[IO.File]::ReadAllText($env:OPTYKER_DIAG_SELF);$marker='# OPTYKER_PS_BEGIN';$pos=$text.LastIndexOf($marker);if($pos -lt 0){exit 1};& ([scriptblock]::Create($text.Substring($pos+$marker.Length)))"
set "DIAG_RESULT=%ERRORLEVEL%"
echo.
echo Premi un tasto per chiudere la verifica.
pause >nul
exit /b %DIAG_RESULT%
# OPTYKER_PS_BEGIN
'''
output=folder/'Optyker-Verifica-Giornale-V2.bat'
output.write_bytes((header+ps).replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))
print('READ-ONLY DIAGNOSTIC BUILT',hashlib.sha256(output.read_bytes()).hexdigest())
