import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('configuration read uses HTTP only after PRG and matching serial, with no write commands', async()=>{
  const request='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><lastCmd>1</lastCmd><busy>0</busy></Request>';
  const state='<ECRStatus><mode>PRG</mode><idleState>0</idleState></ECRStatus>';
  const payloads=[state,'<Enq><name>m</name><value>72IV6003831</value></Enq>','<Enq><name>C</name><value>TEST DATA ONLY</value></Enq>',state];
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    const payload=payloads[requests.length]||'';
    requests.push({method:req.method,url:req.url,headers:req.headers,body});
    res.writeHead(200,{'Content-Type':'application/xml'});res.end('<Service>'+request+payload+'</Service>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const path=fileURLToPath(new URL('../rch-connector/Diagnostica-Configurazione-RCH.ps1',import.meta.url));
    const command=`. '${path.replaceAll("'","''")}' -LibraryOnly -PrinterIp '127.0.0.1'; $PrinterUrl='http://127.0.0.1:${server.address().port}/service.cgi'; $r=Get-RchConfigurationDiagnostic; Write-Output ('REPORT:'+($r|ConvertTo-Json -Depth 24 -Compress))`;
    const child=spawn(process.env.PWSH||'pwsh',['-NoLogo','-NoProfile','-NonInteractive','-Command',command]);
    let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
    const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve)}).finally(()=>clearTimeout(timer));
    assert.equal(code,0,stderr||stdout);
    const reportLine=stdout.split(/\r?\n/).find(x=>x.startsWith('REPORT:'));assert.ok(reportLine,stdout);
    const report=JSON.parse(reportLine.slice(7));
    assert.equal(report.collectionCompleted,true);assert.equal(report.identityMatched,true);
    for(const key of ['programmingVerified','fiscalEmissionEnabled','emittedFiscalDocument','changedMode','changedProgramming','tsSubmitted'])assert.equal(report[key],false,key);
    assert.equal(requests.length,4);assert.equal(report.probes.length,4);
    ['s','m','C','s'].forEach((cmd,i)=>{
      const r=requests[i];assert.equal(r.method,'POST');assert.equal(r.url,'/service.cgi');
      assert.equal(r.headers['content-type'],'application/xml');assert.equal(r.headers['transfer-encoding'],undefined);
      assert.equal(Number(r.headers['content-length']),Buffer.byteLength(r.body));
      assert.equal(r.body,`<?xml version="1.0" encoding="UTF-8"?>\n<Service>\n  <cmd>&lt;&lt;/?${cmd}</cmd>\n</Service>\n`);
    });
    assert.ok(report.probes[2].values.some(x=>x.path==='Service/Enq/value'&&x.value==='TEST DATA ONLY'));
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
