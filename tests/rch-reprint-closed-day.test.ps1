$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-connector.ps1') -LibraryOnly
$job=[pscustomobject]@{document_number='1162-0017';document_date='2026-09-13';serial='72IV6003831';total=30}
$ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
$receipt=@'
             DOCUMENTO COMMERCIALE              
            di vendita o prestazione            
ARTICOLO A                      22%       10,00
ARTICOLO B                      22%       20,00
TOTALE COMPLESSIVO                         30,00
                13-09-2026 12:28                
             DOCUMENTO N. 1162-0017             
                *** 72IV6003831                 
'@
$closure=@'
              DOCUMENTO GESTIONALE              
            di chiusura giornaliera             
VENDITE                                  100,00
CHIUSURA GIORNALIERA N.                     1162
                13-09-2026 22:34                
          DOC.GESTIONALE N. 1162-0007           
                  72IV6003831                   
'@
$cases=@(
  @{name='receipt only';text=$receipt;ok=$true},
  @{name='closed day';text=($receipt+"`n"+$closure);ok=$true},
  @{name='wrong receipt number';text=($receipt.Replace('1162-0017','1162-0018')+"`n"+$closure);ok=$false},
  @{name='receipt date not borrowed from closure';text=($receipt.Replace('13-09','12-09')+"`n"+$closure);ok=$false},
  @{name='receipt serial not borrowed from closure';text=($receipt.Replace('3831','3832')+"`n"+$closure);ok=$false},
  @{name='wrong receipt total';text=($receipt.Replace('30,00','31,00')+"`n"+$closure);ok=$false},
  @{name='wrong closure number';text=($receipt+"`n"+$closure.Replace('1162','1161'));ok=$false},
  @{name='duplicate fiscal receipt';text=($receipt+"`n"+$receipt+"`n"+$closure);ok=$false},
  @{name='extra fiscal receipt after closure';text=($receipt+"`n"+$closure+"`n"+$receipt);ok=$false},
  @{name='unrecognised management document';text=($receipt+"`n"+$closure.Replace('di chiusura giornaliera','altro documento'));ok=$false},
  @{name='management document before receipt';text=($closure+"`n"+$receipt);ok=$false},
  @{name='extra date inside receipt';text=($receipt+"`n13-09-2026 15:00`n"+$closure);ok=$false}
)
foreach($case in $cases){
  $raw='<Service>'+$ack+'<EJ id="452">'+[Security.SecurityElement]::Escape($case.text)+'</EJ></Service>'
  $ok=$true
  try {Assert-ReprintJournal $raw $job} catch {$ok=$false}
  if($ok -ne $case.ok){throw ('Incorrect validation: '+$case.name)}
}
Write-Host ($cases.Count.ToString()+' closed-day reprint cases passed; target identity checks remain enforced.')
