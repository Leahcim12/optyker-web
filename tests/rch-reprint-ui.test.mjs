import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url);
const {JSDOM}=require('jsdom');
const source=readFileSync(new URL('../fiscal-receipts.js',import.meta.url),'utf8');
for(const capability of [true,false])test('selected receipt uses RCH and handles installed capability '+capability,async()=>{
 const dom=new JSDOM('<body></body>',{url:'https://optyker.it',runScripts:'outside-only'}),w=dom.window,calls=[];
 try{
  w.AbortSignal=AbortSignal;w.OPTYKER_CLOUD={username:'test',password:'test'};w.print=()=>{throw new Error('Browser print forbidden')};w.open=()=>{throw new Error('PDF forbidden')};
  w.fetch=async(url,opts={})=>{
   const body=opts.body?JSON.parse(opts.body):{};calls.push({url,body});let data;
   if(body.action==='sale')data={ok:true,data:{jobs:[{id:'first',state:'completed',document_number:'1162-0017',document_date:'2026-09-13',total:10},{id:'second',state:'completed',document_number:'1162-0018',document_date:'2026-09-13',total:20},{id:'uncertain',state:'uncertain'}]}};
   else if(url.endsWith('/health'))data={ok:true,version:'1.9-pos',capabilities:{reprintReceipt:capability}};
   else if(url.endsWith('/receipt/reprint'))data={ok:true,reprinted:true};
   else throw new Error('Unexpected fiscal write '+url);
   return {ok:true,json:async()=>data};
  };
  w.eval(source);await w.OPTYKER_RCH_REPRINT.openSale('sale');
  const buttons=w.document.querySelectorAll('.ofBody button');assert.equal(buttons.length,2);
  await buttons[1].onclick();
  const prints=calls.filter(c=>c.url.endsWith('/receipt/reprint'));
  assert.equal(prints.length,capability?1:0);
  if(capability){assert.equal(prints[0].body.jobId,'second');assert.match(w.document.body.textContent,/Ristampa confermata/)}
  else assert.match(w.document.querySelector('.ofMessage a').href,/Aggiorna-Ristampa-RCH.bat/);
  assert.equal(buttons[1].disabled,false);
 }finally{dom.window.close()}
});
