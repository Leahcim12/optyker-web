const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');

function fixture() {
  const source=fs.readFileSync(path.join(root,'_site/index.html'),'utf8');
  const parsed=new JSDOM(source);
  const panel=parsed.window.document.getElementById('prescriptionPanel').outerHTML;
  parsed.window.close();
  const dom=new JSDOM('<body><input id="clientName"><input id="clientSurname"><input id="examDate"><input id="specialistName">'+panel+'</body>',{runScripts:'outside-only',url:'https://local.invalid/'});
  const w=dom.window;
  w.AbortSignal=AbortSignal;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
  w.eval(`var CLIENT_ARCHIVE_VERSION=1;function g(id){return document.getElementById(id)}function trimText(v){return String(v||'').trim()}function reportFieldValue(id){return g(id)?.value||''}function clientNowIso(){return '2026-09-15T10:00:00Z'}function clientSheetLabel(){return 'Prescrizione optometrica'}function showModule(){}function updatePrescriptionSpecialist(){}function updatePrescriptionLinkedData(){updateRxPdOO()}function refreshPrescriptionGoniometers(){}function clientRenderVisits(){}function resetPrescription(){g('prescriptionPanel').querySelectorAll('input,select,textarea').forEach(e=>{e.value='';e.checked=false})}function clientSelect(id){window.clientCurrentId=id}function prescriptionPrintHtml(){return '<title>Prescrizione optometrica</title><div>PRESCRIZIONE OPTOMETRICA</div><div class="eyeLabels"></div>'}function clientOpenVisitInEditor(id){clientRestoreSingleSheet(OPTYKER_CLOUD.sheets[clientCurrentId].find(s=>s.id===id).data)}function clientOpenSavePicker(type){clientPendingSheetType=type;clientSaveSheetToClient(clientCurrentId)}function clientSaveSheetToClient(){window.testCreated=clientCaptureCurrentSheet('prescription')}`);
  for(const name of ['clientCaptureCommonPatient','clientCapturePanelElements','clientCaptureCurrentSheet','clientApplyElementMap','clientRestoreSingleSheet','updateRxPdSum','updateRxPdOO','rxVal','parseRxNumber','formatRxNumber']) {
    const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert(start>=0&&end>start);w.eval(source.slice(start,end));
  }
  const cid='11111111-1111-4111-8111-111111111111',doctor={id:'22222222-2222-4222-8222-222222222222',name:'Anna Esempio',city:'Bergamo'},sid='33333333-3333-4333-8333-333333333333';
  const val=value=>({kind:'value',value});
  const data={sheetType:'prescription',elements:{clientName:val('Mario'),clientSurname:val('Esempio'),examDate:val('15/09/2026'),rx_od_sf_1:val('-2.25'),rx_od_cil_1:val('-0.50'),rx_od_cil_2:val('-0.75'),rx_od_cil_3:val('-1.00'),rxPdOO:val('63'),rxPdOD:val(''),rxPdOS:val('')},ophthalmicPrescription:true,ophthalmologist:doctor,ophthalmicDate:'2026-09-10',focusImport:{sourceId:'synthetic',record:{original:true}}};
  let row={id:sid,client_id:cid,sheet_type:'prescription',data,updated_at:'2026-09-15T01:00:00Z'},doctors=[doctor];
  w.clientCurrentId=cid;w.optykerAuthenticated=true;w.clientPendingSheetType='';w.OPTYKER_CLOUD={root:'https://local.invalid',username:'synthetic',password:'local-only',key:'local',sheets:{[cid]:[row]}};
  const requests=[];
  w.fetch=async(url,init)=>{
    const q=JSON.parse(init.body);requests.push({url,...q});let x;
    if(url.endsWith('optyker_oculists_staff')){
      if(q.p_action==='list')x={ok:true,data:doctors};
      else {let d=doctors.find(d=>d.name.toLowerCase()===q.p_payload.name.toLowerCase());const existed=!!d;if(!d){d={id:'44444444-4444-4444-8444-444444444444',...q.p_payload};doctors.push(d)}x={ok:true,data:d,already_exists:existed};}
    }else {row={...row,data:q.p_payload.data,updated_at:'2026-09-15T02:00:00Z'};x={ok:true,data:row};}
    return {ok:true,json:async()=>x};
  };
  w.eval(fs.readFileSync(path.join(root,'prescription-ophthalmic.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {w,dom,cid,sid,doctor,data,requests};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('stored ophthalmic prescription restores doctor, date and original optical values; plain/reset clears metadata',async()=>{
  const {w,dom,sid}=fixture();try{
    assert.equal(w.document.getElementById('rxOphthalmologistFields').hidden,true);
    w.clientOpenVisitInEditor(sid);await tick();
    assert.equal(w.document.getElementById('rxOphthalmic').checked,true);
    assert.equal(w.document.getElementById('rxOphthalmologistId').value,'22222222-2222-4222-8222-222222222222');
    assert.equal(w.document.getElementById('rxOphthalmicDate').value,'2026-09-10');
    assert.equal(w.document.getElementById('rx_od_cil_2').value,'-0.75');
    assert.equal(w.document.getElementById('rx_od_cil_3').value,'-1.00');
    assert.equal(w.document.getElementById('rxPdOO').value,'63');
    w.updateRxPdOO();assert.equal(w.document.getElementById('rxPdOO').value,'63');
    const html=w.prescriptionPrintHtml();assert.match(html,/PRESCRIZIONE OCULISTICA/);assert.match(html,/Anna Esempio/);assert.match(html,/10\/09\/2026/);
    w.clientRestoreSingleSheet({sheetType:'prescription',elements:{rx_od_sf_1:{kind:'value',value:'-1.00'}}});
    assert.equal(w.document.getElementById('rxOphthalmic').checked,false);
    assert.equal(w.document.getElementById('rxOphthalmologistId').value,'');
    assert.equal(w.document.getElementById('rx_od_cil_2').value,'');
    assert.equal(w.document.getElementById('rxPdOO').value,'');
    assert.equal(w.clientCaptureCurrentSheet('prescription').focusImport,undefined);
  }finally{dom.window.close();}
});
test('create oculist selects saved entry; edits preserve sheet identity and original import evidence',async()=>{
  const {w,dom,sid,cid,requests}=fixture();try{
    w.clientOpenVisitInEditor(sid);await tick();
    w.document.getElementById('rxAddOphthalmologist').click();
    const form=w.document.querySelector('#rxOculistDialog form');form.elements.name.value='Bruno Nuovo';form.elements.city.value='Milano';
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
    assert.equal(w.document.getElementById('rxOphthalmologistName').value,'Bruno Nuovo');
    assert.equal(w.document.getElementById('rxOculistDialog'),null);
    w.document.getElementById('rx_od_sf_1').value='-2.50';
    w.document.getElementById('rxSaveExisting').click();await tick();
    const request=requests.find(r=>r.url.endsWith('optyker_prescription_update'));assert(request);
    assert.equal(request.p_payload.sheet_id,sid);assert.equal(request.p_payload.client_id,cid);assert.equal(request.p_payload.expected_updated_at,'2026-09-15T01:00:00Z');
    assert.equal(request.p_payload.data.elements.rx_od_sf_1.value,'-2.50');assert.equal(request.p_payload.data.ophthalmologist.name,'Bruno Nuovo');
    assert.deepEqual(request.p_payload.data.focusImport.record,{original:true});
    assert.equal(w.OPTYKER_CLOUD.sheets[cid].length,1);
    assert.match(w.document.getElementById('rxOphthalmicStatus').textContent,/Modifiche salvate/);
  }finally{dom.window.close();}
});
test('missing doctor blocks save; switching client clears edit target; unchanged total-only and inconsistent PD survive restore',async()=>{
  const {w,dom,sid,data,requests}=fixture();try{
    w.document.getElementById('rxOphthalmic').checked=true;
    w.clientOpenSavePicker('prescription');assert.equal(w.testCreated,undefined);assert.match(w.document.getElementById('rxOphthalmicStatus').textContent,/Seleziona/);
    data.elements.rxPdOD={kind:'value',value:'31'};data.elements.rxPdOS={kind:'value',value:'33'};
    w.clientOpenVisitInEditor(sid);await tick();w.updateRxPdOO();assert.equal(w.document.getElementById('rxPdOO').value,'63');
    w.document.getElementById('rxPdOD').value='32';w.updateRxPdOO();assert.equal(w.document.getElementById('rxPdOO').value,'65');
    w.clientSelect('55555555-5555-4555-8555-555555555555');assert.equal(w.document.getElementById('rxSaveExisting').hidden,true);
    assert.equal(w.document.getElementById('rxOphthalmic').checked,false);
    assert.equal(requests.filter(r=>r.url.endsWith('optyker_prescription_update')).length,0);
  }finally{dom.window.close();}
});
