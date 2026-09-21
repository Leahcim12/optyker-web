"""Fix diagnostic transport: configure BEFORE opening the stream. No new RCH command."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'rch-pending-v2-check/Verifica-Giornale-V2.ps1'
ps=source.read_text(encoding='utf-8-sig')
assert "$DiagnosticVersion='20260921-pending-read2'" in ps
before=ps
configuration="""  $request.Proxy=$null;$request.AllowAutoRedirect=$false;$request.KeepAlive=$false
  $request.Timeout=10000;$request.ReadWriteTimeout=10000;$request.ServicePoint.Expect100Continue=$false
"""
assert ps.count(configuration)==1
ps=ps.replace(configuration,'',1)
factory="""# Configure once, before GetRequestStream starts the HttpWebRequest.
# The response reader must never set Proxy or other request properties.
function New-DiagnosticHttpRequest([string]$url,[string]$method){
  $request=[Net.HttpWebRequest]::Create($url)
  $request.Method=$method
  $request.Proxy=$null;$request.AllowAutoRedirect=$false;$request.KeepAlive=$false
  $request.SendChunked=$false
  $request.Timeout=10000;$request.ReadWriteTimeout=10000;$request.ServicePoint.Expect100Continue=$false
  return $request
}
"""
ps=ps.replace('function Read-LimitedHttp($request){',factory+'function Read-LimitedHttp($request){',1)
old="$req=[Net.HttpWebRequest]::Create('http://127.0.0.1:8765/health');$req.Method='GET'"
assert ps.count(old)==1
ps=ps.replace(old,"$req=New-DiagnosticHttpRequest 'http://127.0.0.1:8765/health' 'GET'",1)
old="""  $req=[Net.HttpWebRequest]::Create(('http://'+$script:PrinterIp+'/service.cgi'))
  $req.Method='POST';$req.ContentType='application/xml';$req.ContentLength=$bytes.Length
  $req.Proxy=$null;$req.AllowAutoRedirect=$false;$req.KeepAlive=$false;$req.SendChunked=$false
  $req.Timeout=10000;$req.ReadWriteTimeout=10000;$req.ServicePoint.Expect100Continue=$false
"""
new="""  $req=New-DiagnosticHttpRequest ('http://'+$script:PrinterIp+'/service.cgi') 'POST'
  $req.ContentType='application/xml';$req.ContentLength=$bytes.Length
"""
assert ps.count(old)==1
ps=ps.replace(old,new,1)
ps=ps.replace('20260921-pending-read2','20260921-pending-read3')
ps=ps.replace('Optyker-Verifica-Giornale-V2','Optyker-Verifica-Giornale-V3').replace('SETTEMBRE (V2)','SETTEMBRE (V3)')
a=before[before.index('function Get-StatusEvidence('):before.index('function Save-PendingReport(')]
b=ps[ps.index('function Get-StatusEvidence('):ps.index('function Save-PendingReport(')]
assert a==b,'Evidence, lock or recovery logic changed'
reader=ps[ps.index('function Read-LimitedHttp('):ps.index('function Read-BridgeHealth')]
assert '$request.Proxy=' not in reader and '$request.Timeout=' not in reader
folder=ROOT/'rch-pending-v3-check';folder.mkdir(exist_ok=True)
(folder/'Verifica-Giornale-V3.ps1').write_text(ps,encoding='utf-8-sig',newline='\n')
oldbat=(ROOT/'rch-pending-v2-check/Optyker-Verifica-Giornale-V2.bat').read_text(encoding='utf-8-sig')
marker='# OPTYKER_PS_BEGIN\n';header=oldbat[:oldbat.rindex(marker)+len(marker)]
output=folder/'Optyker-Verifica-Giornale-V3.bat'
output.write_bytes((header+ps).replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))
(folder/'manifest.json').write_text(json.dumps({'version':'20260921-pending-read3','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'replaces':'20260921-pending-read2','change':'Configure HTTP before request stream; response reader does not mutate request','sameFiscalCommands':True,'productionConnectorChanged':False},indent=2)+'\n')
print('V3 BUILT',hashlib.sha256(output.read_bytes()).hexdigest())
