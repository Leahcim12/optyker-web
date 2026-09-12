import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const pwsh=process.env.PWSH;
test('local bridge blocks fiscal issuance and foreign origins, accepts UTF-8 and creates honest offline diagnostics',{skip:!pwsh,timeout:20000},async()=>{
  const slot=createServer();slot.listen(0,'127.0.0.1');await once(slot,'listening');const port=slot.address().port;await new Promise(r=>slot.close(r));
  const child=spawn(pwsh,['-NoProfile','-File','rch-connector/rch-optyker-connector.ps1','-Port',String(port),'-PrinterIp','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',b=>stderr+=b);
  const base=`http://127.0.0.1:${port}`,origin='https://www.optyker.it';
  try {
    let ready=false;
    for(let i=0;i<60;i++){try {await fetch(base+'/health');ready=true;break}catch{}await delay(100)}
    assert.ok(ready,stderr);
    const health=await fetch(base+'/health',{headers:{origin}});
    assert.equal(health.headers.get('access-control-allow-origin'),origin);
    const capabilities=(await health.json()).capabilities;
    assert.equal(capabilities.receipt,false);assert.equal(capabilities.voidReceipt,false);assert.equal(capabilities.adeOutcome,false);
    const blocked=await fetch(base+'/drawer',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'});
    assert.equal(blocked.status,403);assert.equal(blocked.headers.get('access-control-allow-origin'),null);
    const preflight=await fetch(base+'/receipt',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}});
    assert.equal(preflight.status,200);
    const receipt=await fetch(base+'/receipt',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({description:'Occhiali più custodia €'})});
    assert.equal(receipt.status,409);assert.equal((await receipt.json()).emittedFiscalDocument,false);
    const voidReceipt=await fetch(base+'/receipt/void',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
    assert.equal(voidReceipt.status,409);assert.equal((await voidReceipt.json()).emittedFiscalDocument,false);
    const drawerGet=await fetch(base+'/drawer',{headers:{origin}});assert.equal(drawerGet.status,404);
    const report=await (await fetch(base+'/diagnostics',{headers:{origin}})).json();
    assert.equal(report.reportGenerated,true);assert.equal(report.printerReached,false);assert.equal(report.statusAccepted,false);assert.equal(report.printerReady,false);assert.equal(report.readOnly,true);assert.equal(report.emittedFiscalDocument,false);assert.ok(Array.isArray(report.probes));
    assert.equal(stderr,'');
  } finally {child.kill('SIGTERM');await once(child,'exit')}
});

test('printer transport sends one complete XML body without Expect handshake or chunking',{skip:!pwsh,timeout:10000},async()=>{
  const recorded=[];
  const server=createHttpServer((req,res)=>{
    const parts=[];req.on('data',b=>parts.push(b));req.on('end',()=>{
      recorded.push({method:req.method,url:req.url,headers:req.headers,body:Buffer.concat(parts)});
      res.writeHead(200,{'Content-Type':'application/xml'});
      res.end(readFileSync('tests/fixtures/rch-error-101.xml'));
    });
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;
  const command=`. ./rch-connector/rch-optyker-connector.ps1 -LibraryOnly; $PrinterUrl='http://127.0.0.1:${port}/service.cgi'; Send-RchCommand '<</?s'`;
  const child=spawn(pwsh,['-NoProfile','-Command',command],{stdio:['ignore','pipe','pipe'],timeout:5000});
  let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();
  try {
    const [code]=await once(child,'exit');assert.equal(code,0,stderr);
    assert.equal(recorded.length,1);const r=recorded[0];
    assert.equal(r.method,'POST');assert.equal(r.url,'/service.cgi');
    assert.equal(r.headers['content-type'],'application/xml');assert.equal(r.headers.expect,undefined);
    assert.equal(r.headers['transfer-encoding'],undefined);assert.equal(r.headers.connection,'close');
    assert.equal(Number(r.headers['content-length']),r.body.length);
    assert.match(r.body.toString('utf8'),/\n<Service>\n  <cmd>&lt;&lt;\/\?s<\/cmd>\n<\/Service>\n$/);
  } finally {child.kill();await new Promise(r=>server.close(r))}
});
