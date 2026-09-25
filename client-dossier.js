/* Optyker: client-centred dated dossier. Reads the existing client cache; every
   write remains in the existing, authenticated sheet/editor workflow. */
(function(root){
'use strict';
const VERSION='20260925-dossier2';
const text=v=>String(v==null?'':v);
const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kind=r=>text(r?.sheet_type||r?.data?.sheetType||r?.kind||'visit');
const groups=[['lac','Lenti a contatto'],['eyewear','Occhiali'],['prescription','Prescrizione'],['analysis','Anomalie visive'],['visualexam','Esame visivo'],['indications','Indicazioni d’uso'],['hearing','Udito'],['protocol_ovc','Protocollo VC'],['protocol_ovc_bambini','VC Bambini'],['analisi_visiva_integrata','Analisi visiva integrata'],['fondo_oculare','Fondo oculare'],['visit','Visita completa']];
function category(r){const t=kind(r);if(/^lac(?:_|$)/i.test(t))return'lac';if(/^eyewear_/i.test(t))return'eyewear';if(t==='usage')return'indications';if(t==='visual_anomalies')return'analysis';return t;}
function dateValue(v){
 const s=text(v).trim();let m=/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s),y,mo,d;
 if(m){y=+m[3];mo=+m[2];d=+m[1];}else{m=/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(s);if(!m)return null;y=+m[1];mo=+m[2];d=+m[3];}
 const z=new Date(y,mo-1,d,12);return z.getFullYear()===y&&z.getMonth()===mo-1&&z.getDate()===d?z:null;
}
function rowDate(r){const d=r?.data||{},e=d.elements||{};for(const v of [d.examDate,d.date,e.lacDate?.value,e.hearingExamDate?.value,e.examDate?.value,d.savedAt,r?.created_at,r?.updated_at]){const n=dateValue(v);if(n)return n;}return null;}
function scopedRows(map,cid){if(!cid||!Object.prototype.hasOwnProperty.call(map||{},cid)||!Array.isArray(map[cid]))return null;const seen=new Set();return map[cid].filter(r=>r&&r.id&&(!r.client_id||text(r.client_id)===cid)&&!seen.has(text(r.id))&&seen.add(text(r.id)));}
function ordered(rows){return rows.slice().sort((a,b)=>(+(rowDate(b)||0)- +(rowDate(a)||0))||text(b.created_at).localeCompare(text(a.created_at))||text(a.id).localeCompare(text(b.id)));}
function stage(r){const d=r?.data||{},s=d.lacState||{},v=text(d.lacProductStage||d.lac_product_stage).toLowerCase();if(v==='trial'||v==='final')return v;return r.laboratory_order||text(r.document_type||d.documentType||s.document).toLowerCase()==='busta'||s.inStoreOrderRef||d.in_store_order_ref||d.inStoreOrderRef?'final':'trial';}
function ref(r){return text(r?.reference_code||r?.reference_no||r?.data?.documentReference||r?.title)||'Scheda';}
const helpers={category,dateValue,rowDate,scopedRows,ordered,stage,esc};
if(typeof module!=='undefined'&&module.exports)module.exports=helpers;
if(!root?.document||root.OPTYKER_CLIENT_DOSSIER)return;
const doc=root.document,$=id=>doc.getElementById(id),cid=()=>text(root.clientCurrentId),logged=()=>!!(root.optykerAuthenticated&&root.OPTYKER_CLOUD?.username&&root.OPTYKER_CLOUD?.password);
let current='',user='',page='schede',active='',filter='all',selected='',signature='',box=null,pending=false,error='',returnContext=null;
let nativePageDepth=0;
const labels={lacDate:'Data scheda',lacOdSf:'OD · Sfera',lacOsSf:'OS · Sfera',lacState:'Prodotto LAC',elements:'Dati e parametri',visualExamData:'Esame visivo completo',ophthalImages:'Immagini fondo oculare',hearingAttachmentImage:'Allegato udito',frame:'Montatura',lens:'Lenti oftalmiche',pricing:'Prezzi e sconti',order_parameters:'Parametri d’ordine',ophthalmic:'Prescrizione oculistica',brand:'Marca',document:'Documento',odProductName:'Lente destra',osProductName:'Lente sinistra',odCost:'Prezzo lente destra (€)',osCost:'Prezzo lente sinistra (€)',notes:'Note',examDate:'Data esame',savedAt:'Salvata il',updated_at:'Ultima modifica',specialist:'Operatore',documentReference:'Riferimento',documentType:'Tipo documento',product:'Prodotto',color:'Colore',model:'Modello',description:'Descrizione',price:'Prezzo (€)',total:'Totale (€)',discount_percent:'Sconto (%)',manual_final_price:'Prezzo finale (€)',unit_price:'Prezzo unitario (€)',lens_name:'Nome lente',lens_od:'Lente destra',lens_os:'Lente sinistra',refractive_index:'Indice',material:'Materiale',treatments:'Trattamenti',geometry:'Geometria',mounting:'Montaggio',warranty:'Garanzia',symptoms:'Sintomi',outcome:'Esito',recommendations:'Indicazioni',anamnesis:'Anamnesi',reason:'Motivo',visualAcuity:'Acuità visiva',refraction:'Refrazione',binocularVision:'Visione binoculare',accommodation:'Accomodazione',motility:'Motilità',odFindings:'Fondo destro',osFindings:'Fondo sinistro',parentNotes:'Note del genitore',inStoreOrderRef:'Riferimento ordine in negozio',lacProductStage:'Fase LAC'};
function label(k){
 if(labels[k])return labels[k];const el=$(k);let s=el?.labels?.[0]?.textContent||el?.closest('label')?.textContent||el?.getAttribute('aria-label');
 if(s&&s.trim()&&s.trim().length<100)return s.trim();
 const rx=/^rx_(od|os)_(sf|cil|asse|add|visus)_(\d+)$/.exec(k);if(rx)return(rx[1]==='od'?'OD':'OS')+' · '+({sf:'Sfera',cil:'Cilindro',asse:'Asse',add:'Addizione',visus:'Visus'}[rx[2]])+' '+rx[3];
 return k.replace(/^lac/,'').replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\bOd\b/g,'OD').replace(/\bOs\b/g,'OS').replace(/^./,c=>c.toUpperCase());
}
const secret=k=>/password|passwd|token|secret|authorization|apikey|login|credential/i.test(k);
const internal=k=>['version','sheetType','sheetLabel','client_id','clientId','catalog_id','id','kind'].includes(k)||secret(k);
function fieldHTML(k,v){if(k==='lacProductStage'||k==='lac_product_stage')return esc(v==='trial'?'Lente di prova':v==='final'?'Lente finale':v);return valueHTML(v);}
function valueHTML(v){if(typeof v==='boolean')return v?'Sì':'No';if(/^data:image\/(png|jpe?g|webp);base64,/i.test(text(v)))return'<img class="cdImage" alt="Immagine archiviata nella scheda" src="'+esc(v)+'">';if(/^data:/i.test(text(v)))return'Allegato disponibile nella scheda originale';return esc(v);}
function detailsHTML(data){
 const parts=[];let scalar=[];
 function fields(values){return values.length?'<dl class="cdFields">'+values.join('')+'</dl>':'';}
 function visit(obj,prefix,depth){
  if(obj==null)return'';
  if(Array.isArray(obj)){if(!obj.length)return'';if(obj.every(x=>x==null||typeof x!=='object'))return obj.map(valueHTML).join('<br>');return obj.map((v,i)=>'<div class="cdNested"><h4>'+esc(prefix+' '+(i+1))+'</h4>'+visit(v,prefix,depth+1)+'</div>').join('');}
  if(typeof obj!=='object')return valueHTML(obj);
  if(depth>12)return'<p>Ulteriori dettagli disponibili nella scheda originale.</p>';
  const f=[],nested=[];
  for(const [k,item] of Object.entries(obj)){
   if(internal(k)||item==null||item==='')continue;
   const control=$(k);if(control?.type==='password'||control?.type==='hidden')continue;
   let v=item;
   if(v&&typeof v==='object'&&!Array.isArray(v)&&('value'in v||'checked'in v||'text'in v))v='value'in v?v.value:'checked'in v?v.checked:v.text;
   if(v==null||v==='')continue;
   if(typeof v==='object'){const body=visit(v,label(k),depth+1);if(body)nested.push('<section class="cdNested"><h4>'+esc(label(k))+'</h4>'+body+'</section>');}
   else f.push('<div><dt>'+esc(label(k))+'</dt><dd>'+fieldHTML(k,v)+'</dd></div>');
  }
  return fields(f)+nested.join('');
 }
 for(const [k,v] of Object.entries(data||{})){
  if(internal(k)||v==null||v==='')continue;
  if(typeof v==='object'){const body=visit(v,label(k),0);if(body)parts.push('<section class="cdSection"><h3>'+esc(label(k))+'</h3>'+body+'</section>');}
  else scalar.push('<div><dt>'+esc(label(k))+'</dt><dd>'+fieldHTML(k,v)+'</dd></div>');
 }
 return(scalar.length?'<section class="cdSection"><h3>Informazioni della scheda</h3>'+fields(scalar)+'</section>':'')+parts.join('');
}
function allRows(){return scopedRows(root.OPTYKER_CLOUD?.sheets,cid());}
function title(k){return groups.find(g=>g[0]===k)?.[1]||label(k);}
function available(rows){const list=groups.slice(),known=new Set(list.map(g=>g[0]));for(const r of rows||[]){const k=category(r);if(!known.has(k)){list.push([k,text(r.data?.sheetLabel)||label(k)]);known.add(k);}}return list;}
function visibleRows(rows){return ordered((rows||[]).filter(r=>category(r)===active&&(active!=='lac'||filter==='all'||stage(r)===filter)));}
function selectedRow(){return visibleRows(allRows()).find(r=>text(r.id)===selected);}
function ready(){return logged()&&cid()&&cid()===current;}
function notice(s){error=s;signature='';render();}
function button(s,attr='',cls=''){return'<button type="button" '+attr+' class="'+cls+'">'+s+'</button>';}
function mount(){
 const edit=$('clientEditView'),hero=$('clientWorkspaceHero'),panel=$('clientsPanel');if(!edit||!hero||!panel)return false;
 if(!box||!box.isConnected){box=doc.createElement('section');box.id='clientDossier';hero.after(box);}
 panel.classList.add('clientDossierReady');return true;
}
function render(){
 if(!mount())return;
 if(!logged()||!cid()){box.hidden=true;box.replaceChildren();$('clientsPanel').classList.remove('clientDossierReady','cdClinicalEditing');current='';user='';selected='';signature='';returnContext=null;return;}
 box.hidden=false;
 if(current!==cid()||user!==root.OPTYKER_CLOUD.username){current=cid();user=root.OPTYKER_CLOUD.username;page='schede';active='';selected='';filter='all';signature='';error='';returnContext=null;}
 $('clientsPanel').dataset.cdPage=page;
 const rows=allRows();if(page==='schede'&&active){const list=visibleRows(rows);if(!list.some(r=>text(r.id)===selected))selected=list[0]?text(list[0].id):'';}const sig=JSON.stringify([current,user,page,active,filter,selected,pending,error,rows?.map(r=>[r.id,r.updated_at,r.created_at,ref(r),category(r),stage(r),rowDate(r)?.getTime()])]);
 if(sig===signature)return;signature=sig;
 const nav=[['anagrafica','Anagrafica'],['schede','Schede cliente'],['ordini','Ordini'],['documenti','Documenti'],['chat','Chat']];
 let h='<nav class="cdNav" aria-label="Sezioni del cliente">'+nav.map(([k,t])=>button(esc(t),'data-cd-page="'+k+'" aria-current="'+(k===page?'page':'false')+'"',k===page?'active':'')).join('')+'</nav>';
 if(page!=='schede'){if(page==='lac')h+='<div class="cdHeading"><h2>Forniture e garanzie LAC</h2>'+button('← Torna alle schede per data','data-cd-page="schede"')+'</div>';box.innerHTML=h;bind();return;}
 h+='<div class="cdHeading"><div><h2>Schede del cliente</h2><p>Scegli la scheda, poi apri la data che ti serve.</p></div>'+button(pending?'Aggiornamento…':'Aggiorna','data-cd-refresh '+(pending?'disabled':''))+'</div>';
 h+='<nav class="cdTypes" aria-label="Tipi di schede del cliente">'+available(rows).map(([k,t])=>button('<span>'+esc(t)+'</span><small>'+((rows===null)?'—':rows.filter(r=>category(r)===k).length)+'</small>','data-cd-type="'+esc(k)+'" aria-pressed="'+(k===active)+'"',k===active?'active':'')).join('')+'</nav>';
 if(error)h+='<p class="cdError" role="alert">'+esc(error)+'</p>';
 if(rows===null)h+='<p class="cdEmpty" role="status">Le schede non sono ancora caricate. Premi Aggiorna per riprovare.</p>';
 else if(!active)h+='<div class="cdEmpty"><strong>Tutte le schede, in un unico posto.</strong><p>Seleziona il tipo di scheda qui sopra. Anche le sezioni senza schede sono sempre disponibili.</p></div>';
 else{
  const list=visibleRows(rows);let row=list.find(r=>text(r.id)===selected);if(!row){row=list[0];selected=row?text(row.id):'';}
  h+='<section class="cdBinder"><header class="cdBinderHead"><div><small>RACCOGLITORE CLIENTE</small><h2>'+esc(title(active))+'</h2></div>'+'<div class="cdActions">'+(active==='lac'?button('Forniture e garanzie','data-cd-page="lac"'):'')+button('+ Nuova data','data-cd-new','cdPrimary')+'</div></header>';
  if(active==='lac')h+='<div class="cdStages" aria-label="Reparto LAC">'+[['all','Tutte'],['trial','Lenti di prova'],['final','Lenti finali']].map(([k,t])=>button(t,'data-cd-stage="'+k+'" aria-pressed="'+(k===filter)+'"',k===filter?'active':'')).join('')+'</div>';
  if(list.length){
   h+='<div class="cdDates" role="tablist" aria-label="Date '+esc(title(active))+'">'+list.map((r,i)=>{const on=text(r.id)===selected;return button('<b>'+esc(rowDate(r)?.toLocaleDateString('it-IT')||'Senza data')+'</b><span>'+esc(ref(r))+'</span>','role="tab" id="cdDate'+i+'" aria-controls="cdDocument" aria-selected="'+on+'" tabindex="'+(on?'0':'-1')+'" data-cd-date="'+esc(r.id)+'"',on?'active':'');}).join('')+'</div>';
   const ix=list.indexOf(row);
   h+='<article id="cdDocument" class="cdDocument" role="tabpanel" aria-labelledby="cdDate'+ix+'" tabindex="0"><div class="cdDocumentHead"><div><h3>'+esc(ref(row))+'</h3><p>'+esc(rowDate(row)?.toLocaleDateString('it-IT')||'Data non indicata')+(row.operator?' · '+esc(row.operator):'')+(active==='lac'?' · '+(stage(row)==='trial'?'Lente di prova':'Lente finale'):'')+'</p></div><div class="cdActions">'+button((active==='lac'||active==='eyewear'||Array.from(doc.querySelectorAll('[data-tools-card]')).some(n=>n.dataset.toolsCard===text(row.id)))?'Modifica':'Apri nella scheda','data-cd-edit','cdPrimary')+button('Stampa / gestione','data-cd-manage')+'</div></div>'+detailsHTML(row.data||{})+'</article>';
  }else h+='<div class="cdEmpty">Nessuna scheda '+esc(title(active))+(active==='lac'&&filter!=='all'?(filter==='trial'?' di prova':' finale'):'')+'.<p>Premi <strong>+ Nuova data</strong> per crearne una.</p></div>';
  h+='</section>';
 }
 box.innerHTML=h;bind();
}
// One page controller for both current tabs and legacy entry points. Never replace
// form nodes, write a client record, or dispatch fiscal/commerce actions here.
function nativePage(next){
 nativePageDepth++;
 try{return root.optykerClientOpenPage?.(next);}finally{nativePageDepth--;}
}
function activateClients(){
 if(!logged()||root.OPTYKER_BILLING_ADMIN)return false;
 for(const d of doc.querySelectorAll('dialog[data-optyker-context][open]')){
  if(typeof d._canClose==='function'&&!d._canClose())return false;
 }
 if(!leaveOldEditor())return false;
 for(const d of doc.querySelectorAll('dialog[data-optyker-context][open]'))d.close();
 if(typeof root.optykerShowOnlyRootPanel==='function')root.optykerShowOnlyRootPanel('clientsPanel');
 else root.showModule?.('clients');
 root.dashboardSetWorkAreaVisible?.(true);
 // Do not reselect the client or reload the profile: preserve unsaved input.
 nativePageDepth++;
 try{root.clientShowView?.(cid()?'edit':'archive');}finally{nativePageDepth--;}
 doc.querySelectorAll('#moduleNav .moduleBtn').forEach(b=>b.classList.toggle('active',b.id==='navClients'));
 doc.body.classList.toggle('cdClientOpen',!!cid());
 render();return true;
}
function legacyPage(next,id){
 if(!activateClients()||!ready())return;
 const section=text(next||'anagrafica');
 const mapped={onlineorders:'ordini',consents:'documenti',documents:'documenti',occhiali:'eyewear',usage:'indications',visual_anomalies:'analysis'}[section]||section;
 if(['anagrafica','schede','ordini','documenti','chat'].includes(mapped))switchPage(mapped);
 else {switchPage('schede');chooseType(mapped);if(id)chooseDate(text(id),false);}
}
function installNavigation(){
 const hook=(name,action)=>{
  const fn=root[name];if(typeof fn!=='function'||fn.__cdNavigation)return;
  const wrapped=function(...args){
   if(nativePageDepth||!logged()||!cid()||root.OPTYKER_BILLING_ADMIN)return fn.apply(this,args);
   return action(...args);
  };
  // Preserve flags used by the existing bounded installers; avoid wrapper loops.
  Object.assign(wrapped,fn);wrapped.__cdNavigation=true;root[name]=wrapped;
 };
 hook('optykerClientOpenPage',(next)=>legacyPage(next));
 hook('clientSidebarOpenSection',(type)=>legacyPage(type));
 hook('clientSidebarOpenDate',(type,id)=>legacyPage(type,id));
 hook('clientSidebarOpenOnlineOrders',()=>legacyPage('ordini'));
}
function switchPage(next){if(!ready())return;page=next;error='';signature='';if(next!=='schede')nativePage(next);render();}
function chooseType(k){if(!ready())return;active=k;selected='';filter='all';error='';signature='';render();}
function chooseDate(id,focus){if(!ready())return;const row=visibleRows(allRows()).find(r=>text(r.id)===id);if(!row)return;selected=id;signature='';render();if(focus)box.querySelector('[role="tab"][aria-selected="true"]')?.focus();}
async function refresh(){
 if(pending||!ready())return;const id=cid(),u=user;pending=true;error='';signature='';render();
 try{if(typeof root.cloudLoadSheets!=='function')throw Error('Caricamento schede non disponibile. Riapri Clienti.');await root.cloudLoadSheets(id);if(cid()!==id||!logged()||user!==u)return;if(allRows()===null)throw Error('Schede non disponibili. Riprova l’aggiornamento.');}
 catch(e){if(cid()===id&&logged())error=e.message||'Impossibile caricare le schede.';}
 finally{pending=false;signature='';render();}
}
function leaveOldEditor(){
 const bar=$('optykerExistingSheetEditBar');if(!bar)return true;
 const b=bar.querySelector('[data-existing-back]');if(!b)return false;b.click();return!$('optykerExistingSheetEditBar');
}
function restoreDossier(){if(!returnContext||returnContext.cid!==cid())return;const c=returnContext;root.showModule?.('clients');page='schede';active=c.type;selected=c.id;filter=c.filter;signature='';render();}
function remember(){returnContext={cid:cid(),type:active,id:selected,filter};}
function addReturnBar(){
 const panels=['lacPanel','eyewearPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel'];
 let attempts=0;const tryMount=()=>{if(!returnContext||returnContext.cid!==cid())return;const panel=panels.map($).find(p=>p&&root.getComputedStyle(p).display!=='none');if(!panel){if(++attempts<12)setTimeout(tryMount,150);return;}
  doc.querySelectorAll('.cdEditorReturn').forEach(e=>e.remove());const b=doc.createElement('button');b.type='button';b.className='cdEditorReturn';b.textContent='← Torna al raccoglitore del cliente';b.onclick=()=>{if(!confirm('Tornare al raccoglitore? Salva prima le modifiche che desideri conservare.'))return;if(!leaveOldEditor()){alert('Salvataggio in corso: completa l’operazione prima di uscire.');return;}restoreDossier();};panel.prepend(b);};tryMount();
}
function edit(){
 if(!ready())return;const row=selectedRow();if(!row)return;remember();
 if(category(row)==='lac'||category(row)==='eyewear'){
  if(typeof root.optykerEditClientSheet!=='function')return notice('Editor non ancora disponibile. Riapri la scheda.');
  if(!leaveOldEditor())return notice('Completa il salvataggio in corso prima di cambiare scheda.');
  root.optykerEditClientSheet(row.id);addReturnBar();return;
 }
 const clinical=Array.from(doc.querySelectorAll('[data-tools-card]')).find(n=>n.dataset.toolsCard===text(row.id));
 if(clinical){page='anagrafica';nativePage('anagrafica');$('clientsPanel').classList.add('cdClinicalEditing');signature='';render();clinical.classList.add('open');clinical.scrollIntoView({block:'center'});return;}
 if(typeof root.clientOpenVisitInEditor==='function'){root.clientOpenVisitInEditor(row.id);addReturnBar();}else notice('Editor della scheda non disponibile.');
}
function create(){
 if(!ready())return;const k=active;remember();
 if(!leaveOldEditor())return notice('Completa il salvataggio in corso prima di creare una nuova data.');
 if(k==='lac'&&typeof root.clientCreateNewLacSheet==='function'){root.clientCreateNewLacSheet();addReturnBar();return;}
 if(k==='eyewear'&&typeof root.openEyewearSheet==='function'){root.openEyewearSheet('quote',cid());addReturnBar();return;}
 if(['analysis','prescription','visualexam','indications','hearing'].includes(k)&&typeof root.clientCreateNewSheet==='function'){root.clientCreateNewSheet(k);addReturnBar();return;}
 const native=Array.from(doc.querySelectorAll('[data-tools-new]')).find(b=>b.dataset.toolsNew===k);
 if(native){page='anagrafica';$('clientsPanel').classList.add('cdClinicalEditing');nativePage('anagrafica');signature='';render();native.click();return;}
 if(k==='visit'){page='anagrafica';nativePage('anagrafica');signature='';render();root.clientToggleNewSheetMenu?.();$('clientsPanel').classList.add('cdClinicalEditing');return;}
 notice('Per questa scheda il comando di creazione non è ancora caricato. Premi Aggiorna o riapri Clienti.');
}
function bind(){
 box.querySelectorAll('[data-cd-page]').forEach(b=>b.onclick=()=>{$('clientsPanel').classList.remove('cdClinicalEditing');switchPage(b.dataset.cdPage);});
 box.querySelectorAll('[data-cd-type]').forEach(b=>b.onclick=()=>chooseType(b.dataset.cdType));
 box.querySelectorAll('[data-cd-stage]').forEach(b=>b.onclick=()=>{filter=b.dataset.cdStage;selected='';signature='';render();});
 box.querySelectorAll('[data-cd-date]').forEach(b=>{b.onclick=()=>chooseDate(b.dataset.cdDate,false);b.onkeydown=e=>{const tabs=Array.from(box.querySelectorAll('[role="tab"]')),i=tabs.indexOf(b);let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();chooseDate(tabs[n].dataset.cdDate,true);};});
 box.querySelector('[data-cd-refresh]')?.addEventListener('click',refresh);
 box.querySelector('[data-cd-edit]')?.addEventListener('click',edit);
 box.querySelector('[data-cd-new]')?.addEventListener('click',create);
 box.querySelector('[data-cd-manage]')?.addEventListener('click',()=>{const r=selectedRow();if(ready()&&r)root.OPTYKER_CLIENT_SHEETS?.open?.('all',r.id);});
}
const CSS=`
#clientDossier{font-family:inherit;color:#27272a;margin:14px 0 22px;min-width:0;grid-column:1/-1}#clientDossier *{box-sizing:border-box}#clientDossier button{font-family:inherit;cursor:pointer;min-height:42px;border:1px solid #dddde2;background:#fff;color:#41414a;border-radius:10px;padding:9px 13px;font-size:12px;font-weight:700;line-height:1.35}#clientDossier button:hover{border-color:#b62037;background:#fff7f8}#clientDossier button:focus-visible{outline:3px solid #e393a1;outline-offset:3px}#clientDossier button:disabled{opacity:.6;cursor:wait}#clientDossier button.active,#clientDossier .cdPrimary{background:#aa1730;color:#fff;border-color:#aa1730}#clientDossier h2,#clientDossier h3,#clientDossier h4,#clientDossier p{margin:0}#clientDossier h2{font-size:21px;line-height:1.25;font-weight:800}#clientDossier p{font-size:12px;line-height:1.6;color:#71717c;margin-top:5px}.cdNav{display:flex;gap:7px;flex-wrap:wrap;padding-bottom:15px;border-bottom:1px solid #e5e5e9}.cdHeading,.cdBinderHead,.cdDocumentHead{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:18px 0}.cdTypes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0 22px}.cdTypes button{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:8px}.cdTypes small{display:flex;align-items:center;justify-content:center;min-width:24px;height:24px;background:#f2f2f5;border-radius:7px;font-size:11px;color:#71717c}.cdTypes .active small{background:#ffffff24;color:#fff}.cdBinder{border:1px solid #e1dde0;background:#fff;border-radius:15px;padding:18px}.cdBinderHead{margin:0 0 18px}.cdBinderHead small{font-size:9px;letter-spacing:.13em;color:#9b5864;display:block;margin-bottom:6px}.cdStages{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}.cdDates{display:flex;gap:5px;overflow-x:auto;scrollbar-width:thin;border-bottom:2px solid #aa1730;padding-top:4px}.cdDates button{flex:0 0 auto;min-width:133px;max-width:220px;border-radius:10px 10px 0 0!important;border-bottom:0!important;text-align:left;padding:12px 15px!important}.cdDates b,.cdDates span{display:block}.cdDates b{font-size:13px}.cdDates span{font-size:10px;font-weight:500;margin-top:4px;white-space:normal;overflow-wrap:anywhere}.cdDocument{padding:5px 0 0}.cdDocumentHead{margin:20px 0}.cdDocumentHead h3{font-size:18px}.cdActions{display:flex;gap:7px;flex-wrap:wrap}.cdSection{border-top:1px solid #ededf0;padding:18px 0}.cdSection h3{font-size:14px;color:#8f2436;margin-bottom:13px!important}.cdFields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:0}.cdFields>div{padding:10px 0;border-bottom:1px solid #f0f0f2;min-width:0}.cdFields dt{font-size:11px;color:#75757e;margin:0 0 5px}.cdFields dd{font-size:13px;line-height:1.55;color:#24242a;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.cdNested{margin:12px 0 0;padding:12px;background:#fafafa;border-radius:10px}.cdNested h4{font-size:12px;margin-bottom:8px!important}.cdEmpty{padding:30px 20px;background:#faf9fa;border:1px dashed #ddd5d8;border-radius:12px;font-size:13px;line-height:1.65;color:#6b6268}.cdError{padding:12px;background:#fff0f1;color:#9b142c!important;border-radius:8px;margin:10px 0!important}.cdImage{max-width:100%;max-height:400px;object-fit:contain}.cdEditorReturn{margin:0 0 14px;padding:12px 16px;border:1px solid #aa1730;border-radius:9px;background:#fff;color:#aa1730;font:700 12px inherit;cursor:pointer}
html body #mainApp #clientsPanel.clientDossierReady #cwoSummary,html body #mainApp #clientsPanel.clientDossierReady #clientPageNav,html body #mainApp #clientsPanel.clientDossierReady #clientPageIntro,html body #mainApp #clientsPanel.clientDossierReady #clientRecordNavWrap,html body #mainApp #clientsPanel.clientDossierReady #clientMainSheetDates,html body #mainApp #clientsPanel.clientDossierReady .clientNewSheetDock{display:none!important}
html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #clientEditView .clientWorkspaceGrid,html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #clientEyewearPage,html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #optykerClientQuotesSection,html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #optykerClientClinicalTools,html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #optykerClientReferenceTools,html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #optykerClientAnomalyTools,html body #mainApp #clientsPanel.clientDossierReady[data-cd-page="schede"] #optykerClientPaymentTools{display:none!important}
html body #mainApp #clientsPanel.clientDossierReady:not(.cdClinicalEditing) #optykerClientClinicalTools,html body #mainApp #clientsPanel.clientDossierReady:not(.cdClinicalEditing) #optykerClientAnomalyTools{display:none!important}
html body #mainApp #clientsPanel.clientDossierReady.cdClinicalEditing .clientNewSheetDock{display:block!important}
html body.optykerDossierNavigation #mainApp #moduleNav #clientSidebarSubmenu,
html body.optykerDossierNavigation #mainApp #moduleNav #moduleSheetGroup,
html body.optykerDossierNavigation #mainApp #moduleNav #sheetsSubmenu,
html body.optykerDossierNavigation #mainApp #moduleNav #navSheets,
html body.optykerDossierNavigation #mainApp #moduleNav #navClients .optykerNavChevron{display:none!important}
html body.cdClientOpen #mainApp #reportSectionTop{display:none!important}
#clientDossier[hidden]{display:none!important}
@media(max-width:1000px){.cdTypes{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:680px){.cdTypes{grid-template-columns:repeat(2,minmax(0,1fr))}.cdBinder{padding:12px}.cdHeading,.cdBinderHead,.cdDocumentHead{align-items:flex-start;flex-wrap:wrap}.cdFields{grid-template-columns:1fr}.cdNav{gap:5px}#clientDossier .cdNav button{padding:8px 10px;font-size:11px}.cdActions{width:100%}}
@media print{.cdNav,.cdHeading,.cdTypes,.cdStages,.cdDates,.cdActions,.cdEditorReturn,.cdBinderHead button{display:none!important}.cdBinder{border:0;padding:0}.cdFields>div{break-inside:avoid}}
`;
function boot(){const s=doc.createElement('style');s.id='optykerClientDossierCss';s.textContent=CSS;doc.head.append(s);installNavigation();render();
 // Capture before the legacy document handlers. Only Clienti is intercepted;
 // Dashboard, Orders, Cassa and all save/print buttons retain their own handlers.
 root.addEventListener('click',e=>{
  const b=e.target?.closest?.('#navClients');
  if(!b||!logged()||root.OPTYKER_BILLING_ADMIN)return;
  e.preventDefault();e.stopImmediatePropagation();activateClients();
 },true);
 root.addEventListener('pageshow',()=>{installNavigation();render();});
 ['optyker:sheet-edited','optyker:sheet-removed','optyker:sheet-order-created','optyker:client-saved'].forEach(n=>root.addEventListener(n,()=>{signature='';render();}));
 setInterval(()=>{
  if(!logged()){render();doc.body.classList.remove('optykerDossierNavigation','cdClientOpen');return;}
  if(doc.hidden||root.OPTYKER_BILLING_ADMIN)return;
  installNavigation();doc.body.classList.add('optykerDossierNavigation');
  const panel=$('clientsPanel'),shown=!!panel&&root.getComputedStyle(panel).display!=='none';
  doc.body.classList.toggle('cdClientOpen',shown&&!!cid());if(shown)render();
 },700);
}
root.OPTYKER_CLIENT_DOSSIER={version:VERSION,render,chooseType,chooseDate,switchPage,legacyPage,...helpers};
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof window==='undefined'?globalThis:window);
