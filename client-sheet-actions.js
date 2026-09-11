/* Customer-scoped sheet actions. Every read/write is authorized by the server RPC. */
(function(){
'use strict';if(window.OPTYKER_CLIENT_SHEETS)return;
const VERSION='20260911-client-sheets1',$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v));
const date=v=>v?new Date(v).toLocaleDateString('it-IT'):'—';
const type=s=>String(s.sheet_type||s.data?.sheetType||'');
const isEye=s=>type(s).startsWith('eyewear_');
const isQuote=s=>s.is_quote===true||/eyewear_quote/.test(type(s))||String(s.document_type||s.data?.documentType||s.data?.lacState?.document||'').toLowerCase()==='preventivo';
const labels={prescription:'Prescrizione',analysis:'Analisi visiva',visualexam:'Esame visivo',indications:'Indicazioni d’uso',hearing:'Udito',lac:'LAC'};
const kind=s=>isEye(s)?'Occhiali':labels[type(s)]||s.data?.sheetLabel||'Scheda';
const ref=s=>s.reference_code||s.reference_no||s.data?.documentReference||s.title||kind(s);
const total=s=>s.data?.pricing?.total??(type(s)==='lac'?(Number(s.data?.lacState?.odCost||0)+Number(s.data?.lacState?.osCost||0)):null);
const current=()=>String(window.clientCurrentId||'');
const logged=()=>!!(window.optykerAuthenticated&&window.OPTYKER_CLOUD?.username&&window.OPTYKER_CLOUD?.password);
let view=null,seq=0,previousClient='';
async function rpc(action,payload){
 const c=window.OPTYKER_CLOUD||{},user=c.username,client=payload.client_id;
 if(!logged())throw Error('Accedi con un operatore autorizzato.');
 const r=await fetch(c.root+'/rest/v1/rpc/optyker_client_sheet_actions',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload})});
 const x=await r.json();if(!r.ok||!x?.ok)throw Error(x?.error||'Operazione non riuscita');
 if(!logged()||window.OPTYKER_CLOUD.username!==user||current()!==client)throw Error('Cliente o sessione cambiati: riapri la scheda corretta.');return x;
}
function errorText(e){return /AbortError|TimeoutError/.test(e?.name||'')?'Risposta non ricevuta: premi Aggiorna prima di riprovare. Non è necessario creare un altro ordine.':e?.message||String(e);}
function close(){seq++;if(view){view.d.close();view.d.remove();view=null;}}
function feedback(text){if(view)view.d.querySelector('[data-cs-feedback]').textContent=text;}
function cache(rows,cid){if(window.OPTYKER_CLOUD&&current()===cid){window.OPTYKER_CLOUD.sheets[cid]=rows;try{window.clientRenderVisits?.(true);}catch{}ensure();}}
async function load(v,detailId){
 const n=++seq;v.d.querySelector('[data-cs-body]').textContent='Caricamento schede…';
 try{const x=await rpc('list',{client_id:v.cid});if(view!==v||seq!==n)return;v.rows=x.data||[];cache(v.rows,v.cid);if(detailId){const s=v.rows.find(r=>r.id===detailId);if(s)detail(v,s);else {render(v);feedback('La scheda non è più disponibile.');}}else render(v);}
 catch(e){if(view===v&&n===seq){v.d.querySelector('[data-cs-body]').textContent=errorText(e);}}
}
function open(filter='quotes',detailId=''){
 if(!current()||!logged()){alert('Seleziona prima un cliente.');return;}close();
 const cid=current(),client=(window.OPTYKER_CLOUD.clients||[]).find(c=>String(c.id)===cid),name=client?[client.name,client.surname].filter(Boolean).join(' '):'Cliente';
 const d=document.createElement('dialog');d.id='clientSheetDialog';d.dataset.optykerContext='true';d.setAttribute('aria-labelledby','clientSheetDialogTitle');d._canClose=()=>!view?.busy;
 d.innerHTML='<header><div><small>SCHEDA CLIENTE · '+esc(name)+'</small><h2 id="clientSheetDialogTitle">Preventivi e schede</h2></div><button type="button" data-cs-close aria-label="Chiudi">×</button></header><nav aria-label="Tipi di schede"><button type="button" data-cs-filter="quotes">Preventivi</button><button type="button" data-cs-filter="eyewear">Occhiali</button><button type="button" data-cs-filter="all">Tutte le schede</button><button type="button" data-cs-refresh>Aggiorna</button></nav><section data-cs-body></section><footer data-cs-feedback role="status">Aprire una scheda non crea ordini né documenti fiscali.</footer>';
 document.body.append(d);view={d,cid,name,filter,rows:[],busy:false};const v=view;
 d.querySelector('[data-cs-close]').onclick=()=>{if(!v.busy)close();};d.addEventListener('cancel',e=>{if(v.busy)e.preventDefault();});d.addEventListener('close',()=>{if(view===v){seq++;view=null;}d.remove();});
 d.querySelectorAll('[data-cs-filter]').forEach(b=>b.onclick=()=>{if(v.busy)return;v.filter=b.dataset.csFilter;v.selected=null;render(v);});
 d.querySelector('[data-cs-refresh]').onclick=()=>{if(!v.busy)load(v,v.selected?.id);};d.showModal();load(v,detailId);
}
function render(v){
 if(view!==v)return;v.selected=null;v.d.classList.remove('csDetail');
 v.d.querySelectorAll('[data-cs-filter]').forEach(b=>b.classList.toggle('active',b.dataset.csFilter===v.filter));
 const rows=v.rows.filter(s=>v.filter==='all'||v.filter==='quotes'&&isQuote(s)||v.filter==='eyewear'&&isEye(s));
 const box=v.d.querySelector('[data-cs-body]');
 box.innerHTML=rows.length?rows.map(s=>'<article class="csRow '+(isQuote(s)?'csQuote':'')+'" data-cs-id="'+esc(s.id)+'"><div><span class="csType">'+esc((isQuote(s)?'Preventivo · ':'')+kind(s))+'</span><h3>'+esc(ref(s))+'</h3><p>'+esc(date(s.created_at))+' · '+esc(s.operator||'Operatore non indicato')+'</p>'+(s.converted_order?'<p class="csLinked">Trasformato nell’ordine '+esc(s.converted_order.reference)+'</p>':s.laboratory_order?'<p class="csLinked">In Laboratorio · '+esc(statusName(s.laboratory_order.status))+'</p>':'')+'</div>'+(total(s)!==null?'<strong class="csTotal">'+esc(currency(total(s)))+'</strong>':'')+'<div class="csActions"><button type="button" data-cs-open>Apri</button>'+(isQuote(s)?'<button type="button" data-cs-convert class="csPrimary">'+(s.converted_order?'Apri ordine':'Trasforma in ordine')+'</button>':'')+'<button type="button" data-cs-delete class="csDanger" '+(s.delete_blocked?'disabled title="Collegata a un ordine o a una garanzia"':'')+'>Elimina</button></div></article>').join(''):'<p class="csEmpty">Nessuna '+(v.filter==='quotes'?'preventivazione':v.filter==='eyewear'?'scheda Occhiali':'scheda')+' salvata per questo cliente.</p>';
 box.querySelectorAll('[data-cs-id]').forEach(el=>{const s=rows.find(r=>r.id===el.dataset.csId);el.querySelector('[data-cs-open]').onclick=()=>detail(v,s);el.querySelector('[data-cs-delete]').onclick=()=>remove(v,s);const c=el.querySelector('[data-cs-convert]');if(c)c.onclick=()=>convert(v,s);});
 feedback('Elimina richiede conferma. Le schede collegate a ordini o garanzie sono protette.');
}
const statusName=s=>({da_fare:'Da fare',in_preparazione:'In preparazione',costruzione:'In costruzione',in_spedizione:'In spedizione',completato:'Completato',annullato:'Annullato'}[s]||s||'');
function fields(pairs){return '<dl>'+pairs.filter(([k,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';}
function sheetBody(s){
 const d=s.data||{},f=d.frame||{},l=d.lens||{},p=d.pricing||{},st=d.lacState||{};let h=fields([['Data',date(s.created_at)],['Riferimento',ref(s)],['Operatore',s.operator]]);
 if(isEye(s)){
 h+='<h3>Montatura</h3>'+fields([['Tipo',f.type],['Marca',f.brand],['Modello',f.model],['Colore',f.color],['Descrizione',f.description],['Barcode',f.barcode],['Prezzo montatura',f.price!=null?currency(f.price):null]]);
 h+='<h3>Lenti</h3>'+fields([['Lente destra',[l.lens_type_od,l.lens_od?.brand,l.lens_od?.lens_name].filter(Boolean).join(' · ')],['Lente sinistra',[l.lens_type_os,l.lens_os?.brand,l.lens_os?.lens_name].filter(Boolean).join(' · ')],['Marca / modello',[l.brand,l.lens_name].filter(Boolean).join(' · ')],['Materiale',l.material],['Indice',l.refractive_index],['Geometria',l.geometry],['Trattamenti',(l.treatments||[]).join(', ')],['Colore',l.color],['Montaggio',l.mounting],['Lente destra (€)',l.unit_price_od!=null?currency(l.unit_price_od):null],['Lente sinistra (€)',l.unit_price_os!=null?currency(l.unit_price_os):null],['Sconto lenti',p.discount_percent!=null?p.discount_percent+'%':null],['Promozione',d.promotion_name],['Garanzia',f.type==='Del cliente'?window.OPTYKER_SEPT11.ownText:d.warranty],['Note',d.notes]]);
 }else if(type(s)==='lac')h+='<h3>Lenti a contatto</h3>'+fields([['Marca',st.brand],['Lente OD',st.odProductName],['Lente OS',st.osProductName],['Prezzo OD',st.odCost!=null?currency(st.odCost):null],['Prezzo OS',st.osCost!=null?currency(st.osCost):null],['Note',d.notes||st.notes]]);
 else {const arr=[];for(const [k,v] of Object.entries(d.elements||{})){const val=v&&typeof v==='object'?v.value??v.text??(v.checked===true?'Sì':''):v;if(val!==undefined&&val!=='')arr.push([k,String(val)]);}h+='<h3>Dati della scheda</h3>'+fields(arr);}
 if(total(s)!==null)h+='<p class="csDetailTotal">Totale <b>'+esc(currency(total(s)))+'</b></p>';
 return h;
}
function detail(v,s){
 if(view!==v||v.busy)return;v.selected=s;v.d.classList.add('csDetail');
 const box=v.d.querySelector('[data-cs-body]');box.innerHTML='<div class="csDocument '+(isQuote(s)?'csQuote':'')+'"><h2>'+esc((isQuote(s)?'Preventivo ':s.document_type==='Busta'?'Busta ':'')+kind(s))+'</h2>'+sheetBody(s)+'</div><div class="csActions csBottom"><button type="button" data-cs-back>Torna all’elenco</button><button type="button" data-cs-print>Stampa</button>'+(!isEye(s)?'<button type="button" data-cs-editor>Apri nella scheda</button>':'')+(isQuote(s)?'<button type="button" data-cs-convert class="csPrimary">'+(s.converted_order?'Apri ordine':'Trasforma in ordine')+'</button>':'')+(s.laboratory_order?'<button type="button" data-cs-lab>Apri Laboratorio</button>':'')+'<button type="button" class="csDanger" data-cs-delete '+(s.delete_blocked?'disabled':'')+'>Elimina scheda</button></div>';
 box.querySelector('[data-cs-back]').onclick=()=>render(v);box.querySelector('[data-cs-print]').onclick=()=>print(v,s);box.querySelector('[data-cs-delete]').onclick=()=>remove(v,s);const cv=box.querySelector('[data-cs-convert]');if(cv)cv.onclick=()=>convert(v,s);
 const lab=box.querySelector('[data-cs-lab]');if(lab)lab.onclick=()=>{close();window.openLaboratory?.();};
 const edit=box.querySelector('[data-cs-editor]');if(edit)edit.onclick=()=>{cache(v.rows,v.cid);close();window.clientOpenVisitInEditor(s.id);};
 feedback(s.converted_order?'Ordine collegato: '+s.converted_order.reference:s.laboratory_order?'In Laboratorio: '+statusName(s.laboratory_order.status):'Dati del documento salvato.');
}
function print(v,s){
 if(current()!==v.cid)return;const title=(isQuote(s)?'Preventivo ':s.document_type==='Busta'?'Busta ':'')+kind(s);
 let html;try{html=window.optykerQuotePrint.decorate('<html><head><style>body{font-family:Segoe UI,Arial,sans-serif}h3{margin:18px 0 6px}dl{margin:0}dl>div{display:flex;border-bottom:1px solid #ddd;padding:6px 0;gap:14px}dt{min-width:125px}dd{margin:0;white-space:pre-wrap}.csDetailTotal{font-size:18px;text-align:right}</style></head><body><h1>'+esc(title)+'</h1>'+sheetBody(s)+'</body></html>',title,v.name+' · '+ref(s));}catch(e){feedback(errorText(e));return;}
 const w=window.open('','_blank');if(!w){feedback('Consenti le finestre di stampa per questo sito.');return;}w.document.write(html);w.document.close();window.optykerQuotePrint.finish(w);
}
async function remove(v,s){
 if(view!==v||v.busy||current()!==v.cid)return;
 if(s.delete_blocked){feedback('Scheda collegata a un ordine o a una garanzia: eliminazione bloccata.');return;}
 if(!confirm('Eliminare '+ref(s)+' dalla scheda di '+v.name+'?\n\nVerrà conservata una copia di recupero. Il cliente non viene eliminato.'))return;
 v.busy=true;v.d.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('Eliminazione in corso…');
 try{await rpc('delete',{client_id:v.cid,sheet_id:s.id,expected_updated_at:s.updated_at,confirm:true});if(view!==v)return;v.busy=false;v.d.querySelectorAll('nav button,[data-cs-close]').forEach(b=>b.disabled=false);await load(v);feedback('Scheda eliminata dall’anagrafica. Copia di recupero conservata.');}
 catch(e){if(view===v){v.busy=false;v.d.querySelectorAll('nav button,[data-cs-close]').forEach(b=>b.disabled=false);render(v);feedback(errorText(e));}}
}
async function convert(v,s){
 if(view!==v||v.busy||current()!==v.cid)return;
 if(s.converted_order){const dest=v.rows.find(r=>r.id===s.converted_order.order_sheet_id);if(dest)detail(v,dest);else await load(v,s.converted_order.order_sheet_id);return;}
 if(!confirm('Trasformare '+ref(s)+' di '+v.name+' in ordine?\n\nCreo una nuova Busta e la invio al Laboratorio in stato Da fare, mantenendo prodotti e prezzi del preventivo. L’originale resta conservato. Non viene emessa alcuna fattura.'))return;
 v.busy=true;v.d.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('Creazione dell’ordine…');
 try{const x=await rpc('convert',{client_id:v.cid,sheet_id:s.id,expected_updated_at:s.updated_at,confirm:true});if(view!==v)return;v.busy=false;v.d.querySelectorAll('nav button,[data-cs-close]').forEach(b=>b.disabled=false);await load(v,x.data.id);feedback((x.already_converted?'Ordine già presente':'Ordine creato')+' · '+ref(x.data)+' · Laboratorio: '+statusName(x.order.status));window.dispatchEvent(new CustomEvent('optyker:sheet-order-created',{detail:{client_id:v.cid}}));}
 catch(e){if(view===v){v.busy=false;v.d.querySelectorAll('nav button,[data-cs-close]').forEach(b=>b.disabled=false);render(v);feedback(errorText(e));}}
}
function ensure(){
 const cid=current();if(view&&(!logged()||view.cid!==cid))close();
 if(!logged()||!cid)return;
 const parent=$('clientAnagraficaSection');
 if(parent&&!$('clientSheetActionsDock')){const b=document.createElement('div');b.id='clientSheetActionsDock';b.innerHTML='<button type="button" data-cs-launch="quotes">Preventivi</button><button type="button" data-cs-launch="eyewear">Occhiali</button><button type="button" data-cs-launch="all">Gestisci schede</button>';parent.prepend(b);}
 const nav=$('clientPageNav');if(nav&&!$('clientQuotesNavAction')){const b=document.createElement('button');b.id='clientQuotesNavAction';b.className='clientPageNavBtn';b.dataset.csLaunch='quotes';b.type='button';b.textContent='Preventivi';nav.append(b);}
 // Keep all clinical editors intact; only the legacy delete action is replaced.
 if(window.clientDeleteVisit!==deleteFromLegacy)window.clientDeleteVisit=deleteFromLegacy;
 if(typeof window.clientOpenVisitInEditor==='function'&&!window.clientOpenVisitInEditor._csActions){const old=window.clientOpenVisitInEditor;const fn=function(id){const row=(window.OPTYKER_CLOUD.sheets[current()]||[]).find(r=>r.id===id);if(row&&(isEye(row)||isQuote(row)))return open(isQuote(row)?'quotes':'eyewear',id);return old.apply(this,arguments);};fn._csActions=true;window.clientOpenVisitInEditor=fn;}
 const rows=window.OPTYKER_CLOUD.sheets[cid]||[];
 const quoteIds=new Set(rows.filter(isQuote).map(r=>String(r.id)));
 document.querySelectorAll('#clientsPanel [data-main-sheet-id]').forEach(b=>b.classList.toggle('csQuoteDate',quoteIds.has(b.dataset.mainSheetId)));
 document.querySelectorAll('#clientEyewearList .clientEyewearRow').forEach(r=>r.classList.toggle('csQuoteLegacy',/preventivo/i.test(r.textContent)));
 previousClient=cid;
}
function deleteFromLegacy(id){open('all',id);feedback('Apri Elimina scheda per confermare la rimozione del documento selezionato.');}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-cs-launch],#clientPageNav [data-client-page="occhiali"],#clientEyewearList .clientEyewearRow,[data-quote-open],[data-main-sheet-id]');if(!b||!logged())return;
 const rowId=b.dataset.mainSheetId||b.dataset.quoteOpen;
 if(rowId){const s=(window.OPTYKER_CLOUD.sheets[current()]||[]).find(r=>String(r.id)===rowId);if(!b.dataset.quoteOpen&&!isEye(s||{}))return;}
 e.preventDefault();e.stopImmediatePropagation();open(b.dataset.csLaunch||'eyewear',rowId||'');
},true);
window.OPTYKER_CLIENT_SHEETS={version:VERSION,open,close,isQuote,sheetBody};
function boot(){ensure();setInterval(()=>{if(!document.hidden)ensure();},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
