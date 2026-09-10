/* Optyker OVC Card + eyewear order UI. Data uses authenticated server APIs only. */
(function(){
 'use strict';if(window.__optykerOperationsV2)return;window.__optykerOperationsV2=true;
 const $=id=>document.getElementById(id),root=document.documentElement;
 const logo=new URL('ovc-card-logo.png',document.currentScript?.src||location.href).href;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const euro=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(x||0));
 const C={id:'',seq:0,card:null,loaded:0,loading:false,busy:false};let orderBusy=false,sentRef='';
 function creds(){const c=window.OPTYKER_CLOUD||{};return {username:String(c.username||''),password:String(c.password||''),root:c.root,key:c.key};}
 function logged(){const c=creds();return !!(window.optykerAuthenticated&&c.username&&c.password);}
 async function rpc(name,action,payload){
   const c=creds();if(!logged())throw Error('Sessione operatore non disponibile. Accedi nuovamente.');
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
   try{const r=await fetch(c.root+'/rest/v1/rpc/'+name,{method:'POST',cache:'no-store',signal:abort.signal,
     headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},
     body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload})});
     const x=await r.json();if(!r.ok||x?.ok!==true)throw Error(x?.error||'Risposta del server non valida');
     if(creds().username!==c.username||!logged())throw Error('Sessione cambiata: riapri la scheda.');return x;
   }catch(e){if(e.name==='AbortError')throw Error('Risposta non ricevuta. Ricarica per verificare lo stato prima di riprovare.');throw e;}finally{clearTimeout(timer);}
 }
 const cardApi=(a,p)=>rpc('optyker_ovc_api',a,p);
 const orderApi=(a,p)=>rpc('optyker_eyewear_order_api',a,p);
 function currentName(){const a=window.OPTYKER_CLOUD?.clients||[];const c=a.find(x=>String(x.id)===C.id);return c?[c.name,c.surname].filter(Boolean).join(' '):$('clientWorkspaceName')?.textContent||'Cliente';}
 function cardContainer(){
   const parent=$('clientAnagraficaSection');if(!parent)return null;
   let el=$('ovcCardSection');if(!el){el=document.createElement('section');el.id='ovcCardSection';el.setAttribute('aria-label','OVC Card del cliente');const anchor=parent.querySelector('.clientIdentityHeader');if(anchor)anchor.after(el);else parent.prepend(el);}return el;
 }
 function renderCard(error=''){
   const el=cardContainer();if(!el)return;el.hidden=!C.id||!logged();if(el.hidden){el.replaceChildren();return;}
   const c=C.card;
   el.innerHTML='<div class="ovcMembership" data-active="'+(c?.active===true)+'"><div class="ovcMembershipTop"><div><div class="ovcMembershipEyebrow">OTTICA VISUAL CARE · SERVIZI RISERVATI</div><div class="ovcMembershipTitle">OVC CARD</div></div><img class="ovcMembershipLogo" src="'+esc(logo)+'" alt="Logo originale Ottica Visual Care"></div><div><div class="ovcMembershipName">'+esc(currentName())+'</div><div class="ovcMembershipBottom"><span>'+(c?'N. '+String(c.card_number).padStart(6,'0'):'Verifica card…')+'</span><span>'+(c?(c.active?'ATTIVA':'NON ATTIVA'):'')+'</span></div></div></div><div class="ovcCardControls"><h3>Un’attenzione in più, ogni giorno.</h3>'+(c?'<label class="ovcToggle"><input id="ovcCardToggle" type="checkbox" role="switch" '+(c.active?'checked':'')+' '+(C.busy?'disabled':'')+'><span>OVC CARD '+(c.active?'attiva':'non attiva')+'</span></label>':'')+'<p>La card viene creata automaticamente per ogni cliente. Quando è attiva, in cassa si applicano le tariffe dedicate dei servizi configurati.</p><button type="button" id="ovcCardTariffs" class="ovcButton red">Tariffe OVC Card</button><div id="ovcCardFeedback" role="status">'+esc(error||(C.loading?'Verifica dello stato…':''))+'</div>'+(error?'<button id="ovcCardRetry" class="ovcButton" type="button">Riprova</button>':'')+'</div>';
   $('ovcCardTariffs').onclick=openTariffs;if($('ovcCardRetry'))$('ovcCardRetry').onclick=()=>loadCard(true);
   if($('ovcCardToggle'))$('ovcCardToggle').onchange=async ev=>{
     const id=C.id,revision=C.card.revision,active=ev.target.checked;if(C.busy)return;C.busy=true;ev.target.disabled=true;
     try{const x=await cardApi('card_set',{client_id:id,active,revision});if(C.id===id){C.card=x.data;C.loaded=Date.now();renderCard();}window.dispatchEvent(new CustomEvent('optyker:ovc-updated',{detail:{client_id:id}}));}
     catch(e){if(C.id===id)renderCard(e.message);}finally{C.busy=false;if($('ovcCardToggle'))$('ovcCardToggle').disabled=false;}
   };
 }
 async function loadCard(force=false){
   const id=logged()?String(window.clientCurrentId||''):'';
   if(id!==C.id){C.id=id;C.card=null;C.loaded=0;C.loading=false;C.seq++;C.busy=false;}
   if(!id){renderCard();return;}
   if(C.loading||(!force&&Date.now()-C.loaded<60000))return;
   const seq=++C.seq;C.loading=true;renderCard();
   try{const x=await cardApi('card_get',{client_id:id});if(seq===C.seq&&String(window.clientCurrentId||'')===id){C.card=x.data;C.loaded=Date.now();C.loading=false;renderCard();}}
   catch(e){if(seq===C.seq){C.loaded=Date.now();C.loading=false;renderCard(e.message);}}
 }
 let tariffsSeq=0,tariffsTimer;let dirtyTariffs=false;
 function tariffDialog(){
   let d=$('ovcTariffDialog');if(d)return d;d=document.createElement('dialog');d.id='ovcTariffDialog';d.className='ovcDialog';d.setAttribute('aria-labelledby','ovcTariffTitle');document.body.append(d);d.addEventListener('cancel',e=>{if(dirtyTariffs&&!confirm('Chiudere senza salvare le tariffe modificate?'))e.preventDefault();});d.addEventListener('close',()=>{tariffsSeq++;dirtyTariffs=false;});return d;
 }
 function openTariffs(){
   const d=tariffDialog();d.innerHTML='<header class="ovcDialogHead"><div><h2 id="ovcTariffTitle">Tariffe OVC Card</h2><p>Prezzi riservati sui servizi · Ottica Visual Care</p></div><button type="button" aria-label="Chiudi tariffe">×</button></header><div class="ovcDialogBody"><p>Il prezzo standard si modifica nella scheda del servizio in Magazzino. Qui imposti la tariffa OVC CARD: <b>vuoto = prezzo standard; 0,00 € = gratuito</b>. Salva ogni riga modificata.</p><input id="ovcTariffSearch" type="search" placeholder="Cerca un servizio…" aria-label="Cerca servizio"><div id="ovcTariffRows"></div></div><footer class="ovcDialogFoot" id="ovcTariffFeedback" role="status">Le tariffe si applicano alle nuove vendite; i documenti già registrati non vengono ricalcolati.</footer>';
   d.querySelector('header button').onclick=()=>{if(!dirtyTariffs||confirm('Chiudere senza salvare le tariffe modificate?'))d.close();};
   $('ovcTariffSearch').oninput=()=>{clearTimeout(tariffsTimer);tariffsTimer=setTimeout(()=>{if(dirtyTariffs){$('ovcTariffFeedback').textContent='Salva le righe modificate prima di cambiare ricerca.';return;}fetchTariffs();},250);};
   if(!d.open)d.showModal();dirtyTariffs=false;fetchTariffs();
 }
 async function fetchTariffs(){
   const seq=++tariffsSeq,box=$('ovcTariffRows');if(!box)return;box.textContent='Caricamento servizi…';
   try{const x=await cardApi('service_list',{search:$('ovcTariffSearch').value});if(seq!==tariffsSeq||!tariffDialog().open)return;
     const rows=x.data||[];box.innerHTML=rows.length?rows.map(r=>'<div class="ovcServiceRow" data-id="'+esc(r.id)+'"><div><h3>'+esc(r.title)+'</h3><small>'+esc(r.variant_title==='Default Title'?'':r.variant_title||'')+'</small></div><div><small>Standard</small><b>'+euro(r.standard_price)+'</b></div><label>PREZZO OVC CARD<input type="text" inputmode="decimal" maxlength="12" aria-label="Prezzo OVC Card '+esc(r.title)+'" value="'+(r.card_price==null?'':Number(r.card_price).toFixed(2).replace('.',','))+'" placeholder="Standard"></label><button type="button" class="ovcButton red">Salva</button><div class="ovcInlineMessage" role="status" hidden></div></div>').join(''):'<p>Nessun servizio trovato. Inserisci i servizi dalla sezione Magazzino → Servizi.</p>';
     const changed=new Set();box.querySelectorAll('.ovcServiceRow').forEach((el,i)=>{let r=rows[i];const input=el.querySelector('input'),button=el.querySelector('button'),feedback=el.querySelector('[role=status]');input.oninput=()=>{changed.add(r.id);dirtyTariffs=changed.size>0;};button.onclick=async()=>{
       const text=input.value.trim().replace(',','.');if(text&&!/^\d+(\.\d{1,2})?$/.test(text)||Number(text)>1000000){feedback.hidden=false;feedback.textContent='Usa un importo non negativo con massimo due decimali.';return;}
       button.disabled=true;input.disabled=true;feedback.hidden=true;
       try{const result=await cardApi('service_price_set',{item_id:r.id,card_price:text===''?null:Number(text),revision:r.revision});r={...r,revision:result.data.revision};changed.delete(r.id);dirtyTariffs=changed.size>0;feedback.hidden=false;feedback.style.color='#167769';feedback.textContent='Tariffa salvata';window.dispatchEvent(new CustomEvent('optyker:ovc-updated'));}
       catch(e){feedback.hidden=false;feedback.style.color='';feedback.textContent=e.message;}finally{button.disabled=false;input.disabled=false;}
     };});
   }catch(e){if(seq===tariffsSeq)box.textContent='Impossibile caricare le tariffe: '+e.message;}
 }
 function orderStatus(text,link=false){let el=$('eyOrderStatus');if(!el){const actions=document.querySelector('#eyewearPanel .eyFinalActions');if(!actions)return;el=document.createElement('div');el.id='eyOrderStatus';el.setAttribute('role','status');actions.after(el);}el.textContent=text;if(link){const b=document.createElement('button');b.className='ovcButton';b.type='button';b.textContent='Apri laboratorio';b.onclick=()=>window.openLaboratory?.();el.append(' ',b);}}
 async function sendOrder(savedRow=null){
   if(orderBusy)return;const bridge=window.optykerEyewearOrderBridge;
   try{
     let context=null;
     if(!savedRow){if(!bridge)throw Error('Modulo Occhiali in caricamento. Riprova.');context=bridge.capture();if(!context)return;if(context.mode!=='job')throw Error('Crea una Busta Occhiali: un preventivo non può essere ordinato.');if(!context.client_id)throw Error('Seleziona il cliente prima di ordinare.');}
     const row=savedRow||bridge.saved(context);
     if(!confirm('Inviare '+(row?.reference_code||'questa Busta Occhiali')+' al Laboratorio?\n\nL’ordine sarà collegato al cliente e inizierà dallo stato Da fare.'))return;
     orderBusy=true;ensureOrderButton();orderStatus('Salvataggio Busta e invio al laboratorio…');
     const r=row?(savedRow?row:await bridge.latest(row)):await bridge.persist(context);
     if(!r?.id||!r.client_id)throw Error('Salvataggio della Busta non confermato.');
     const result=await orderApi('submit',{client_id:r.client_id,source_sheet_id:r.id,updated_at:r.updated_at});
     sentRef=r.reference_code||result.data.reference_code||'';
     orderStatus((result.already_sent?'Ordine già presente in laboratorio':'Ordine inviato al laboratorio')+' · '+sentRef+'. Stato: '+({da_fare:'Da fare',in_preparazione:'In preparazione',costruzione:'In costruzione',in_spedizione:'In spedizione'}[result.data.status]||result.data.status),true);
     try{if(window.cloudLoadSheets&&window.clientCurrentId===r.client_id)window.cloudLoadSheets(r.client_id).catch(()=>{});}catch(e){}
   }catch(e){orderStatus(e.message);}
   finally{orderBusy=false;ensureOrderButton();}
 }
 function ensureOrderButton(){
   const actions=document.querySelector('#eyewearPanel .eyFinalActions');if(!actions)return;
   let b=$('eyOrderProduct');if(!b){b=document.createElement('button');b.id='eyOrderProduct';b.type='button';b.textContent='Ordina prodotto';actions.append(b);b.onclick=()=>sendOrder();}
   const job=$('eyModeJob')?.classList.contains('active');b.hidden=!job;b.disabled=orderBusy;
   b.textContent=orderBusy?'Invio in corso…':'Ordina prodotto';
   if($('eySave'))$('eySave').disabled=orderBusy||!!window.optykerEyewearOrderBridge?.busy();
   const saved=window.optykerEyewearRecentRows?.()||[];
   document.querySelectorAll('#eyRecentList .eyRecentRow').forEach((el,i)=>{const r=saved[i];if(!r||r.sheet_type!=='eyewear_job'||!r.client_id||el.querySelector('.ovcRecentOrder'))return;const b=document.createElement('button');b.className='ovcRecentOrder';b.type='button';b.textContent='Ordina prodotto';b.onclick=()=>sendOrder(r);el.append(b);});
 }
 function ensureWarehouse(){const head=document.querySelector('#warehousePanel .whHeadActions');if(head&&!$('whOvcTariffs')){const b=document.createElement('button');b.id='whOvcTariffs';b.type='button';b.className='whBtn';b.textContent='Tariffe OVC Card';b.onclick=openTariffs;head.prepend(b);}}
 function tick(){if(!logged()){if(C.id){C.id='';C.card=null;C.seq++;renderCard();}if($('ovcTariffDialog')?.open)$('ovcTariffDialog').close();return;}
   ensureWarehouse();ensureOrderButton();const p=$('clientsPanel');if(p&&p.getClientRects().length)loadCard(false);}
 function boot(){root.setAttribute('data-ovc-ui','2');tick();setInterval(()=>{if(!document.hidden)tick();},800);window.addEventListener('focus',()=>loadCard(true));window.addEventListener('optyker:eyewear-saved',()=>{orderStatus('Busta salvata. Premi Ordina prodotto per inviarla al Laboratorio.');});}
 window.optykerOpenOvcTariffs=openTariffs;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
