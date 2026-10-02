const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('legacy LAC opening shows Save changes, updates the same ID and keeps failed edits',async()=>{
 const dom=new JSDOM('<section id="lacPanel"><textarea id="lacNotes"></textarea></section>',{url:'https://optyker.test',runScripts:'outside-only'}),w=dom.window;
 try{
  const row={id:'lac-existing',sheet_type:'lac',document_type:'Busta',reference_code:'3B26',updated_at:'2026-10-01',data:{sheetType:'lac',lacState:{document:'Busta'}}},calls=[];
  w.clientCurrentId='client';w.OPTYKER_CLOUD={root:'https://api.test',username:'staff',password:'synthetic',key:'synthetic',sheets:{client:[row]}};
  w.AbortController=AbortController;w.clientRestoreSingleSheet=()=>{};w.clientOpenVisitInEditor=()=>{throw Error('Legacy editor bypassed update mode')};w.clientCreateNewLacSheet=()=>{};
  w.lacCaptureClientSheet=()=>({sheetType:'lac',lacState:{document:'Busta'},notes:w.document.getElementById('lacNotes').value});
  let fail=false;w.fetch=async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:!fail,json:async()=>fail?{ok:false,error:'Riprova'}:{ok:true,data:{...row,updated_at:'2026-10-02',data:JSON.parse(init.body).p_payload.data}}}};
  w.eval(fs.readFileSync('client-sheet-edit.js','utf8'));await new Promise(r=>w.setTimeout(r,0));
  w.clientOpenVisitInEditor(row.id);await new Promise(r=>w.setTimeout(r,0));
  const button=w.document.querySelector('[data-existing-save]');assert.equal(button.textContent,'Salva modifiche');
  w.document.getElementById('lacNotes').value='Note aggiornate';button.click();await new Promise(r=>w.setTimeout(r,0));
  assert.equal(calls.length,1);assert.equal(calls[0].p_payload.sheet_id,row.id);assert.equal(calls[0].p_payload.data.notes,'Note aggiornate');assert.equal(w.OPTYKER_CLOUD.sheets.client.length,1);
  fail=true;button.click();await new Promise(r=>w.setTimeout(r,0));assert.equal(button.disabled,false);assert.equal(w.document.getElementById('lacNotes').value,'Note aggiornate');assert.equal(w.document.getElementById('optykerExistingSheetEditStatus').textContent,'Riprova');
  w.clientCurrentId='other';button.click();await new Promise(r=>w.setTimeout(r,0));assert.equal(calls.length,2);
  w.clientCreateNewLacSheet();assert.equal(w.document.querySelector('[data-existing-save]'),null);
 }finally{w.close()}
});
