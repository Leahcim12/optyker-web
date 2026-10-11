$ErrorActionPreference='Stop'
# Synthetic RCH: verifies the daily closure outcome and the automatic return to REG
# of the Cloud Relay. No network, no printer, no fiscal command reaches a device.
$env:LOCALAPPDATA=Join-Path ([System.IO.Path]::GetTempPath()) ('optyker-worker-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA | Out-Null
. (Join-Path $PSScriptRoot '../rch-connector/rch-optyker-cloud-worker.ps1') -LibraryOnly
function Assert($value,[string]$message){if(-not $value){throw ('FAILED: '+$message)}}

$script:ack='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>'
$script:sale1197=@'
             DOCUMENTO COMMERCIALE
            di vendita o prestazione
ARTICOLO A                      22%       10,00
TOTALE COMPLESSIVO                         10,00
                10-10-2026 20:01
             DOCUMENTO N. 1197-0010
                *** 72IV6003831
'@
function ClosureDoc([int]$number){
  return @"
              DOCUMENTO GESTIONALE
            di chiusura giornaliera
VENDITE                                  100,00
CHIUSURA GIORNALIERA N.                     $number
                10-10-2026 20:05
          DOC.GESTIONALE N. $number-0011
                  72IV6003831
"@
}
function Reset-Rch([string]$scenario,[string]$lastDocument){
  $script:scenario=$scenario;$script:mode='REG';$script:busy=0;$script:printerError=0
  $script:journal=$lastDocument;$script:commands=New-Object 'System.Collections.Generic.List[string]'
  $script:statusFails=$false;$script:regRefused=$false;$script:refuseRegAfterClosure=$false
}
function Invoke-LocalGet([string]$path){
  if($script:statusFails){throw 'connector offline'}
  if($path -eq '/health'){return [pscustomobject]@{ok=$true;capabilities=[pscustomobject]@{automaticVoidReference=$true}}}
  return [pscustomobject]@{ok=($script:printerError -eq 0 -and $script:busy -eq 0);mode=$script:mode;idleState='0';errorCode=0;printerError=$script:printerError;paperEnd=0;coverOpen=0;busy=$script:busy;lastCmd=1;error=''}
}
function Wait-RchStatus([scriptblock]$predicate,[int]$timeoutMs){
  $s=Public-CloudStatus (Invoke-LocalGet '/status')
  return $s
}
function Start-Sleep {param([int]$Seconds,[int]$Milliseconds)}
function Write-RelayLog([string]$message){$script:log.Add($message)}
function Invoke-ExactPrinterCommand([string]$command){
  if($command -cnotin @('=C1','=C3','=C10','=C453/$0')){throw 'Comando RCH non autorizzato dal Cloud Relay.'}
  $script:commands.Add($command)
  if($command -ceq '=C3'){$script:mode='Z'}
  if($command -ceq '=C1'){
    if($script:regRefused -or ($script:refuseRegAfterClosure -and ($script:commands -contains '=C10'))){throw '=C1: RCH errorCode 3.'}
    $script:mode='REG'
  }
  if($command -ceq '=C453/$0'){
    Assert ($script:mode -ceq 'Z') 'journal must be read in Z'
    if($script:scenario -eq 'journal-unreadable'){throw '=C453/$0: RCH errorCode 17.'}
    if($script:scenario -eq 'journal-after-unreadable' -and ($script:commands -contains '=C10')){throw '=C453/$0: RCH errorCode 17.'}
    return '<Service>'+$script:ack+'<EJ>'+[Security.SecurityElement]::Escape($script:journal)+'</EJ></Service>'
  }
  if($command -ceq '=C10'){
    Assert ($script:mode -ceq 'Z') 'closure must be sent in Z'
    switch($script:scenario){
      'ack' {$script:journal=(ClosureDoc 1197)}
      'lost-after-execution' {$script:journal=(ClosureDoc 1197);throw 'Connessione sottostante chiusa.'}
      'lost-not-executed' {throw 'Connessione sottostante chiusa.'}
      'journal-after-unreadable' {$script:journal=(ClosureDoc 1197);throw 'Connessione sottostante chiusa.'}
      'journal-unreadable' {$script:journal=(ClosureDoc 1197);throw 'Connessione sottostante chiusa.'}
      'wrong-number' {$script:journal=(ClosureDoc 1190);throw 'Connessione sottostante chiusa.'}
      'empty-day' {$script:journal=(ClosureDoc 1198);throw 'Connessione sottostante chiusa.'}
      'printer-error' {$script:printerError=1;throw '=C10: RCH printerError 1.'}
      default {throw 'unexpected scenario'}
    }
  }
  return '<Service>'+$script:ack+'</Service>'
}
$script:log=New-Object 'System.Collections.Generic.List[string]'

# --- Journal parsing --------------------------------------------------------------
Assert ((Get-ExpectedClosureNumber $script:sale1197) -eq 1197) 'last sale 1197-0010 means closure 1197'
Assert ((Get-ExpectedClosureNumber (ClosureDoc 1197)) -eq 1198) 'last closure 1197 means next closure 1198'
Assert ($null -eq (Get-ExpectedClosureNumber 'TESTO SENZA NUMERI')) 'unknown document gives no expectation'
Assert ($null -eq (Get-ExpectedClosureNumber ($script:sale1197+"`n"+$script:sale1197))) 'two documents are ambiguous'
Assert ((Test-ClosureInJournal $script:sale1197 $script:sale1197 1197) -eq $false) 'unchanged journal is not a closure'
Assert ((Test-ClosureInJournal $script:sale1197 (ClosureDoc 1197) 1197) -eq $true) 'closure with expected number is confirmed'
Assert ($null -eq (Test-ClosureInJournal $script:sale1197 (ClosureDoc 1196) 1197)) 'wrong closure number is not confirmed'
Assert ($null -eq (Test-ClosureInJournal $script:sale1197 (ClosureDoc 1197) $null)) 'no expectation means no confirmation'

# --- Daily closure ----------------------------------------------------------------
$cases=@(
  @{name='ack';doc=$script:sale1197;state='completed';ok=$true;executed=$true;by='rch_ack';reg=$true},
  @{name='lost-after-execution';doc=$script:sale1197;state='completed';ok=$true;executed=$true;by='journal';reg=$true},
  @{name='empty-day';doc=(ClosureDoc 1197);state='completed';ok=$true;executed=$true;by='journal';reg=$true},
  @{name='lost-not-executed';doc=$script:sale1197;state='failed';ok=$false;executed=$false;by=$null;reg=$true},
  @{name='journal-after-unreadable';doc=$script:sale1197;state='uncertain';ok=$false;executed=$null;by=$null;reg=$false},
  @{name='journal-unreadable';doc=$script:sale1197;state='uncertain';ok=$false;executed=$null;by=$null;reg=$false},
  @{name='wrong-number';doc=$script:sale1197;state='uncertain';ok=$false;executed=$null;by=$null;reg=$false},
  @{name='printer-error';doc=$script:sale1197;state='uncertain';ok=$false;executed=$null;by=$null;reg=$false}
)
foreach($case in $cases){
  Reset-Rch $case.name $case.doc
  $r=Close-DailyManual
  Assert ($r.state -eq $case.state) ($case.name+': state '+$r.state)
  Assert ($r.ok -eq $case.ok) ($case.name+': ok')
  if($null -eq $case.executed){Assert ($null -eq $r.dailyClosureExecuted) ($case.name+': executed must stay unknown')}
  else{Assert ($r.dailyClosureExecuted -eq $case.executed) ($case.name+': executed')}
  if($case.by){Assert ($r.confirmedBy -eq $case.by) ($case.name+': confirmedBy '+$r.confirmedBy)}
  Assert ((@($script:commands | Where-Object {$_ -ceq '=C10'})).Count -eq 1) ($case.name+': exactly one closure command')
  Assert ($script:commands[0] -ceq '=C3') ($case.name+': Z selected first')
  if($case.reg){
    Assert ($script:mode -ceq 'REG') ($case.name+': RCH back in REG')
    Assert ($r.returnedToReg -eq $true) ($case.name+': returnedToReg')
    Assert ($script:commands[$script:commands.Count-1] -ceq '=C1') ($case.name+': last command is =C1')
  }else{
    Assert (-not ($script:commands -contains '=C1')) ($case.name+': uncertain closure keeps the RCH untouched for verification')
  }
  Assert ($r.workerRevision -eq '2.3-reg-auto') ($case.name+': revision reported')
}
# A refused REG after a confirmed closure still reports the executed closure.
Reset-Rch 'ack' $script:sale1197;$script:refuseRegAfterClosure=$true
$r=Close-DailyManual
$script:refuseRegAfterClosure=$false
Assert ($r.ok -eq $true -and $r.dailyClosureExecuted -eq $true) 'closure confirmed even if REG is refused'
Assert ($r.returnedToReg -eq $false -and $r.mode -ceq 'Z') 'REG failure is reported, not hidden'

# Not in REG before the closure: nothing is sent.
Reset-Rch 'ack' $script:sale1197;$script:mode='Z'
$failed=$false;try{$null=Close-DailyManual}catch{$failed=$true}
Assert $failed 'closure refused when the RCH is not ready in REG'
Assert ($script:commands.Count -eq 0) 'no command when the closure is refused'

# --- Automatic return to REG --------------------------------------------------------
function ZStatus([int]$busy=0){return @{ok=($busy -eq 0);mode='Z';idleState='0';errorCode=0;printerError=0;paperEnd=0;coverOpen=0;busy=$busy;lastCmd=1;error=''}}
function RegStatus {return @{ok=$true;mode='REG';idleState='0';errorCode=0;printerError=0;paperEnd=0;coverOpen=0;busy=0;lastCmd=1;error=''}}
$t0=[DateTime]::UtcNow
Reset-Rch 'auto' $script:sale1197;$script:mode='Z';$script:ZIdleSince=$null;$script:AutoRegBlockedUntil=[DateTime]::MinValue
Assert ($null -eq (Invoke-AutoReg (ZStatus) $t0)) 'first Z observation only starts the timer'
Assert ($null -eq (Invoke-AutoReg (ZStatus) $t0.AddSeconds(20))) 'no change before the delay'
Assert ($script:commands.Count -eq 0) 'nothing sent before the delay'
Assert ((Invoke-AutoReg (ZStatus) $t0.AddSeconds(50)) -eq $true) 'Z idle for 50 seconds goes back to REG'
Assert ($script:commands.Count -eq 1 -and $script:commands[0] -ceq '=C1' -and $script:mode -ceq 'REG') 'only =C1 is sent'

# Busy or REG resets the timer.
Reset-Rch 'auto' $script:sale1197;$script:mode='Z';$script:ZIdleSince=$null
$null=Invoke-AutoReg (ZStatus) $t0
$null=Invoke-AutoReg (ZStatus 1) $t0.AddSeconds(30)
Assert ($null -eq (Invoke-AutoReg (ZStatus) $t0.AddSeconds(60))) 'busy RCH restarts the timer'
Assert ($script:commands.Count -eq 0) 'no command while busy'
$null=Invoke-AutoReg (RegStatus) $t0.AddSeconds(61)
Assert ($null -eq $script:ZIdleSince) 'REG clears the timer'

# Disabled by file.
Reset-Rch 'auto' $script:sale1197;$script:mode='Z';$script:ZIdleSince=$null
New-Item -ItemType Directory -Force -Path $Base | Out-Null
$flag=Join-Path $Base 'auto-reg-disabled';New-Item -ItemType File -Force -Path $flag | Out-Null
$null=Invoke-AutoReg (ZStatus) $t0;$null=Invoke-AutoReg (ZStatus) $t0.AddSeconds(100)
Assert ($script:commands.Count -eq 0) 'auto-reg-disabled keeps the manual behaviour'
Remove-Item -LiteralPath $flag -Force

# A receipt being sent is never interrupted.
Reset-Rch 'auto' $script:sale1197;$script:mode='Z';$script:ZIdleSince=$null
$receipts=Join-Path $Base 'receipts';New-Item -ItemType Directory -Force -Path $receipts | Out-Null
$active=Join-Path $receipts '00000000-0000-0000-0000-000000000001.json'
Set-Content -LiteralPath $active -Value '{"state":"sending"}'
$null=Invoke-AutoReg (ZStatus) $t0;$null=Invoke-AutoReg (ZStatus) $t0.AddSeconds(100)
Assert ($script:commands.Count -eq 0) 'no mode change while a receipt is being sent'
Set-Content -LiteralPath $active -Value '{"state":"completed"}'

# Printer lock held by the connector: skip this cycle.
Reset-Rch 'auto' $script:sale1197;$script:mode='Z';$script:ZIdleSince=$null
$held=Open-PrinterLock
try{$null=Invoke-AutoReg (ZStatus) $t0;$skipped=Invoke-AutoReg (ZStatus) $t0.AddSeconds(100)}finally{$held.Dispose()}
Assert ($null -eq $skipped -and $script:commands.Count -eq 0) 'locked printer is left alone'

# Refused =C1: back off for 5 minutes.
Reset-Rch 'auto' $script:sale1197;$script:mode='Z';$script:ZIdleSince=$null;$script:AutoRegBlockedUntil=[DateTime]::MinValue;$script:regRefused=$true
$null=Invoke-AutoReg (ZStatus) $t0
Assert ((Invoke-AutoReg (ZStatus) $t0.AddSeconds(50)) -eq $true) 'refused attempt is reported'
$count=$script:commands.Count
$null=Invoke-AutoReg (ZStatus) $t0.AddSeconds(60);$null=Invoke-AutoReg (ZStatus) $t0.AddSeconds(200)
Assert ($script:commands.Count -eq $count) 'no retry during the back-off'
$script:regRefused=$false
$null=Invoke-AutoReg (ZStatus) $t0.AddSeconds(400)
Assert ($script:mode -ceq 'REG') 'retry after the back-off'

# Status published to Optyker carries the revision.
Reset-Rch 'auto' $script:sale1197
$s=Read-LocalStatus
Assert ($s.workerRevision -eq '2.3-reg-auto' -and $s.autoReg -eq $true -and $s.automaticVoidReference -eq $true) 'status carries revision and auto REG flag'

Remove-Item -LiteralPath $env:LOCALAPPDATA -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'PASS Cloud Relay 2.3: closure verified on the journal, REG after closure, automatic REG from idle Z.'
