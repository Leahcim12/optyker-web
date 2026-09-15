import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(process.env.OPTYKER_TEST_PACKAGE || import.meta.url);
const {JSDOM} = require('jsdom');
const site = resolve(process.env.OPTYKER_TEST_SITE || '_site');
const cid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const original = {reference_no:'42C',id:cid,name:'Cliente',surname:'Prova',fiscal:'',email:'client@example.invalid',phone:'111',notes:'Nota iniziale'};
const until = async f => { for(let i=0;i<70;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}assert.fail('State not reached'); };
async function setup() {
  const html = readFileSync(resolve(site,'index.html'),'utf8');
  const dom = new JSDOM(html,{url:'https://www.optyker.it',runScripts:'outside-only'}), w=dom.window;
  const el=id=>w.document.getElementById(id), calls=[], rows=new Map([[cid,{...original}]]);
  const state={failure:false,empty:false,delay:null};
  Object.assign(w,{CLIENT_ARCHIVE_VERSION:1,clientCurrentId:'',OPTYKER_CLOUD:{root:'https://example.test',key:'TEST_PUBLISHABLE',username:'SYNTHETIC OPERATOR',password:'SYNTHETIC PASSWORD',clients:[],sheets:{},consents:{}}});
  w.g=el;w.rxVal=id=>el(id)?.value||'';w.trimText=v=>String(v||'').trim();w.clientNewId=()=> 'C_TEST_NEW';w.clientNowIso=()=> '2026-09-13T16:00:00';
  for(const name of ['clientUpdateWorkspaceHeader','clientUpdateBanner','clientApplyToCurrentPatient','clientRefreshList','dashboardRenderClients','clientRenderVisits','clientRenderInformativeDocs']) w[name]=()=>{};
  // Use the real form mapping and cloud request implementation from the assembled app.
  for(const name of ['clientMetadataFromForm','clientFillForm','clientClearForm','cloudApi','cloudDbToClient','cloudClientPayload']) {
    const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);
    const end=html.indexOf('\nfunction ',start+1);assert.ok(end>start,name);
    w.eval(html.slice(start,end));
  }
  w.fetch=async (url,options)=>{
    assert.equal(url,'https://example.test/rest/v1/rpc/optyker_api');
    const req=JSON.parse(options.body);calls.push(req);assert.equal(req.p_username,'SYNTHETIC OPERATOR');
    if(req.p_action==='get_client')return Response.json({ok:true,data:rows.get(req.p_payload.id)});
    assert.equal(req.p_action,'save_client');
    if(state.delay)await state.delay;
    if(state.failure)throw Error('Connessione interrotta');
    if(state.empty)return Response.json({ok:true,data:null});
    const p=req.p_payload,id=p.id||other,row={...rows.get(id),...p,id,updated_at:'2026-09-13T16:00:01Z'};
    rows.set(id,row);return Response.json({ok:true,data:row});
  };
  w.OPTYKER_CLOUD.clients=[w.cloudDbToClient(original)];w.clientFillForm(w.OPTYKER_CLOUD.clients[0]);
  w.eval(readFileSync(resolve(site,'client-profile-save.js'),'utf8'));
  if(!el('optykerClientSaveButton'))w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await until(()=>el('optykerClientSaveButton'));
  function edit(id,value){el(id).value=value;el(id).dispatchEvent(new w.Event('input',{bubbles:true}));}
  return {dom,w,el,calls,rows,state,edit};
}
test('visible save updates existing client, all form fields, CF cache and reloaded record',async()=>{
  const x=await setup();try{
    const {w,el,calls,edit}=x;
    assert.equal(el('optykerClientSaveButton').textContent,'Salva modifiche');
    assert.equal(el('optykerClientSaveButton').closest('#clientAnagraficaSection')?.id,'clientAnagraficaSection');
    const fields={clientDbName:'Mario',clientDbSurname:'Rossi',clientDbBirth:'01/01/1980',clientDbFiscal:'rssmra80a01h501u',clientDbPhone:'222',clientDbPhoneHome:'333',clientDbEmail:'mario@example.invalid',clientDbPec:'mario@pec.invalid',clientDbStreet:'Via Prova',clientDbStreetNumber:'4',clientDbZip:'24040',clientDbCity:'Lallio',clientDbProvince:'bg',clientDbVat:'TEST VAT',clientDbProfession:'Test',clientDbHobby:'Hobby',clientDbReferral:'Passaparola',clientDbNotes:'Note aggiornate'};
    Object.entries(fields).forEach(([id,value])=>edit(id,value));
    assert.equal(el('optykerClientSaveStatus').textContent,'Modifiche da salvare');
    el('optykerClientSaveButton').click();
    await until(()=>el('optykerClientSaveBar').dataset.state==='saved');
    const writes=calls.filter(c=>c.p_action==='save_client');assert.equal(writes.length,1);assert.equal(writes[0].p_payload.id,cid);
    assert.equal(el('optykerClientProfileId').textContent,'ID cliente: 42C');
    assert.equal(w.OPTYKER_CLOUD.clients[0].fiscal,'RSSMRA80A01H501U');
    const read=await w.cloudApi('get_client',{id:cid});
    w.clientClearForm(false);w.clientFillForm(w.cloudDbToClient(read.data));
    for(const [id,value] of Object.entries(fields))assert.equal(el(id).value,id==='clientDbFiscal'||id==='clientDbProvince'?value.toUpperCase():value,id);
    assert.equal(w.clientCurrentId,cid);assert.equal(x.rows.size,1);
  }finally{await new Promise(r=>setTimeout(r,0));x.dom.window.close()}
});
test('double click sends one save; success is displayed only after server confirmation',async()=>{
  const x=await setup();try{
    let release;x.state.delay=new Promise(r=>release=r);x.edit('clientDbPhone','444');
    const a=x.w.clientSaveMetadata(),b=x.w.clientSaveMetadata();assert.equal(a,b);
    assert.equal(x.el('optykerClientSaveButton').disabled,true);assert.equal(x.el('clientDbPhone').disabled,true);
    assert.equal(x.el('optykerClientSaveBar').dataset.state,'saving');
    await until(()=>x.calls.filter(c=>c.p_action==='save_client').length===1);release();assert.equal(await a,true);
    assert.equal(x.el('optykerClientSaveStatus').textContent,'Modifiche salvate');
    assert.equal(x.el('clientDbPhone').disabled,false);
  }finally{await new Promise(r=>setTimeout(r,0));x.dom.window.close()}
});
test('network or unconfirmed response preserves edits and allows a manual retry',async()=>{
  for(const kind of ['failure','empty']){
    const x=await setup();try{
      x.edit('clientDbFiscal','RSSMRA80A01H501U');x.state[kind]=true;
      assert.equal(await x.w.clientSaveMetadata(),false);
      assert.equal(x.el('optykerClientSaveBar').dataset.state,'error');
      assert.equal(x.el('clientDbFiscal').value,'RSSMRA80A01H501U');
      assert.equal(x.el('optykerClientSaveButton').disabled,false);assert.equal(x.w.OPTYKER_CLOUD.clients[0].fiscal,'');
      x.state[kind]=false;assert.equal(await x.w.clientSaveMetadata(),true);
    }finally{await new Promise(r=>setTimeout(r,0));x.dom.window.close()}
  }
});
test('late save response cannot overwrite another client opened in the meantime',async()=>{
  const x=await setup();try{
    let release;x.state.delay=new Promise(r=>release=r);x.edit('clientDbPhone','555');
    const saving=x.w.clientSaveMetadata();await until(()=>x.calls.filter(c=>c.p_action==='save_client').length===1);
    x.w.clientFillForm({id:other,name:'Altro',surname:'Cliente',fiscal:'ALTRO'});
    release();assert.equal(await saving,true);
    assert.equal(x.w.clientCurrentId,other);assert.equal(x.el('clientDbFiscal').value,'ALTRO');
    assert.equal(x.rows.get(cid).phone,'555');assert.equal(x.el('optykerClientSaveBar').dataset.state,'ready');
  }finally{await new Promise(r=>setTimeout(r,0));x.dom.window.close()}
});
test('new record remains creatable; clearing an existing field persists its removal',async()=>{
  const x=await setup();try{
    x.edit('clientDbNotes','');assert.equal(await x.w.clientSaveMetadata(),true);assert.equal(x.rows.get(cid).notes,'');
    x.w.clientClearForm(false);assert.equal(x.el('optykerClientSaveButton').textContent,'Salva cliente');
    assert.equal(await x.w.clientSaveMetadata(),false);assert.equal(x.calls.filter(c=>c.p_action==='save_client').length,1);
    x.edit('clientDbName','Nuovo');assert.equal(await x.w.clientSaveMetadata(),true);
    assert.equal(x.calls.filter(c=>c.p_action==='save_client')[1].p_payload.id,undefined);assert.equal(x.w.clientCurrentId,other);assert.equal(x.rows.size,2);
  }finally{await new Promise(r=>setTimeout(r,0));x.dom.window.close()}
});
