$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$path=Join-Path $root 'rch-connector/rch-optyker-connector.ps1'
$installer=Join-Path $root 'rch-connector/Aggiorna-Annulli-Verificato.ps1'
$verified=[IO.File]::ReadAllText($path,[Text.Encoding]::UTF8)
. $installer -LibraryOnly
function Assert([bool]$value,[string]$message){if(-not $value){throw $message}}
function Reject([scriptblock]$action,[string]$label){$rejected=$false;try{& $action | Out-Null}catch{$rejected=$true};Assert $rejected ('Expected rejection: '+$label)}
$null=Assert-RchScript $verified
Write-Host ('PASS corrected source parses on Windows PowerShell '+$PSVersionTable.PSVersion)
$patched=New-RchVoidSource $verified $verified
Assert ($patched -ceq $verified) 'Patch must be idempotent'
Write-Host 'PASS idempotent installation'
$legacy=[regex]::Replace($verified,'(?s)# BEGIN OPTYKER_RCH_REFERENCE_V2\b.*?# END OPTYKER_RCH_REFERENCE_V2\b','')
$legacy=[regex]::Replace($legacy,'(?s)# BEGIN OPTYKER_REFERENCE_(?:BEFORE|AFTER)_V2\b.*?# END OPTYKER_REFERENCE_(?:BEFORE|AFTER)_V2\b','')
$legacy=$legacy.Replace(';automaticVoidReference=$true','')
$legacy=$legacy.Replace("if(`$LibraryOnly){return}","function Custom-InstalledFeature { return 'PRESERVED-QR-POS' }`r`nif(`$LibraryOnly){return}")
$new=New-RchVoidSource $legacy $verified
$ast=Assert-RchScript $new
Assert ($new.Contains('automaticVoidReference=$true')) 'Capability missing'
Assert ($new.Contains('PRESERVED-QR-POS')) 'Custom feature lost'
Assert ($new -eq (New-RchVoidSource $new $verified)) 'Repeated update changed content'
Write-Host 'PASS legacy installation, custom features and repeated update'
Reject {New-RchVoidSource ($legacy.Replace('function Diagnostics-Rch {','function Other-Diagnostic {')) $verified} 'missing anchor'
Reject {New-RchVoidSource ($verified+"`n# BEGIN OPTYKER_RCH_REFERENCE_V2`n# END OPTYKER_RCH_REFERENCE_V2") $verified} 'duplicate evidence block'
Reject {New-RchVoidSource "throw 'unterminated" $verified} 'invalid installed source'
Write-Host 'PASS fail closed on unknown or malformed source'
# Readback parser tests, entirely in memory. Network calls are forbidden.
. $path -LibraryOnly
function Send-RchCommand {throw 'TEST: real RCH command forbidden'}
function Request-Printer {throw 'TEST: real RCH HTTP forbidden'}
$sample=@'
<Service><Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request><EJ>DOCUMENTO COMMERCIALE DI ANNULLAMENTO
Riferimento 0001-0001 del 17-09-2026
TEST000123
TOTALE COMPLESSIVO 70,00
DOCUMENTO N. 0001-0002
17-09-2026 20:00
</EJ></Service>
'@
$doc=@{serial='TEST000123';operation='void';totalCents=7000;original=@{number='0001-0001';date='2026-09-17'}}
$e=Get-ReceiptEvidence $sample $doc $false
Assert ($e.documentKind -eq 'void' -and $e.number -eq '0001-0002' -and $e.totalCents -eq 7000) 'Void evidence not recognized'
Reject {Get-ReceiptEvidence ($sample.Replace('70,00','71,00')) $doc $false} 'wrong total'
Reject {Get-ReceiptEvidence ($sample.Replace('Riferimento 0001-0001','Riferimento 0001-0099')) $doc $false} 'wrong original'
Reject {Get-ReceiptEvidence ($sample.Replace('DOCUMENTO N. 0001-0002','DOCUMENTO N. 0001-0001')) $doc $false} 'same document number'
Reject {Get-ReceiptEvidence ($sample.Replace('ANNULLAMENTO','RESO')) $doc $false} 'return not cancellation'
Reject {Get-ReceiptEvidence ($sample.Replace('<busy>0','<busy>1')) $doc $false} 'busy response'
Write-Host 'PASS six synthetic receipt-evidence tests; zero fiscal writes'
# Exercise the actual updater against an isolated local fixture on Windows.
$oldLocal=$env:LOCALAPPDATA
$env:LOCALAPPDATA=Join-Path $env:RUNNER_TEMP ('optyker-fixture-'+[guid]::NewGuid().ToString('N'))
$base=Join-Path $env:LOCALAPPDATA 'OptykerRCH'
$target=Join-Path $base 'rch-optyker-connector.ps1'
$child=$null
try{
 New-Item -ItemType Directory -Path (Join-Path $base 'receipts') -Force | Out-Null
 $fixtureAst=Assert-RchScript $legacy
 $statusFn=$fixtureAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Status-Rch'},$true)
 $stub="function Status-Rch { return [pscustomobject]@{ok=`$true;mode='REG';idleState='0';busy=0;errorCode=0;printerError=0;paperEnd=0;coverOpen=0;lastCmd=1} }"
 $fixture=Replace-RchRange $legacy $statusFn.Extent.StartOffset ($statusFn.Extent.EndOffset-$statusFn.Extent.StartOffset) $stub
 # Make any attempted printer transport fail immediately, even in this fixture.
 $fAst=Assert-RchScript $fixture
 $fn=$fAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Request-Printer'},$true)
 $fixture=Replace-RchRange $fixture $fn.Extent.StartOffset ($fn.Extent.EndOffset-$fn.Extent.StartOffset) "function Request-Printer { throw 'TEST: printer transport forbidden' }"
 [IO.File]::WriteAllText($target,$fixture,(New-Object Text.UTF8Encoding($true)))
 $journalFile=Join-Path $base 'receipts/test-evidence.json'
 $evidence='{"state":"uncertain","test_only":true,"evidence":"keep-exactly"}'
 [IO.File]::WriteAllText($journalFile,$evidence)
 $exe=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $child=Start-RchConnector $exe $target '127.0.0.2' 8765
 $null=Wait-RchHealth 8765
 Install-RchVoid
 $health=Read-RchHealth 8765
 Assert ($health.capabilities.automaticVoidReference -eq $true) 'Installed capability false'
 Assert ($health.printer -eq '127.0.0.2') 'Configured printer address lost'
 Assert ([IO.File]::ReadAllText($journalFile) -ceq $evidence) 'Journal was changed'
 Assert (([IO.File]::ReadAllText($target)).Contains('PRESERVED-QR-POS')) 'Custom feature lost in installation'
 Assert (@(Get-ChildItem $base -Filter '*.prima-annulli-*').Count -eq 1) 'Backup missing'
 Write-Host 'PASS isolated install/restart/health; original journal and settings preserved'
 # Block active journal before stopping anything.
 [IO.File]::WriteAllText($journalFile,'{"state":"sending","test_only":true}')
 $savedHash=(Get-FileHash $target).Hash
 Reject {Install-RchVoid} 'active journal'
 Assert ((Get-FileHash $target).Hash -eq $savedHash) 'Blocked install changed connector'
 Assert ((Read-RchHealth 8765).ok -eq $true) 'Blocked install stopped connector'
 Write-Host 'PASS active fiscal journal prevents file replacement and restart'
}finally{
 Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($target)} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
 $env:LOCALAPPDATA=$oldLocal
}
Write-Host 'ALL WINDOWS POWERSHELL 5.1 TESTS PASSED'
