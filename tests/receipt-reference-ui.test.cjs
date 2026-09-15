const test=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{JSDOM}=require('jsdom');
const root=process.env.OPTYKER_BUILT?'_site/':'';
const tick=()=>new Promise(r=>setTimeout(r,20));
test('customer ID follows selection, ignores stale replies and clears for a new customer',async()=>{
 const dom=new JSDOM('<section id="clientAnagraficaSection"><div class="clientIdentityHeader"></div></section>',{runScripts:'outside-only',url:'https://www.optyker.it'}),w=dom.window;
 try{
  const calls=[];w.OPTYKER_CLOUD={clients:[]};w.clientCurrentId='a';
  w.clientMetadataFromForm=()=>({});w.cloudApi=(action,payload)=>new Promise(resolve=>calls.push({action,payload,resolve}));
  w.clientFillForm=row=>{w.clientCurrentId=row.id};w.clientClearForm=()=>{w.clientCurrentId=''};
  w.eval(readFileSync(root+'client-profile-save.js','utf8'));await tick();
  const label=()=>w.document.getElementById('optykerClientProfileId').textContent;
  w.clientFillForm({id:'b'});await tick();
  calls.find(x=>x.payload.id==='b').resolve({ok:true,data:{id:'b',reference_no:'1629C'}});await tick();assert.equal(label(),'ID cliente: 1629C');
  calls.find(x=>x.payload.id==='a').resolve({ok:true,data:{id:'a',reference_no:'1C'}});await tick();assert.equal(label(),'ID cliente: 1629C');
  w.clientClearForm();assert.match(label(),/assegnato al salvataggio/);assert.ok(!label().includes('1629'));
  w.OPTYKER_CLOUD.clients=[{id:'c',reference_no:'42C'}];w.clientFillForm({id:'c'});assert.equal(label(),'ID cliente: 42C');assert.equal(calls.length,2);
 }finally{await tick();w.close()}
});
async function receipt({complete=false,proof=false}={}){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://www.optyker.it'}),w=dom.window,calls=[];
 let synced=false;
 const job=()=>({id:'job',payment_id:'payment',operation:'sale',serial:'72IV6003831',state:synced&&complete?'completed':'awaiting_reference',total:12.5,...(synced&&complete?{document_number:'1164-0005',document_date:'2026-09-15'}:{}),result:proof?{reference:{source:'rch_ej',serial:'72IV6003831',number:'1164-0005',date:'2026-09-15',amount:12.5}}:{}});
 w.OPTYKER_CLOUD={username:'SYNTHETIC',password:'SYNTHETIC'};w.AbortSignal=AbortSignal;
 w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push({url,b});if(url.endsWith('/receipt/status')){synced=true;return Response.json({ok:true})}if(b.action==='sale')return Response.json({ok:true,data:{payments:[{id:'payment',amount:12.5}],jobs:[job()]}});if(b.action==='job')return Response.json({ok:true,data:{job:job()}});throw Error('Unexpected write')};
 w.eval(readFileSync(root+'fiscal-receipts.js','utf8'));await w.OPTYKER_FISCAL.openSale('sale');return {w,calls};
}
test('amount and verified saved reference prefill; no paper confirmation is invented',async()=>{
 const {w}=await receipt({proof:true});try{const f=w.document.querySelector('.ofReference');assert.equal(f.elements.amount.value,'12.50');assert.equal(f.elements.number.value,'1164-0005');assert.equal(f.elements.date.value,'2026-09-15');assert.equal(f.elements.verified.checked,false)}finally{w.close()}
});
test('automatic outcome synchronization replaces the manual form without printing',async()=>{
 const {w,calls}=await receipt({complete:true});try{assert.equal(w.document.querySelector('.ofReference').elements.amount.value,'12.50');await new Promise(r=>setTimeout(r,500));assert.equal(w.document.querySelector('.ofReference'),null);assert.match(w.document.body.textContent,/1164-0005/);assert.ok(calls.every(x=>x.url.endsWith('/receipt/status')||['sale','job'].includes(x.b.action)))}finally{w.close()}
});
test('pending readback never fabricates a number or erases manual edits',async()=>{
 const {w}=await receipt();try{const f=w.document.querySelector('.ofReference');assert.equal(f.elements.number.value,'');f.elements.number.value='1164-0007';await new Promise(r=>setTimeout(r,500));assert.equal(f.elements.number.value,'1164-0007');assert.equal(f.elements.verified.checked,false)}finally{w.close()}
});
if(process.env.OPTYKER_BUILT)test('production has one current profile and fiscal loader',()=>{
 const dom=new JSDOM(readFileSync('_site/index.html','utf8'));
 for(const [id,version] of [['optykerClientProfileSaveJs','20260915-profile-id'],['optykerFiscalReceiptsJs','20260915-reference2']]){
  const tags=dom.window.document.querySelectorAll('#'+id);assert.equal(tags.length,1);assert.ok(tags[0].src.includes(version));
 }
 dom.window.close();
});
