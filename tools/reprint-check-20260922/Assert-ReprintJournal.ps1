function Assert-ReprintJournal([string]$raw,$job) {
  # OPTYKER_REPRINT_MATCH_20260922: only the selection validator is replaced.
  # One exact number, date, serial and total; no fiscal state changes.
  $status=Parse-Rch $raw
  if(-not $status.ok -or $status.lastCmd -ne 1){throw 'Lettura documento RCH non confermata. Nessuna ristampa inviata.'}
  $xml=Read-SafeXml $raw;$nodes=$xml.SelectNodes('/Service/EJ')
  if($nodes.Count -ne 1){throw ('Giornale RCH: atteso un documento, ricevuti '+$nodes.Count+' blocchi EJ. Nessuna ristampa inviata.')}
  $text=$nodes[0].InnerText.Replace("`r`n","`n").Replace("`r","`n").Replace([char]0x00a0,' ').Replace([char]0xfeff,' ')
  $rows=@($text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
  $numbers=New-Object 'Collections.Generic.List[object]';$dates=New-Object 'Collections.Generic.List[object]';$totals=New-Object 'Collections.Generic.List[object]'
  for($i=0;$i -lt $rows.Count;$i++){
    $line=$rows[$i]
    $n=[regex]::Match($line,'(?i)^(?:DOCUMENTO(?:[ \t]+COMMERCIALE)?|SCONTRINO)[ \t]+N(?:R|UMERO)?[.\u00b0\u00ba]?[ \t]*:?[ \t]*(\d{4})[ \t]*-[ \t]*(\d{4})[ \t]*$')
    if($n.Success){$numbers.Add(@{line=$i;number=$n.Groups[1].Value+'-'+$n.Groups[2].Value})}
    $d=[regex]::Match($line,'(?i)^(?:DATA[ \t]*:?[ \t]*)?(\d{2}[-/]\d{2}[-/]\d{4})[ \t]+(?:ORA[ \t]*:?[ \t]*)?(\d{2}:\d{2}(?::\d{2})?)[ \t]*$')
    if($d.Success){
      $parsed=[datetime]::MinValue;$value=$d.Groups[1].Value.Replace('/','-')+' '+$d.Groups[2].Value
      if([datetime]::TryParseExact($value,[string[]]@('dd-MM-yyyy HH:mm','dd-MM-yyyy HH:mm:ss'),[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$parsed)){$dates.Add(@{line=$i;date=$parsed.ToString('yyyy-MM-dd')})}
    }
    $t=[regex]::Match($line,'(?i)^TOTALE[ \t]+COMPLESSIVO[ \t]*:?[ \t]*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})[ \t]*(?:EUR|\u20ac)?[ \t]*$')
    if($t.Success){$amount=[decimal]::Parse($t.Groups[1].Value.Replace('.','').Replace(',','.'),[Globalization.CultureInfo]::InvariantCulture)*100;$totals.Add(@{line=$i;cents=$amount})}
  }
  $expected=[string]$job.document_number+' del '+[string]$job.document_date
  if($numbers.Count -ne 1){throw ('Formato del giornale non univoco: '+$numbers.Count+' numeri documento riconosciuti; atteso '+$expected+'. Nessuna ristampa inviata.')}
  $found=$numbers[0].number
  if($found -cne [string]$job.document_number){throw ('Numero diverso: atteso '+$expected+'; letto '+$found+'. Nessuna ristampa inviata.')}
  # Use the timestamp adjacent to the fiscal number, not extraction/report dates.
  # Multiple nearby timestamps remain ambiguous, even if their values are equal.
  $near=@($dates | Where-Object {[math]::Abs([int]$_.line-[int]$numbers[0].line) -le 3})
  if($near.Count -ne 1){throw ('Data del documento non univoca: '+$near.Count+' date nel riepilogo del numero '+$found+'. Nessuna ristampa inviata.')}
  if($near[0].date -cne [string]$job.document_date){throw ('Data diversa: atteso '+$expected+'; letto '+$found+' del '+$near[0].date+'. Nessuna ristampa inviata.')}
  if(-not [regex]::IsMatch($text,'(?<![A-Z0-9])'+[regex]::Escape([string]$job.serial)+'(?![A-Z0-9])')){throw 'Matricola del documento diversa dalla RCH selezionata. Nessuna ristampa inviata.'}
  if($null -eq $job.total -or [decimal]$job.total -le 0 -or $totals.Count -ne 1){throw ('Totale del documento non univoco: '+$totals.Count+' totali riconosciuti. Nessuna ristampa inviata.')}
  $expectedCents=[decimal]$job.total*100
  if($totals[0].cents -ne $expectedCents){$fmt=[Globalization.CultureInfo]::GetCultureInfo('it-IT');throw ('Importo diverso: atteso '+([decimal]$job.total).ToString('N2',$fmt)+' EUR; letto '+([decimal]($totals[0].cents/100)).ToString('N2',$fmt)+' EUR. Nessuna ristampa inviata.')}
  $isVoid=$text -match '(?im)^\s*DOCUMENTO[ \t]+(?:COMMERCIALE[ \t]+)?(?:DI[ \t]+)?ANNULL'
  $isReturn=$text -match '(?im)^\s*DOCUMENTO[ \t]+(?:COMMERCIALE[ \t]+)?(?:DI[ \t]+)?RESO'
  if(($job.operation -ceq 'void' -and -not $isVoid) -or ($job.operation -cne 'void' -and ($isVoid -or $isReturn))){throw 'Tipo di documento diverso dallo scontrino selezionato. Nessuna ristampa inviata.'}
}
