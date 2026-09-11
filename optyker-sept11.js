/* Optyker: deterministic navigation, customer tariffs, eyewear warranty and FIC bridge. */
(function(){
'use strict';
if(window.OPTYKER_SEPT11)return;
const VERSION='20260911-workflow1';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const ownText='Montatura del cliente: garanzia Base, solo cambio lenti. Sconto 50% nel primo anno e 25% nel secondo, massimo due ricambi complessivi dalla consegna.';
const root=new URL('./',document.currentScript?.src||location.href);
const credentials=()=>window.OPTYKER_CLOUD||{};
const logged=()=>!!(window.optykerAuthenticated&&credentials().username&&credentials().password);
let sessionUser='',adminToken='';
async function rpc(name,action,payload){
 const c=credentials(),user=c.username;
 if(!logged())throw Error('Accedi con un operatore autorizzato.');
 const r=await fetch(c.root+'/rest/v1/rpc/'+name,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload})});
 const x=await r.json();if(!r.ok||!x?.ok)throw Error(x?.error||'Operazione non riuscita');
 if(!logged()||credentials().username!==user)throw Error('Sessione cambiata: riapri la scheda.');return x;
}
function message(e){return e?.name==='TimeoutError'||e?.name==='AbortError'?'Risposta non ricevuta. Aggiorna lo stato prima di riprovare.':e?.message||String(e);}
function dialog(title){
 const d=document.createElement('dialog');d.className='ovc11Dialog';d.dataset.optykerContext='true';
 d.innerHTML='<header><h2>'+esc(title)+'</h2><button type="button" aria-label="Chiudi">×</button></header><section class="ovc11Body"></section><footer role="status"></footer>';
 document.body.append(d);d._dirty=false;
 d._canClose=()=>!d._dirty||confirm('Chiudere senza salvare le modifiche?');
 d.querySelector('header button').onclick=()=>{if(d._canClose())d.close();};
 d.addEventListener('cancel',e=>{if(!d._canClose())e.preventDefault();});
 d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;
}
const status=(d,text)=>{if(d.isConnected)d.querySelector('footer').textContent=text;};
function canLeave(){
 for(const d of document.querySelectorAll('dialog[data-optyker-context][open]'))if(!d._canClose())return false;
 return true;
}
function closeContext(){for(const d of document.querySelectorAll('dialog[data-optyker-context][open]'))d.close();}

/* Replaces the old style MutationObservers: a late response cannot unhide another root. */
const ROOTS=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','lacPanel','onlineOrdersPanel','labOrdersPanel','optykerLaboratoryPanel','optykerChatPanel','optykerSettingsPanel','optykerAppointmentsPanel','eyewearPanel','warehousePanel','optykerDdtPanel','optykerCustomerInvoicesPanel','optykerBillingPanel'];
let current='',depth=0,routeSeq=0;const watchedRoots=new WeakSet();
const modules={analysis:'analysisPanel',prescription:'prescriptionPanel',visualexam:'visualExamPanel',visualExam:'visualExamPanel',indications:'indicationsPanel',hearing:'hearingPanel',clients:'clientsPanel',lac:'lacPanel'};
const routes={showDashboard:()=> 'dashboardPanel',showModule:which=>modules[which]||'',openLacDevice:()=> 'lacPanel',openEyewearSheet:()=> 'eyewearPanel',openWarehouse:()=> 'warehousePanel',openOnlineOrders:()=> 'onlineOrdersPanel',openLaboratory:()=> 'labOrdersPanel',optykerOpenSettings:()=> 'optykerSettingsPanel',optykerOpenAppointments:()=> 'optykerAppointmentsPanel',optykerOpenChat:()=> 'optykerChatPanel',openOptykerDdt:()=> 'optykerDdtPanel',openOptykerCustomerInvoices:()=> 'optykerCustomerInvoicesPanel'};
const navs={navDashboard:'dashboardPanel',navClients:'clientsPanel',navAnalysis:'analysisPanel',navPrescription:'prescriptionPanel',navVisualExam:'visualExamPanel',navIndications:'indicationsPanel',navHearing:'hearingPanel',navWarehouse:'warehousePanel',navLaboratory:'labOrdersPanel',navOnlineOrders:'onlineOrdersPanel',navOrders:'onlineOrdersPanel',navSettings:'optykerSettingsPanel',navAppointments:'optykerAppointmentsPanel',navChat:'optykerChatPanel',navDdt:'optykerDdtPanel',navCustomerInvoices:'optykerCustomerInvoicesPanel'};
function keepExcluded(e){
 if(!window.OPTYKER_BILLING_ADMIN&&e.hasAttribute('data-optyker-route-excluded')&&(e.style.getPropertyValue('display')!=='none'||e.style.getPropertyPriority('display')!=='important'))e.style.setProperty('display','none','important');
}
function watchRoot(e){if(watchedRoots.has(e))return;watchedRoots.add(e);new MutationObserver(()=>keepExcluded(e)).observe(e,{attributes:true,attributeFilter:['style']});}
function excludeOtherRoots(){
 if(!current||window.OPTYKER_BILLING_ADMIN)return;
 ROOTS.forEach(id=>{const e=$(id);if(!e)return;watchRoot(e);const off=id!==current; if(e.hasAttribute('data-optyker-route-excluded')!==off)e.toggleAttribute('data-optyker-route-excluded',off);if(off)keepExcluded(e);});
}
function selectRoot(id,show=true){
 if(!ROOTS.includes(id)||window.OPTYKER_BILLING_ADMIN)return;
 current=id;excludeOtherRoots();const e=$(id);if(e&&show)e.style.setProperty('display','block','important');
 if(!['analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel'].includes(id)){if($('reportSectionTop'))$('reportSectionTop').style.setProperty('display','none','important');}
 if(id!=='analysisPanel'&&$('analysisTabs'))$('analysisTabs').style.setProperty('display','none','important');
}
function wrapRoutes(){
 Object.entries(routes).forEach(([name,target])=>{const fn=window[name];if(typeof fn!=='function'||fn._ovc11Route)return;
  const w=function(...args){const id=target(...args);if(!id||depth||window.OPTYKER_BILLING_ADMIN)return fn.apply(this,args);
   if(current!==id&&!canLeave())return; if(current!==id)closeContext();
   const seq=++routeSeq;selectRoot(id,false);depth++;
   try{const result=fn.apply(this,args);selectRoot(id,true);if(result&&typeof result.then==='function')return result.finally(()=>{if(seq===routeSeq)selectRoot(id,true);});return result;}finally{depth--;}
  };w._ovc11Route=true;Object.assign(w,fn);window[name]=w;
 });
}
window.optykerShowOnlyRootPanel=id=>selectRoot(id);
document.addEventListener('click',e=>{
 const b=e.target.closest?.('#moduleNav button');if(!b||window.OPTYKER_BILLING_ADMIN)return;
 const id=navs[b.id]||(b.closest('#navWarehouseSub')?'warehousePanel':'');if(!id)return;
 if(current!==id&&!canLeave()){e.preventDefault();e.stopImmediatePropagation();return;}
 if(current!==id)closeContext();const seq=++routeSeq;selectRoot(id,false);setTimeout(()=>{if(seq===routeSeq)selectRoot(id,true);},0);
},true);

/* Same clinic header markup and CSS used by prescriptionPrintHtml; no copied logo. */
function decoratePrint(html,title,details=''){
 if(typeof window.prescriptionPrintHtml!=='function')throw Error('Intestazione della prescrizione non disponibile. Riapri Optyker.');
 const parser=new DOMParser(),rx=parser.parseFromString(window.prescriptionPrintHtml(),'text/html'),head=rx.querySelector('.head');
 if(!head)throw Error('Intestazione della prescrizione non trovata.');
 const doc=parser.parseFromString(html,'text/html');doc.title=title;
 doc.querySelector('[data-ovc-print-header]')?.remove();const copy=doc.importNode(head,true);copy.setAttribute('data-ovc-print-header','true');doc.body.prepend(copy);
 const rules=[...rx.querySelectorAll('style')].map(s=>s.textContent).join('\n').match(/(?:\.head(?:\s+img)?|\.clinic(?:\s+b)?)\s*\{[^}]*\}/g)||[];
 const css=doc.createElement('style');css.textContent=rules.join('\n')+'\n@page{size:A4 portrait;margin:.01mm}body{box-sizing:border-box;margin:0!important;padding:2.8mm 4.5mm 2.5mm!important}.head{font-family:Segoe UI,Arial,sans-serif;box-sizing:border-box}h1.ovcQuotePrintTitle{color:#b42332;font-size:22px}.ovcPrintMeta{font-size:12px;margin-bottom:16px}';doc.head.append(css);
 let h1=doc.body.querySelector('h1');if(!h1){h1=doc.createElement('h1');copy.after(h1);}h1.textContent=title;if(/preventivo/i.test(title))h1.classList.add('ovcQuotePrintTitle');
 if(details){const p=doc.createElement('p');p.className='ovcPrintMeta';p.textContent=details;h1.after(p);}
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
async function finishPrint(w){
 try{await Promise.all([...w.document.images].map(i=>i.decode?i.decode().catch(()=>{}):Promise.resolve()));if(w.document.fonts)await w.document.fonts.ready;await new Promise(r=>setTimeout(r,120));if(!w.closed){w.focus();w.print();}}catch(e){console.warn('Stampa automatica non avviata',e);}
}
window.optykerQuotePrint={decorate:decoratePrint,finish:finishPrint};

/* Global prices live in warehouse Services; customer overrides never mutate defaults. */
function openTariffs(clientId='',name=''){
 const d=dialog(clientId?'Tariffe OVC Card · '+(name||'cliente'):'Magazzino → Servizi · Tariffe OVC Card');
 const personal=!!clientId;let seq=0,timer;const dirty=new Set();
 const call=(action,p)=>personal?rpc('optyker_ovc_client_prices_api',action,{...p,client_id:clientId}):rpc('optyker_ovc_api',action==='list'?'service_list':'service_price_set',p);
 d.querySelector('section').innerHTML='<p>'+(personal?'I prezzi predefiniti arrivano da Magazzino → Servizi. Le modifiche qui valgono soltanto per questo cliente. <b>Vuoto = eredita il prezzo OVC del magazzino; 0,00 € = gratuito.</b>':'Imposta qui i prezzi OVC Card predefiniti dei servizi. Le personalizzazioni dei singoli clienti restano invariate. <b>Vuoto = prezzo standard; 0,00 € = gratuito.</b>')+'</p><input class="ovc11Search" type="search" placeholder="Cerca servizio…" aria-label="Cerca servizio"><div class="ovc11TariffRows"></div>';
 const box=d.querySelector('.ovc11TariffRows'),search=d.querySelector('input');
 d.addEventListener('close',()=>{seq++;clearTimeout(timer);});
 async function load(){const n=++seq;box.textContent='Caricamento…';
  try{const x=await call('list',{search:search.value});if(!d.open||seq!==n)return;const rows=x.data||[];
   box.innerHTML=rows.length?rows.map(r=>'<div class="ovc11TariffRow"><div><h3>'+esc(r.title)+'</h3><small>Standard: '+euro(r.standard_price)+(personal?' · OVC magazzino: '+euro(r.default_card_price??r.standard_price):'')+'</small></div><label>'+ (personal?'Prezzo personale':'Prezzo OVC predefinito')+'<input inputmode="decimal" maxlength="12" aria-label="Prezzo '+esc(r.title)+'" value="'+(r.card_price==null?'':Number(r.card_price).toFixed(2).replace('.',','))+'" placeholder="'+(personal?'Eredita':'Standard')+'"></label><button type="button">Salva</button><small role="status"></small></div>').join(''):'<p>Nessun servizio trovato.</p>';
   box.querySelectorAll('.ovc11TariffRow').forEach((row,i)=>{let r=rows[i];const input=row.querySelector('input'),save=row.querySelector('button'),note=row.querySelector('[role=status]');input.oninput=()=>{dirty.add(r.id);d._dirty=true;};save.onclick=async()=>{
    const raw=input.value.trim().replace(',','.');if(raw&&!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)>1000000){note.textContent='Usa un importo non negativo con massimo due decimali.';return;}
    save.disabled=input.disabled=true;note.textContent='Salvataggio…';try{const result=await call('set',{item_id:r.id,card_price:raw===''?null:Number(raw),revision:r.revision});r.revision=result.data.revision;dirty.delete(r.id);d._dirty=dirty.size>0;note.textContent=personal?(raw===''?'Prezzo del magazzino ripristinato':'Prezzo personalizzato salvato'):'Prezzo predefinito salvato';window.dispatchEvent(new CustomEvent('optyker:ovc-updated',{detail:{client_id:clientId||null}}));}catch(e){note.textContent=message(e);}finally{save.disabled=input.disabled=false;}
   };});
  }catch(e){if(d.open&&seq===n)box.textContent=message(e);}
 }
 search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(d._dirty){status(d,'Salva le modifiche prima di cambiare ricerca.');return;}load();},250);};
 status(d,'Le tariffe si applicano con card attiva. I documenti già registrati non vengono ricalcolati.');load();
}
window.optykerOpenOvcClientTariffs=(id,name)=>openTariffs(id,name);

function openWarranty(clientId){
 if(!clientId)return;
 const d=dialog('Garanzia Base · montatura del cliente'),body=d.querySelector('section');let seq=0;
 const call=(a,p={})=>rpc('optyker_eyewear_warranty_api',a,{...p,client_id:clientId});
 async function load(){const n=++seq;body.textContent='Caricamento…';try{const x=await call('list');if(!d.open||seq!==n)return;
  body.innerHTML='<p>'+esc(ownText)+'</p>'+(x.data.length?x.data.map(r=>'<article class="ovc11WarrantyRow"><h3>'+esc(r.reference_code||'Busta occhiali')+'</h3><p>Ricambi utilizzati: <b>'+r.replacements_used+' / 2</b></p>'+(r.starts_on?'<p>Consegna: '+esc(r.starts_on)+' · Sconto attuale: '+Number(r.current_discount||0)+'%</p><label>Prezzo di listino delle sole lenti (€)<input type="text" inputmode="decimal" placeholder="0,00"></label><button type="button" '+(r.replacements_used>=2||!r.current_discount?'disabled':'')+'>Registra ricambio lenti</button>':'<label>Data effettiva di consegna<input type="date"></label><button type="button">Conferma decorrenza</button>')+'<div role="status"></div>'+r.replacements.map(q=>'<p class="ovc11Muted">'+esc(q.date)+' · Sconto '+q.discount_percent+'% · Importo '+euro(q.payable)+'</p>').join('')+'</article>').join(''):'<p>Nessuna busta con montatura del cliente.</p>');
  body.querySelectorAll('article').forEach((row,i)=>{const r=x.data[i],input=row.querySelector('input'),button=row.querySelector('button'),note=row.querySelector('[role=status]');let requestId=crypto.randomUUID();
   button.onclick=async()=>{if(button.disabled)return;
    const value=input.value.trim();let payload,action;
    if(!r.starts_on){if(!value){note.textContent='Inserisci la data effettiva di consegna.';return;}action='activate';payload={starts_on:value};if(!confirm('Attivare i due anni dalla consegna del '+value+'? La data non potrà essere prolungata.'))return;}
    else {const raw=value.replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)<=0){note.textContent='Inserisci il prezzo delle sole lenti.';return;}action='replace';payload={lens_list_price:Number(raw),request_id:requestId};if(!confirm('Registrare un ricambio lenti con sconto '+r.current_discount+'% e importo '+euro(Number(raw)*(100-r.current_discount)/100)+'? Verrà utilizzato uno dei due ricambi. Nessuno scontrino o fattura viene emesso da questo pulsante.'))return;}
    button.disabled=true;note.textContent='Registrazione…';try{await call(action,{...payload,source_sheet_id:r.id,confirm:true});await load();}catch(e){note.textContent=message(e);const retry=document.createElement('button');retry.type='button';retry.textContent='Aggiorna stato';retry.onclick=load;note.append(retry);}
   };
  });
 }catch(e){if(d.open&&seq===n)body.textContent=message(e);}}
 d.addEventListener('close',()=>seq++);status(d,'Solo lenti. Massimo due ricambi complessivi, non due per anno.');load();
}

/* FIC is the existing authorized account. The operator is not promoted to billing admin. */
async function billingCall(action,payload={},token=adminToken){
 const c=credentials(),r=await fetch(c.root+'/functions/v1/optyker-billing-admin',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(130000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({...payload,action})});
 const x=await r.json();if(!r.ok||!x.ok){if(r.status===401)adminToken='';throw Error(x.error||'Fatture in Cloud non disponibile');}return x;
}
function adminAuthorization(){
 if(adminToken)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const d=dialog('Autorizzazione Amministrazione'),who=credentials().username;let done=false;
  d.querySelector('section').innerHTML='<p>Per creare o sincronizzare fatture usa la password dell’utenza amministrativa <b>Ottica Visual Care</b>. La sessione operatore rimane invariata.</p><form><label>Password amministrazione<input type="password" autocomplete="current-password" required minlength="8"></label><button type="submit">Autorizza</button></form>';
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=d.querySelector('input'),button=d.querySelector('form button');button.disabled=true;status(d,'Verifica…');try{const x=await billingCall('login',{username:'Ottica Visual Care',password:input.value},'');input.value='';if(!d.open||!logged()||credentials().username!==who)throw Error('Sessione cambiata.');adminToken=x.token;done=true;d.close();resolve();}catch(e){status(d,message(e));button.disabled=false;}};
  d.addEventListener('close',()=>{if(!done)reject(Error('Autorizzazione annullata'));});
 });
}
function loadComposer(){
 if(window.OptykerInvoices)return Promise.resolve();
 return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('billing-compose.js?v='+VERSION,root).href;s.onload=()=>window.OptykerInvoices?resolve():reject(Error('Modulo fatture non disponibile'));s.onerror=()=>reject(Error('Caricamento modulo fatture non riuscito'));document.head.append(s);});
}
function openClientBilling(clientId){
 if(!clientId){alert('Seleziona prima il cliente.');return;}
 const d=dialog('Fatturazione cliente · Fatture in Cloud'),body=d.querySelector('section');let seq=0;
 async function load(){const n=++seq;body.textContent='Caricamento…';try{
  const x=await rpc('optyker_client_billing_api','list',{client_id:clientId});if(!d.open||seq!==n)return;
  body.innerHTML='<h3>'+esc(x.client.name)+'</h3><p>'+(x.provider?.connected?'Account Fatture in Cloud collegato.':'Account Fatture in Cloud da collegare in Amministrazione.')+'</p><div class="ovc11Actions"><button type="button" data-fic-new>Nuova fattura</button><button type="button" data-fic-sync>Sincronizza Fatture in Cloud</button><button type="button" data-fic-refresh>Aggiorna elenco</button></div><h3>Fatture</h3>'+(x.data.length?'<div class="ovc11InvoiceList">'+x.data.map(r=>'<article><b>'+esc(r.invoice_number||'Senza numero')+'</b><span>'+esc(r.issue_date||'')+' · '+euro(r.total)+' · '+esc(r.sdi_status||'')+'</span><small>'+esc(r.counterparty_name||'')+'</small><small>'+esc(r.header||'')+'</small></article>').join('')+'</div>':'<p>Nessuna fattura collegata a questo cliente.</p>')+((x.pos_requests||[]).length?'<h3>Pagamenti in cassa da fatturare</h3>'+(x.pos_requests||[]).map(r=>'<button class="ovc11Draft" type="button" data-pos="'+esc(r.id)+'">'+esc(r.issue_date)+' · '+euro(r.total)+' · Completa fattura FIC</button>').join(''):'')+'<h3>Bozze e pratiche collegate</h3>'+(x.drafts.length?x.drafts.map(r=>'<button class="ovc11Draft" type="button" data-draft="'+esc(r.id)+'">'+esc(r.issue_date||'')+' · '+esc(r.state)+' · '+euro(r.total)+'</button>').join(''):'<p>Nessuna bozza.</p>');
  body.querySelector('[data-fic-refresh]').onclick=load;
  body.querySelector('[data-fic-sync]').onclick=async()=>{d.close();try{await adminAuthorization();const progress=dialog('Sincronizzazione Fatture in Cloud');progress.querySelector('section').textContent='Aggiornamento documenti, senza emissione di nuove fatture…';try{await billingCall('sync');progress.close();openClientBilling(clientId);}catch(e){status(progress,message(e));}}catch(e){if(!/annullata/.test(message(e)))alert(message(e));}};
  async function composer(draftId,pos){d.close();try{await adminAuthorization();await loadComposer();window.OptykerInvoices.open({clientId:clientId,call:billingCall,onChanged:()=>window.dispatchEvent(new CustomEvent('optyker:client-invoices-updated',{detail:{client_id:clientId}})),...(draftId?{draftId}:{prefill:{client_id:clientId,pos_source_id:pos?.id,pos_total:pos?.total,subject:pos?.header||'',series:'retail',date:today(),due_date:today(),entity:{...x.client,id:undefined,type:x.client.vat_number?'company':'person',country:'Italia',ei_code:'0000000'},items:[],channel:''}})});}catch(e){if(!/annullata/.test(message(e)))alert(message(e));}}
  body.querySelector('[data-fic-new]').onclick=()=>composer();body.querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>composer(b.dataset.draft));body.querySelectorAll('[data-pos]').forEach(b=>b.onclick=()=>composer(null,x.pos_requests.find(p=>p.id===b.dataset.pos)));
 }catch(e){if(d.open&&seq===n)body.textContent=message(e);}}
 d.addEventListener('close',()=>seq++);status(d,'Anteprima e conferma restano obbligatorie. Aprire questa schermata non emette né invia fatture.');load();
}
window.optykerOpenClientBilling=openClientBilling;

function installClientButtons(){
 const parent=$('clientAnagraficaSection'),cid=String(window.clientCurrentId||'');if(!parent||!cid||!logged())return;
 let bar=$('optykerClientWorkflowActions');if(!bar){bar=document.createElement('div');bar.id='optykerClientWorkflowActions';bar.className='ovc11Actions';bar.innerHTML='<button type="button" data-client-billing>Fatturazione · Fatture in Cloud</button><button type="button" data-client-warranty>Garanzia lenti · montatura del cliente</button>';parent.prepend(bar);bar.querySelector('[data-client-billing]').onclick=()=>openClientBilling(String(window.clientCurrentId||''));bar.querySelector('[data-client-warranty]').onclick=()=>openWarranty(String(window.clientCurrentId||''));}
}
function markQuotes(){
 document.querySelectorAll('#eyRecentList .eyRecentRow').forEach(r=>{const yes=/preventivo/i.test(r.textContent);if(r.hasAttribute('data-ovc-quote')!==yes)r.toggleAttribute('data-ovc-quote',yes);});
 const mode=$('eyModeQuote');if($('eyewearPanel'))$('eyewearPanel').toggleAttribute('data-ovc-quote',!!mode?.classList.contains('active'));
}
let lastClient='';
function tick(){
 wrapRoutes();
 if(!logged()){adminToken='';sessionUser='';return;}
 if(sessionUser!==credentials().username){adminToken='';sessionUser=credentials().username;}
 if(window.OPTYKER_BILLING_ADMIN){ROOTS.forEach(id=>$(id)?.removeAttribute('data-optyker-route-excluded'));return;}
 if(!current){const active=document.querySelector('#moduleNav .moduleBtn.active');current=navs[active?.id]||'dashboardPanel';}
 excludeOtherRoots();installClientButtons();markQuotes();
 const cid=String(window.clientCurrentId||'');if(lastClient&&lastClient!==cid){closeContext();const q=$('optykerQuoteModal');if(q)q.remove();}lastClient=cid;
}
window.OPTYKER_SEPT11={version:VERSION,openTariffs,openWarranty,openClientBilling,selectRoot,decoratePrint,ownText};
function boot(){tick();setInterval(()=>{if(!document.hidden)tick();},800);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
