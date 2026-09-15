/* Ophthalmic prescriptions: shared staff-only doctors and in-place sheet edits. */
(function () {
'use strict';
if (window.OPTYKER_OPHTHALMIC) return;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let doctors = [], loadedFor = '', loading = null, editing = null, originalData = null, saving = false, context = 0;
const user = () => window.optykerAuthenticated ? String(window.OPTYKER_CLOUD?.username || '') : '';
const client = () => String(window.clientCurrentId || '');
function status(message, bad = false) { const e=$('rxOphthalmicStatus'); if(e){e.textContent=message;e.classList.toggle('bad',bad);} }
async function rpc(name, payload, action) {
  const c=window.OPTYKER_CLOUD||{}, session=user();
  if(!session || !c.password) throw Error('Accedi con un operatore autorizzato.');
  const body={p_username:c.username,p_password:c.password,p_payload:payload}; if(action) body.p_action=action;
  const r=await fetch(c.root+'/rest/v1/rpc/'+name,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok || !data?.ok) throw Error(data?.error||'Operazione non riuscita.');
  if(user()!==session) throw Error('Sessione cambiata: riapri la prescrizione.');
  return data;
}
function selectedDoctor() {
  const id=$('rxOphthalmologistId')?.value||'';
  return id ? {id,name:doctors.find(d=>d.id===id)?.name || $('rxOphthalmologistName')?.value || ''} : null;
}
function options(id, name) {
  const select=$('rxOphthalmologistId'); if(!select)return;
  select.replaceChildren(new Option('Seleziona un oculista…',''));
  doctors.slice().sort((a,b)=>a.name.localeCompare(b.name,'it')).forEach(d=>select.add(new Option(d.name+(d.city?' · '+d.city:''),d.id)));
  if(id && !doctors.some(d=>d.id===id)) select.add(new Option(name||'Oculista della prescrizione',id));
  select.value=id||'';
}
function update() {
  const enabled=!!$('rxOphthalmic')?.checked, fields=$('rxOphthalmologistFields');
  if(fields) fields.hidden=!enabled;
  const title=$('prescriptionPanel')?.querySelector('.rxTitle');
  if(title) title.textContent=enabled?'PRESCRIZIONE OCULISTICA':'PRESCRIZIONE OPTOMETRICA';
  const b=$('rxSaveExisting'); if(b) b.hidden=!editing;
}
async function loadDoctors(force=false) {
  const session=user(); if(!session)return;
  if(loadedFor===session&&!force)return;
  if(loading)return loading;
  status('Caricamento oculisti…');
  loading=rpc('optyker_oculists_staff',{},'list').then(x=>{
    const selected=selectedDoctor(); doctors=x.data||[];loadedFor=session;
    options(selected?.id,selected?.name);status('');
  }).catch(e=>status(e.message,true)).finally(()=>{loading=null;});
  return loading;
}
function ensure() {
  const panel=$('prescriptionPanel'); if(!panel||$('rxOphthalmicBlock'))return;
  const block=document.createElement('section');block.id='rxOphthalmicBlock';
  block.innerHTML='<label class="rxOphthalmicToggle"><input id="rxOphthalmic" type="checkbox"> Prescrizione oculistica</label><div id="rxOphthalmologistFields" hidden><div class="rxOphthalmicGrid"><label>Oculista<select id="rxOphthalmologistId"><option value="">Seleziona un oculista…</option></select></label><label>Data prescrizione oculistica<input id="rxOphthalmicDate" type="date"></label><button type="button" id="rxAddOphthalmologist">+ Aggiungi oculista</button><button type="button" id="rxReloadOphthalmologists" aria-label="Aggiorna elenco oculisti">Aggiorna elenco</button></div><input id="rxOphthalmologistName" type="text" hidden readonly></div><div class="rxOphthalmicFooter"><span id="rxOphthalmicStatus" role="status" aria-live="polite"></span><button id="rxSaveExisting" type="button" hidden>Salva modifiche</button></div>';
  const title=panel.querySelector('.rxTitleRow'); if(title)title.after(block);else panel.prepend(block);
  $('rxOphthalmic').onchange=()=>{update();status('');if($('rxOphthalmic').checked)loadDoctors();};
  $('rxOphthalmologistId').onchange=()=>{$('rxOphthalmologistName').value=doctors.find(d=>d.id===$('rxOphthalmologistId').value)?.name||'';status('');};
  $('rxReloadOphthalmologists').onclick=()=>loadDoctors(true);
  $('rxAddOphthalmologist').onclick=addDoctor;
  $('rxSaveExisting').onclick=saveExisting;
}
function addDoctor() {
  if(!user()){status('Accedi con un operatore autorizzato.',true);return;}
  if($('rxOculistDialog'))return;
  const stamp=context, cid=client(), session=user(), dialog=document.createElement('dialog');dialog.id='rxOculistDialog';dialog.dataset.optykerContext='true';dialog.setAttribute('aria-labelledby','rxOculistDialogTitle');
  dialog.innerHTML='<form><header><h2 id="rxOculistDialogTitle">Aggiungi oculista</h2><button type="button" data-close aria-label="Chiudi">×</button></header><label>Nome e cognome / denominazione<input name="name" required maxlength="240" autocomplete="off"></label><label>Telefono<input name="phone" type="tel" maxlength="80"></label><label>Email<input name="email" type="email" maxlength="254"></label><label>Città<input name="city" maxlength="160"></label><p role="status" aria-live="polite"></p><footer><button type="button" data-cancel>Annulla</button><button type="submit" class="primary">Salva oculista</button></footer></form>';
  let busy=false;const close=()=>{if(!busy)dialog.close();};dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();if(busy)return;
    const payload=Object.fromEntries(new FormData(e.target));payload.name=String(payload.name||'').trim();
    const feedback=dialog.querySelector('[role="status"]');if(payload.name.length<2){feedback.textContent='Inserisci il nome dell’oculista.';return;}
    busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);feedback.textContent='Salvataggio…';
    try {
      const x=await rpc('optyker_oculists_staff',payload,'create');
      doctors=doctors.filter(d=>d.id!==x.data.id).concat(x.data);loadedFor='';
      if(context===stamp&&client()===cid&&user()===session){options(x.data.id,x.data.name);$('rxOphthalmologistName').value=x.data.name;status(x.already_exists?'Oculista già presente, selezionato.':'Oculista aggiunto e selezionato.');}
      busy=false;dialog.close();
    } catch(error){feedback.textContent=/Timeout|Abort/.test(error.name)?'Risposta non ricevuta. Puoi riprovare: non verrà creato un duplicato.':error.message;}
    finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[name="name"]').focus();
}
function valid() {
  ensure();
  if($('rxOphthalmic')?.checked&&!selectedDoctor()){status('Seleziona un oculista oppure aggiungilo all’elenco.',true);$('rxOphthalmologistId')?.focus();return false;}
  return true;
}
function clear() {
  context++;editing=null;originalData=null;ensure();
  if($('rxOphthalmic'))$('rxOphthalmic').checked=false;
  if($('rxOphthalmicDate'))$('rxOphthalmicDate').value='';
  if($('rxOphthalmologistName'))$('rxOphthalmologistName').value='';
  options('','');status('');update();
}
function restore(snap) {
  ensure(); const e=snap.elements||{}, d=snap.ophthalmologist||{id:e.rxOphthalmologistId?.value,name:e.rxOphthalmologistName?.value};
  $('rxOphthalmic').checked=snap.ophthalmicPrescription===true||e.rxOphthalmic?.checked===true;
  $('rxOphthalmicDate').value=snap.ophthalmicDate||e.rxOphthalmicDate?.value||'';
  $('rxOphthalmologistName').value=d?.name||'';options(d?.id,d?.name);update();
  if($('rxOphthalmic').checked)loadDoctors();
}
async function saveExisting() {
  if(!editing||saving||!valid())return;
  const target=editing, cid=client(), stamp=context;
  if(target.client_id!==cid){status('Riapri la prescrizione dal cliente corretto.',true);return;}
  const data=window.clientCaptureCurrentSheet('prescription');saving=true;$('rxSaveExisting').disabled=true;status('Salvataggio…');
  try {
    const x=await rpc('optyker_prescription_update',{sheet_id:target.id,client_id:cid,expected_updated_at:target.updated_at,data});
    if(context!==stamp||client()!==cid)return;
    editing=x.data;originalData=x.data.data;
    const cache=window.OPTYKER_CLOUD.sheets[cid]||[], i=cache.findIndex(s=>s.id===x.data.id);if(i>=0)cache[i]=x.data;else cache.unshift(x.data);
    window.OPTYKER_CLOUD.sheets[cid]=cache;window.clientRenderVisits?.(true);status('Modifiche salvate.');
  }catch(e){status(/Timeout|Abort/.test(e.name)?'Esito non ricevuto: riapri la scheda dal cliente per verificare il salvataggio.':e.message,true);}
  finally{saving=false;if($('rxSaveExisting'))$('rxSaveExisting').disabled=false;}
}
function wrap(name, factory) { const old=window[name];if(typeof old==='function')window[name]=factory(old); }
function boot() {
  ensure();
  wrap('clientCaptureCurrentSheet',old=>function(type){
    const snap=old.apply(this,arguments);if(type!=='prescription')return snap;
    const enabled=!!$('rxOphthalmic')?.checked;
    snap.ophthalmicPrescription=enabled;snap.ophthalmologist=enabled?selectedDoctor():null;snap.ophthalmicDate=enabled?$('rxOphthalmicDate').value:'';
    snap.sheetLabel=enabled?'Prescrizione oculistica':'Prescrizione optometrica';
    if(originalData?.focusImport)snap.focusImport=originalData.focusImport;
    if(!enabled){snap.elements.rxOphthalmologistId={kind:'value',value:''};snap.elements.rxOphthalmologistName={kind:'value',value:''};snap.elements.rxOphthalmicDate={kind:'value',value:''};}
    return snap;
  });
  wrap('clientRestoreSingleSheet',old=>function(snap){
    if(snap?.sheetType!=='prescription')return old.apply(this,arguments);
    clear(); originalData=snap;
    // Reset previous values before loading sparse historical prescriptions.
    const panel=$('prescriptionPanel');panel?.querySelectorAll('input,select,textarea').forEach(e=>{if(e.type==='checkbox')e.checked=false;else e.value='';});
    for(const [id,item] of Object.entries(snap.elements||{})){
      const e=$(id);if(e?.tagName==='SELECT'&&item.value&&!Array.from(e.options).some(o=>o.value===item.value))e.add(new Option(item.value,item.value));
    }
    const result=old.apply(this,arguments);
    // Existing PD sums otherwise clear imported total-only measurements.
    window.clientApplyElementMap?.(snap.elements||{});restore(snap);window.refreshPrescriptionGoniometers?.();return result;
  });
  wrap('clientOpenVisitInEditor',old=>function(id){
    const row=(window.OPTYKER_CLOUD?.sheets?.[client()]||[]).find(s=>s.id===id), result=old.apply(this,arguments);
    if(row?.sheet_type==='prescription'){editing=row;originalData=row.data;update();status('Prescrizione aperta. Usa “Salva modifiche” per aggiornare questa scheda.');}return result;
  });
  wrap('resetPrescription',old=>function(){const r=old.apply(this,arguments);clear();return r;});
  wrap('clientOpenSavePicker',old=>function(type){if(type==='prescription'){if(!valid())return;if(editing)return saveExisting();}return old.apply(this,arguments);});
  wrap('clientSaveSheetToClient',old=>function(id){if(window.clientPendingSheetType==='prescription'&&!valid())return;return old.apply(this,arguments);});
  wrap('clientSelect',old=>function(id){if(String(id)!==client())clear();return old.apply(this,arguments);});
  wrap('updateRxPdOO',old=>function(){
    const preserved={};if(originalData?.focusImport)for(const id of ['rxPdOO','rxPdNearOO'])preserved[id]=$(id)?.value||'';
    const result=old.apply(this,arguments);
    if(originalData?.focusImport)for(const [id,value] of Object.entries(preserved)){const a=id==='rxPdOO'?'rxPdOD':'rxPdNearOD',b=id==='rxPdOO'?'rxPdOS':'rxPdNearOS';const raw=originalData.elements||{};const unchanged=($(a)?.value||'')===(raw[a]?.value||'')&&($(b)?.value||'')===(raw[b]?.value||'');if(value&&(!$(a)?.value||!$(b)?.value||unchanged)&&$(id))$(id).value=value;}
    return result;
  });
  wrap('prescriptionPrintHtml',old=>function(){
    let html=old.apply(this,arguments);if(!$('rxOphthalmic')?.checked)return html;
    const d=selectedDoctor(), date=$('rxOphthalmicDate')?.value;
    html=html.replace(/PRESCRIZIONE OPTOMETRICA/g,'PRESCRIZIONE OCULISTICA').replace(/Prescrizione optometrica/g,'Prescrizione oculistica');
    const info='<div class="rxOphthalmicPrint" style="font-size:13px;margin:4px 0 8px"><b>Oculista:</b> '+esc(d?.name||'')+(date?' · <b>Data prescrizione:</b> '+esc(date.split('-').reverse().join('/')):'')+'</div>';
    return html.replace('<div class="eyeLabels">',info+'<div class="eyeLabels">');
  });
  let session=user();setInterval(()=>{if(user()!==session){session=user();doctors=[];loadedFor='';clear();$('rxOculistDialog')?.close();}},1000);
}
window.OPTYKER_OPHTHALMIC=Object.freeze({version:'20260915-ophthalmic1'});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
