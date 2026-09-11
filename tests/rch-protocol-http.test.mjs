import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('standalone diagnostic uses real HTTP POSTs, keeps raw replies, never sends fiscal commands', async () => {
  const requests=[];
  const response='<Service><Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request><ECRStatus><mode>Z</mode><idleState>0</idleState></ECRStatus></Service>';
  const server=http.createServer(async (req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    requests.push({method:req.method,url:req.url,headers:req.headers,body});
    res.writeHead(200,{'Content-Type':'application/xml'});res.end(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const script=fileURLToPath(new URL('../rch-connector/Diagnostica-Protocollo-RCH.ps1',import.meta.url));
    const command=`. '${script.replaceAll("'","''")}' -LibraryOnly -PrinterIp '127.0.0.1'; $PrinterUrl='http://127.0.0.1:${server.address().port}/service.cgi'; $r=Get-ProtocolDiagnostic; Write-Output ('REPORT:'+($r|ConvertTo-Json -Depth 20 -Compress))`;
    const child=spawn(process.env.PWSH||'pwsh',['-NoLogo','-NoProfile','-NonInteractive','-Command',command]);
    let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
    const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve)}).finally(()=>clearTimeout(timer));
    assert.equal(code,0,stderr||stdout);
    const line=stdout.split(/\r?\n/).find(x=>x.startsWith('REPORT:'));
    assert.ok(line,stdout);const report=JSON.parse(line.slice(7));
    assert.equal(report.allQueriesAccepted,true);assert.equal(report.compatibilityVerified,false);
    assert.equal(report.emittedFiscalDocument,false);assert.equal(report.fiscalEmissionEnabled,false);
    assert.equal(report.probes.length,7);assert.equal(requests.length,7);
    const expected=['s','f','m','i/*3','d','7','i/*5'];
    requests.forEach((req,i)=>{
      assert.equal(req.method,'POST');assert.equal(req.url,'/service.cgi');
      assert.equal(req.headers['content-type'],'application/xml');
      assert.equal(Number(req.headers['content-length']),Buffer.byteLength(req.body));
      assert.equal(req.headers['transfer-encoding'],undefined);
      assert.equal(req.body,`<?xml version="1.0" encoding="UTF-8"?>\n<Service>\n  <cmd>&lt;&lt;/?${expected[i]}</cmd>\n</Service>\n`);
      assert.equal(report.probes[i].raw,response);
    });
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
