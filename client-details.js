/* Staff-only client enrichment and reviewed Focus imports. No customer data in storage. */
(function(){
'use strict';
if(window.OPTYKER_CLIENT_DETAILS_V1)return;window.OPTYKER_CLIENT_DETAILS_V1='20260913-client-details1';
const $=id=>document.getElementById(id),ROOT='https://whgziwaegjzqsgcntesr.supabase.co';
const DEFINITIONS=[
 ['Identità','titolo','Titolo'],['Identità','cognome2','Secondo cognome'],['Identità','sesso','Sesso','sex'],['Identità','luogoDiNascita','Luogo di nascita'],
 ['Profilo e provenienza','inviatoDa','Inviato da'],['Profilo e provenienza','gruppo','Gruppo cliente'],['Profilo e provenienza','problemaVisivo','Problema visivo / annotazione Focus','area'],['Profilo e provenienza','usoLentiAContatto','Utilizza lenti a contatto','bool'],['Profilo e provenienza','promozione','Promozione'],
 ['Contatti e fatturazione','telefono2','Altro telefono'],['Contatti e fatturazione','fax','Fax'],['Contatti e fatturazione','emailContattoAggiuntiva','Email di contatto aggiuntiva (non accesso)'],['Contatti e fatturazione','stato','Paese / Stato'],['Contatti e fatturazione','codiceDestinatario','Codice destinatario SDI'],
 ['Indirizzo aggiuntivo','indirizzo2','Secondo indirizzo'],['Indirizzo aggiuntivo','citta2','Secondo comune'],['Indirizzo aggiuntivo','cap2','Secondo CAP'],['Indirizzo aggiuntivo','provincia2','Seconda provincia'],['Indirizzo aggiuntivo','stato2','Secondo paese / Stato'],
 ['Riferimenti familiari','capoFamiglia','Codice capofamiglia Focus'],['Riferimenti familiari','capoFamigliaScheda','Codice scheda capofamiglia Focus']
];
const LABELS={codiceCliente:'Codice cliente Focus',cognome:'Cognome',nome:'Nome',cellulare:'Cellulare',eMail:'Email Focus',appAttiva:'App attiva in Focus',id:'Riga originale',codiceFiscale:'Codice fiscale',gruppo:'Gruppo',codiceScheda:'Codice scheda Focus',indirizzo:'Indirizzo',citta:'Comune',cap:'CAP',provincia:'Provincia',stato:'Paese / Stato',telefono:'Telefono',telefono2:'Altro telefono',fax:'Fax',sesso:'Sesso',dataNascita:'Data di nascita',luogoDiNascita:'Luogo di nascita',professione:'Lavoro / Professione',problemaVisivo:'Problema visivo',mail:'Preferenza email in Focus',lettera:'Preferenza lettera in Focus',usoLentiAContatto:'Utilizzo lenti a contatto',hobby:'Hobby',pervenutoTramite:'Pervenuto tramite',inviatoDa:'Inviato da',dataInserimento:'Data inserimento Focus',tessera:'Tessera in Focus',consensoInformato:'Consenso informato registrato in Focus',consensoMarketing:'Consenso marketing registrato in Focus',consensoProfilazione:'Consenso profilazione registrato in Focus',modelloPrivacy:'Modello privacy Focus',dataPrivacy:'Data privacy Focus',titolo:'Titolo',indirizzo2:'Secondo indirizzo',citta2:'Secondo comune',cap2:'Secondo CAP',provincia2:'Seconda provincia',stato2:'Secondo Stato',promozione:'Promozione',codiceFiliale:'Codice filiale Focus',operatore:'Operatore Focus',sMS:'Preferenza SMS in Focus',cognome2:'Secondo cognome',partitaIva:'Partita IVA',capoFamiglia:'Codice capofamiglia',capoFamigliaScheda:'Scheda capofamiglia',pEC:'PEC',codiceDestinatario:'Codice destinatario SDI',codiceFilialeUltimoContatto:'Filiale ultimo contatto',dataUltimoContatto:'Data ultimo contatto',dataApp:'Data app Focus',codiceFilialeApp:'Filiale app Focus'};
const BASE_LABELS={name:'Nome',surname:'Cognome',birth:'Nascita',phone:'Cellulare',home_phone:'Telefono',email:'Email',pec:'PEC',fiscal:'Codice fiscale',vat:'Partita IVA',street:'Indirizzo',postal_code:'CAP',city:'Comune',province:'Provincia',profession:'Lavoro',hobby:'Hobby',referral:'Pervenuto tramite'};
let state={cid:'',seq:0,loaded:false,version:0,fields:{},owner:'',saving:false},importState={seq:0,plan:null,busy:false};
const drafts=new Map(),hooked=new Set();
const who=()=>{const c=window.OPTYKER_CLOUD||{};return [c.username||'',c.password||'',!!c.key].join('\n')};
const selected=()=>{const id=String(window.clientCurrentId||'');return /^[0-9a-f-]{36}$/i.test(id)?id:'';};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
function message(id,t,bad=false){const e=$(id);if(e){e.textContent=t;e.classList.toggle('bad',bad)}}
async function api(action,payload={}){
 const c=window.OPTYKER_CLOUD||{},owner=who();if(!c.username||!c.password||!c.key)throw Error('Accedi a Optyker con il tuo utente.');
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),action.includes('import')?120000:25000);
 try{const r=await fetch(ROOT+'/rest/v1/rpc/optyker_client_details_api',{method:'POST',cache:'no-store',signal:ac.signal,headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload})});
  if(owner!==who())throw Error('Sessione cambiata. Riapri la scheda con il tuo utente.');const x=await r.json();
  if(!r.ok||x?.ok===false){const e=Error(x?.error||'Il server non ha completato l’operazione.');e.code=x?.code;throw e}return x.data;
 }catch(e){if(e.name==='AbortError')throw Error(action==='commit_import'?'Esito non ancora confermato. Premi Verifica ultimo esito prima di riprovare.':'Il server non risponde. Riprova; i dati sullo schermo sono conservati.');throw e}finally{clearTimeout(timer)}
}
function values(){return Object.fromEntries(DEFINITIONS.map(([,k])=>[k,$('optykerExtra-'+k)?.value||'']))}
function changed(){if(!state.loaded)return false;const v=values();return DEFINITIONS.some(([,k])=>v[k]!==String(state.fields[k]||''))}
function stash(){if(state.cid&&state.loaded&&changed())drafts.set(state.cid,{fields:values(),version:state.version,baseline:state.fields});}
function enable(){const f=$('optykerExtraFields');if(f)f.disabled=!state.loaded||state.saving;const b=$('optykerExtraSave');if(b)b.disabled=!state.loaded||state.saving||!changed();}
function paintFields(fields={}){for(const [,k] of DEFINITIONS){const e=$('optykerExtra-'+k);if(e){const v=String(fields[k]||'');if(e.tagName==='SELECT'&&![...e.options].some(o=>o.value===v)){const o=node('option','Valore originale: '+v);o.value=v;e.append(o);}e.value=v;}}}
function warningsText(a){return (a||[]).map(w=>typeof w==='string'?w:w?.existing_values_preserved?'Dati Optyker già compilati conservati: '+w.existing_values_preserved.map(k=>BASE_LABELS[k]||k).join(', '):'Dato originale da verificare.').join('\n');}
function original(raw={}){
 const box=$('optykerFocusOriginalValues');if(!box)return;box.replaceChildren();
 const keys=window.OptykerFocusClientParser?.headers||Object.keys(raw);
 $('optykerFocusOriginalSummary').textContent=Object.keys(raw).length?'Dati originali Focus · '+Object.keys(raw).length+' campi':'Dati originali Focus · nessun export collegato';
 for(const k of keys){if(!Object.prototype.hasOwnProperty.call(raw,k))continue;box.append(node('dt',LABELS[k]||k),node('dd',String(raw[k])===''?'—':String(raw[k])));}
}
async function load(id,discard=false){
 const seq=++state.seq,owner=who();state.cid=id;state.loaded=false;paintFields();original();enable();message('optykerExtraStatus',id?'Caricamento dettagli…':'Salva prima l’anagrafica principale per aggiungere questi dettagli.');message('optykerExtraWarnings','');
 if(!id)return;
 try{const data=await api('get',{client_id:id});if(seq!==state.seq||id!==selected()||owner!==who())return;
  const draft=discard?null:drafts.get(id);if(discard)drafts.delete(id);
  state.fields=draft?.baseline||data.fields||{};state.version=draft?.version??data.version;state.loaded=true;
  paintFields(draft?.fields||data.fields);original(data.original_focus);message('optykerExtraWarnings',warningsText(data.warnings));
  message('optykerExtraStatus',draft?'Modifiche locali ripristinate: premi Salva dati aggiuntivi.':'');enable();
 }catch(e){if(seq===state.seq){state.loaded=false;message('optykerExtraStatus',e.message,true);enable()}}
}
async function save(){
 if(state.saving||!state.loaded)return;if(state.cid!==selected()){tick();return;}
 const id=state.cid,seq=state.seq,all=values(),patch=Object.fromEntries(Object.entries(all).filter(([k,v])=>v!==String(state.fields[k]||'')));
 if(!Object.keys(patch).length)return;state.saving=true;enable();message('optykerExtraStatus','Salvataggio dettagli…');
 try{const data=await api('save',{client_id:id,version:state.version,fields:patch});drafts.delete(id);
  if(seq===state.seq&&id===selected()){state.fields=data.fields||{};state.version=data.version;paintFields(state.fields);message('optykerExtraStatus','Dati aggiuntivi salvati nel gestionale.');}
 }catch(e){if(seq===state.seq)message('optykerExtraStatus',e.message,true);stash();}
 finally{state.saving=false;enable()}
}
function coreLabels(){
 for(const [id,label] of [['clientDbProfession','Lavoro / Professione'],['clientDbHobby','Hobby'],['clientDbReferral','Pervenuto tramite']]){
  const e=$(id),wrap=e?.closest('label');if(!wrap||e.dataset.optykerExtendedLabel===label)continue;
  const caption=Array.from(wrap.children).find(c=>c.tagName==='SPAN');
  if(caption)caption.textContent=label;else for(const t of wrap.childNodes)if(t.nodeType===Node.TEXT_NODE&&t.textContent.trim()){t.textContent=label+' ';break;}
  wrap.classList.add('optykerClientCoreExtra');e.placeholder=label;e.dataset.optykerExtendedLabel=label;
 }
}
function mount(){
 const section=$('clientAnagraficaSection');if(!section)return false;coreLabels();
 if(!$('optykerClientExtras')){
  const card=node('section',undefined,'optykerClientExtras');card.id='optykerClientExtras';
  card.append(node('h3','Altri dati dell’anagrafica'),node('p','Lavoro, Hobby e Pervenuto tramite si salvano con l’anagrafica principale. I dettagli qui sotto hanno un salvataggio dedicato.','optykerExtraHint'));
  const form=node('fieldset');form.id='optykerExtraFields';form.disabled=true;let group=null,grid=null;
  for(const [title,k,label,type] of DEFINITIONS){
   if(group!==title){const d=node('details');if(group===null)d.open=true;d.append(node('summary',title));grid=node('div',undefined,'optykerExtraGrid');d.append(grid);form.append(d);group=title;}
   const wrap=node('label',undefined,type==='area'?'wide':'');wrap.htmlFor='optykerExtra-'+k;wrap.append(node('span',label));let input;
   if(type==='bool'||type==='sex'){input=node('select');const options=type==='bool'?[['','Non indicato'],['True','Sì'],['False','No']]:[['','Non indicato'],['F','F'],['M','M']];for(const [v,l] of options){const o=node('option',l);o.value=v;input.append(o);}}
   else{input=node(type==='area'?'textarea':'input');if(type!=='area')input.type='text';input.maxLength=3000;input.autocomplete='off';}
   input.id='optykerExtra-'+k;wrap.append(input);grid.append(wrap);
  }
  card.append(form);const actions=node('div',undefined,'optykerExtraActions'),saveButton=node('button','Salva dati aggiuntivi','primary'),reload=node('button','Ricarica dettagli');
  saveButton.id='optykerExtraSave';saveButton.type='button';saveButton.disabled=true;saveButton.onclick=save;reload.type='button';reload.onclick=()=>{if(changed()&&!confirm('Ricaricare i dettagli dal server e scartare le modifiche locali di questa scheda?'))return;load(selected(),true)};actions.append(saveButton,reload);card.append(actions);
  const status=node('p');status.id='optykerExtraStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');card.append(status);
  const warning=node('p',undefined,'optykerExtraWarning');warning.id='optykerExtraWarnings';card.append(warning);
  const source=node('details',undefined,'optykerFocusOriginal'),sum=node('summary');sum.id='optykerFocusOriginalSummary';source.append(sum,node('p','Copia storica del file, non modificabile. Consensi, tessera e app attiva indicati qui si riferiscono a Focus e non modificano account o autorizzazioni Optyker. Le date originali dell’export sono nel formato mese/giorno/anno.','optykerExtraHint'));
  const list=node('dl');list.id='optykerFocusOriginalValues';source.append(list);card.append(source);section.append(card);
  form.addEventListener('input',()=>{stash();enable()});form.addEventListener('change',()=>{stash();enable()});
 }
 if(!$('optykerFocusImportOpen')){const b=node('button','Importa clienti da Focus','optykerFocusImportOpen');b.id='optykerFocusImportOpen';b.type='button';b.onclick=openImporter;(section.querySelector('.clientIdentityHeader')||section).append(b);}
 return true;
}
function receipt(data){
 const box=$('optykerFocusResult');if(!box)return;box.replaceChildren();
 box.append(node('h3',data.already_completed?'Questo file risulta già importato':'Importazione salvata e verificata'));
 const dl=node('dl',undefined,'optykerFocusNumbers');for(const [k,t] of [['inserted','Nuovi clienti'],['updated','Clienti integrati'],['review','Da verificare, non importati'],['skipped','Voci generiche escluse'],['existing_preserved','Clienti precedenti conservati']])dl.append(node('dt',t),node('dd',String(data[k]??0)));box.append(dl);
 box.append(node('p','Schede, ordini e account esistenti restano collegati agli stessi clienti. I consensi Focus sono conservati soltanto come dati storici.'));
 $('optykerFocusCommit').hidden=true;importState.plan=null;message('optykerFocusStatus','');
}
function reviewList(rows){const ul=node('ul',undefined,'optykerFocusReviews');for(const r of rows||[]){const li=node('li');li.append(node('strong',[r.surname,r.name].filter(Boolean).join(' ')+' · riga '+r.row),node('p',warningsText(r.warnings)));ul.append(li);}return ul;}
function importBusy(v){importState.busy=v;for(const id of ['optykerFocusFile','optykerFocusPreview','optykerFocusCommit'])if($(id))$(id).disabled=v;if($('optykerFocusClose'))$('optykerFocusClose').disabled=v;}
function importer(){
 if($('optykerFocusImportDialog'))return;
 const d=node('dialog');d.id='optykerFocusImportDialog';const head=node('div',undefined,'optykerFocusDialogHead');head.append(node('h2','Importa clienti da Focus'));
 const close=node('button','Chiudi');close.type='button';close.id='optykerFocusClose';close.onclick=()=>d.close();head.append(close);d.append(head);
 d.append(node('p','Aggiunge i clienti nuovi e completa i dati mancanti di quelli già presenti. I valori già compilati e discordanti restano conservati e vengono segnalati; non si cancellano schede o storico.'));
 const label=node('label','Scegli l’export Clienti Excel o CSV');label.htmlFor='optykerFocusFile';const file=node('input');file.type='file';file.id='optykerFocusFile';file.accept='.xlsx,.csv';label.append(file);d.append(label);
 d.append(node('p','Consigliato Excel: conserva anche le virgole negli indirizzi. Il file viene letto nel browser; solo dopo Confronta file viene trasmesso al gestionale autenticato.','optykerExtraHint'));
 const actions=node('div',undefined,'optykerExtraActions'),preview=node('button','Confronta file','primary'),commit=node('button','Importa clienti senza conflitti','primary'),check=node('button','Verifica ultimo esito');
 preview.type=commit.type=check.type='button';preview.id='optykerFocusPreview';commit.id='optykerFocusCommit';commit.hidden=true;actions.append(preview,commit,check);d.append(actions);
 const status=node('p');status.id='optykerFocusStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');d.append(status);const result=node('div');result.id='optykerFocusResult';d.append(result);document.body.append(d);
 file.onchange=()=>{++importState.seq;importState.plan=null;commit.hidden=true;result.replaceChildren();message(status.id,'')};
 preview.onclick=async()=>{
  if(importState.busy)return;const f=file.files?.[0];if(!f){message(status.id,'Seleziona il file Excel o CSV esportato da Focus.',true);return;}
  const seq=++importState.seq;importState.plan=null;commit.hidden=true;result.replaceChildren();importBusy(true);message(status.id,'Lettura e controllo del file…');
  try{if(!window.OptykerFocusClientParser)throw Error('Lettore del file non caricato. Ricarica Optyker.');
   const p=await window.OptykerFocusClientParser.parse(f);if(seq!==importState.seq)return;message(status.id,'Confronto di '+p.rows.length+' anagrafiche con i clienti esistenti…');
   const x=await api('preview_import',p);if(seq!==importState.seq)return;if(x.already_completed){receipt({...x.summary,already_completed:true});return;}importState.plan=x;
   result.append(node('h3','Anteprima · nessun cliente ancora modificato'));
   const dl=node('dl',undefined,'optykerFocusNumbers');for(const [k,t] of [['source_rows','Righe del file'],['to_insert','Nuovi clienti'],['to_update','Clienti da integrare'],['to_review','Corrispondenze da verificare'],['skipped','Voci generiche escluse']])dl.append(node('dt',t),node('dd',String(x[k]??0)));result.append(dl);
   if(x.review_rows?.length){const details=node('details');details.append(node('summary','Vedi le righe escluse o da verificare'),reviewList(x.review_rows));result.append(details);}
   const n=Number(x.to_insert||0)+Number(x.to_update||0);commit.textContent='Conferma importazione di '+n+' clienti';commit.hidden=n===0;
   message(status.id,'Controlla l’anteprima. I casi dubbi non verranno uniti automaticamente.');
  }catch(e){message(status.id,e.message,true)}finally{importBusy(false)}
 };
 commit.onclick=async()=>{if(importState.busy||!importState.plan)return;const p=importState.plan;importBusy(true);message(status.id,'Salvataggio e verifica. Non chiudere questa finestra…');
  try{const x=await api('commit_import',{batch_id:p.batch_id,commit_nonce:p.commit_nonce});receipt(x);try{await window.cloudLoadClients?.();window.clientRefreshList?.();window.dashboardRenderClients?.();}catch{message(status.id,'Importazione salvata. Ricarica Optyker per aggiornare l’elenco.');}if(selected())load(selected());}
  catch(e){message(status.id,e.message,true)}finally{importBusy(false)}
 };
 check.onclick=async()=>{check.disabled=true;try{const x=await api('last_import');if(!x){message(status.id,'Nessuna importazione preparata con questo utente.');return;}if(['completed','completed_with_review'].includes(x.status))receipt({...x.summary,already_completed:true});else message(status.id,'Anteprima presente, ma importazione non completata. Seleziona lo stesso file e premi Confronta file.');}catch(e){message(status.id,e.message,true)}finally{check.disabled=false}};
 d.addEventListener('cancel',e=>{if(importState.busy){e.preventDefault();message(status.id,'Attendi il risultato del salvataggio.');}});
}
async function openImporter(){importer();const d=$('optykerFocusImportDialog');if(!d.open)d.showModal();message('optykerFocusStatus','Verifica autorizzazione…');try{const c=await api('capabilities');if(!c.can_import)throw Error('Importazione riservata a Michael e all’amministrazione.');message('optykerFocusStatus','');if($('optykerFocusPreview'))$('optykerFocusPreview').disabled=false;}catch(e){if($('optykerFocusPreview'))$('optykerFocusPreview').disabled=true;message('optykerFocusStatus',e.message,true)}}
function hook(){for(const name of ['clientFillForm','clientClearForm','clientSelect']){if(hooked.has(name)||typeof window[name]!=='function')continue;const old=window[name];window[name]=function(){stash();const r=old.apply(this,arguments);queueMicrotask(tick);if(r&&typeof r.then==='function')r.then(tick,()=>{});return r;};hooked.add(name);}}
function tick(){if(document.hidden)return;if(!mount())return;hook();const owner=who();if(owner!==state.owner){drafts.clear();state.owner=owner;state.cid='';state.loaded=false;state.seq++;paintFields();original();enable();
  importState.seq++;importState.plan=null;const dialog=$('optykerFocusImportDialog');if(dialog){dialog.close();dialog.remove();}message('optykerExtraWarnings','');}
 const id=selected();if(id!==state.cid){stash();load(id)}else if(!id&&!state.loaded)message('optykerExtraStatus','Salva prima l’anagrafica principale per aggiungere questi dettagli.');
}
window.optykerImportFocusClients=openImporter;
window.addEventListener('optyker:client-saved',()=>{if(selected()!==state.cid)tick()});
window.addEventListener('beforeunload',e=>{if(changed()||drafts.size||importState.busy){e.preventDefault();e.returnValue='';}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();setInterval(tick,800);
})();
