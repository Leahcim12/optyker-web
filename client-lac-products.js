/* Client LAC product workspace: trial lenses and final lenses, same saved sheet, no duplication. */
(function(root){
'use strict';
const VERSION='20260923-lac-products1';
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=v=>v==null||v===''?'—':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0);
const text=v=>String(v==null?'':v).trim();
const current=()=>text(root.clientCurrentId);
const logged=()=>!!(root.optykerAuthenticated&&root.OPTYKER_CLOUD?.username&&root.OPTYKER_CLOUD?.password);
let lastClient='',lastSignature='',busyId='';

function sheetType(row){return text(row?.sheet_type||row?.data?.sheetType)}
function isLac(row){return /^lac(?:_|$)/i.test(sheetType(row))||sheetType(row).toLowerCase()==='lac'}
function ref(row){return text(row?.reference_code||row?.reference_no||row?.data?.documentReference||row?.data?.referenceCode||row?.title)||'Scheda LAC'}
function state(row){return row?.data?.lacState||{}}
function explicitStage(row){
 const s=text(row?.data?.lacProductStage||row?.data?.lac_product_stage).toLowerCase();
 return s==='trial'||s==='final'?s:'';
}
function automaticStage(row){
 const st=state(row),doc=text(row?.document_type||row?.data?.documentType||st.document).toLowerCase();
 if(row?.laboratory_order||doc==='busta'||text(st.inStoreOrderRef||row?.data?.inStoreOrderRef||row?.data?.in_store_order_ref))return'final';
 return'trial';
}
function stage(row){return explicitStage(row)||automaticStage(row)}
function productTitle(row){
 const st=state(row),a=[st.brand,st.odProductName,st.osProductName].map(text).filter(Boolean);
 return a.length?[...new Set(a)].join(' · '):'Prodotto LAC';
}
function dateLabel(v){if(!v)return'—';try{return new Date(v).toLocaleDateString('it-IT')}catch(e){return text(v)||'—'}}
function eyeRows(row){
 const st=state(row),d=row?.data||{},out=[];
 const od=text(st.odProductName||d.odProductName),os=text(st.osProductName||d.osProductName);
 if(od||st.odCost!=null)out.push({eye:'OD',product:od||'Prodotto non indicato',price:st.odCost});
 if(os||st.osCost!=null)out.push({eye:'OS',product:os||'Prodotto non indicato',price:st.osCost});
 if(!out.length)out.push({eye:'OO',product:productTitle(row),price:null});
 return out;
}
function rows(){
 const c=root.OPTYKER_CLOUD||{},cid=current();
 return c.sheets&&Array.isArray(c.sheets[cid])?c.sheets[cid].filter(isLac):[];
}
function signature(list){return JSON.stringify(list.map(r=>[r.id,r.updated_at,stage(r),ref(r),productTitle(r),r?.laboratory_order?.status||'']))}
function host(){
 return $('clientLacPageExtras')||$('clientAnagraficaSection');
}
function ensure(){
 const h=host();if(!h)return null;
 let p=$('optykerClientLacProducts');
 if(!p){p=document.createElement('section');p.id='optykerClientLacProducts';p.className='clpWorkspace';h.prepend(p);}
 return p;
}
function status(textValue,bad){
 const el=$('optykerClientLacProductsStatus');if(!el)return;el.textContent=textValue||'';el.classList.toggle('bad',!!bad);
}
function card(row){
 const st=state(row),eyes=eyeRows(row),final=stage(row)==='final',linked=row?.laboratory_order;
 return '<article class="clpCard" data-lac-sheet="'+esc(row.id)+'">'+
  '<div class="clpCardHead"><div><span class="clpRef">'+esc(ref(row))+'</span><h4>'+esc(productTitle(row))+'</h4><p>'+esc(dateLabel(row.updated_at||row.created_at))+(linked?' · Laboratorio':'')+'</p></div><span class="clpStage '+(final?'final':'trial')+'">'+(final?'FINALE':'PROVA')+'</span></div>'+
  '<div class="clpEyes">'+eyes.map(x=>'<div class="clpEye"><b>'+esc(x.eye)+'</b><span>'+esc(x.product)+'</span><strong>'+esc(x.price==null?'':euro(x.price))+'</strong></div>').join('')+'</div>'+
  ((st.notes||row?.data?.notes)?'<p class="clpNotes">'+esc(st.notes||row.data.notes)+'</p>':'')+
  '<div class="clpActions"><button type="button" data-clp-open="'+esc(row.id)+'">Apri scheda</button>'+
  '<button type="button" data-clp-stage="'+(final?'trial':'final')+'" data-clp-id="'+esc(row.id)+'" '+(busyId===text(row.id)?'disabled':'')+'>'+(final?'Sposta in lenti di prova':'Segna come lente finale')+'</button></div>'+
 '</article>';
}
function group(title,subtitle,list,kind){
 return '<section class="clpGroup '+kind+'"><header><div><span>'+esc(kind==='trial'?'FASE DI APPLICAZIONE':'PRODOTTO DEFINITIVO')+'</span><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div><strong>'+list.length+'</strong></header>'+
  '<div class="clpGrid">'+(list.length?list.map(card).join(''):'<div class="clpEmpty">Nessuna scheda in questo reparto.</div>')+'</div></section>';
}
function render(force){
 const p=ensure(),cid=current();if(!p)return;
 if(!cid||!logged()){p.hidden=true;return;}p.hidden=false;
 const all=rows(),sig=signature(all);
 if(!force&&cid===lastClient&&sig===lastSignature)return;
 lastClient=cid;lastSignature=sig;
 const trial=all.filter(r=>stage(r)==='trial'),final=all.filter(r=>stage(r)==='final');
 p.innerHTML='<div class="clpTop"><div><span class="clpEyebrow">ANAGRAFICA CLIENTE · LAC</span><h2>Prodotto LAC</h2><p>Le schede sono separate tra lenti usate per prova/applicazione e lenti definitive del cliente.</p></div><button type="button" id="clpNewLac">+ Nuova scheda LAC</button></div>'+
 group('Lenti di prova','Prove, applicazioni e lenti ancora in valutazione.',trial,'trial')+
 group('Lenti finali','Lenti definitive, Buste e ordini destinati al cliente.',final,'final')+
 '<p id="optykerClientLacProductsStatus" class="clpStatus" role="status" aria-live="polite"></p>';
 bind(p,all);
}
function bind(p,all){
 p.querySelectorAll('[data-clp-open]').forEach(b=>b.onclick=()=>{
   const id=b.dataset.clpOpen,row=all.find(x=>text(x.id)===text(id));
   if(root.OPTYKER_CLIENT_SHEETS?.open)return root.OPTYKER_CLIENT_SHEETS.open('all',id);
   if(root.clientOpenVisitInEditor)return root.clientOpenVisitInEditor(id);
   if(row&&root.clientRestoreSingleSheet)return root.clientRestoreSingleSheet(row.data||{});
 });
 p.querySelectorAll('[data-clp-stage]').forEach(b=>b.onclick=()=>move(b.dataset.clpId,b.dataset.clpStage));
 const n=$('clpNewLac');if(n)n.onclick=()=>{
   if(typeof root.clientCreateNewLacSheet==='function')return root.clientCreateNewLacSheet();
   if(typeof root.openLacDevice==='function')return root.openLacDevice();
 };
}
async function move(id,next){
 if(busyId||!logged())return;
 const cid=current(),row=rows().find(r=>text(r.id)===text(id));if(!row)return;
 const c=root.OPTYKER_CLOUD||{},data=JSON.parse(JSON.stringify(row.data||{}));
 data.lacProductStage=next;busyId=id;render(true);status(next==='final'?'Spostamento nelle lenti finali…':'Spostamento nelle lenti di prova…');
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),20000);
 try{
  const r=await fetch(c.root+'/rest/v1/rpc/optyker_client_sheet_update',{method:'POST',cache:'no-store',signal:ac.signal,headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_payload:{client_id:cid,sheet_id:row.id,expected_updated_at:row.updated_at,data}})});
  const x=await r.json();if(!r.ok||x?.ok===false)throw Error(x?.error||'Salvataggio non riuscito');
  if(current()!==cid)throw Error('Cliente cambiato: riapri il reparto LAC.');
  const saved=x.data||{},arr=root.OPTYKER_CLOUD.sheets[cid]||[],i=arr.findIndex(v=>text(v.id)===text(row.id));
  if(i>=0)arr[i]=Object.assign({},row,saved,{data:saved.data||data});root.OPTYKER_CLOUD.sheets[cid]=arr;
  lastSignature='';root.dispatchEvent(new CustomEvent('optyker:sheet-edited',{detail:{client_id:cid,sheet_id:row.id}}));
  render(true);status(next==='final'?'Scheda spostata nelle lenti finali.':'Scheda spostata nelle lenti di prova.');
 }catch(e){render(true);status(e?.name==='AbortError'?'Risposta non ricevuta: aggiorna le schede prima di riprovare.':e.message,true)}
 finally{clearTimeout(timer);busyId='';setTimeout(()=>render(true),0)}
}
function boot(){
 render(true);
 ['optyker:sheet-edited','optyker:sheet-removed','optyker:sheet-order-created','optyker:client-saved'].forEach(n=>root.addEventListener(n,()=>{lastSignature='';render(true)}));
 setInterval(()=>{const cid=current();if(cid!==lastClient){lastSignature='';render(true)}else render(false)},1200);
}
root.OPTYKER_CLIENT_LAC_PRODUCTS={version:VERSION,stage,automaticStage,productTitle,render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof window==='undefined'?globalThis:window);
