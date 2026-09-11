/* OVC default service prices. No customer override or standard-price writes. */
(function(){
'use strict';
if(window.optykerWarehouseCardDefaults)return;
const VERSION='20260911-card-defaults1',$=id=>document.getElementById(id);
const euro=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v));
const ctx=()=>window.OPTYKER_CLOUD||{};
const user=()=>window.optykerAuthenticated?String(ctx().username||''):'';
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
async function call(action,payload){
 const c=ctx(),owner=user();if(!owner||!c.password)throw Error('Accedi con un operatore autorizzato.');
 const r=await fetch(c.root+'/rest/v1/rpc/optyker_ovc_api',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:owner,p_password:c.password,p_action:action,p_payload:payload})});
 const x=await r.json();if(!r.ok||x.ok!==true)throw Error(x.error||'Tariffe non disponibili.');if(user()!==owner)throw Error('Sessione cambiata. Riapri il servizio.');return x.data;
}
function err(e){return ['TimeoutError','AbortError'].includes(e.name)?'Risposta non ricevuta: premi Ricarica per verificare il prezzo salvato prima di riprovare.':e.message||String(e);}
async function readService(item){
 const rows=await call('service_list',{search:String(item.title||'').slice(0,100)});
 if(!Array.isArray(rows))throw Error('Elenco tariffe non valido.');
 const row=rows.find(r=>String(r.id)===String(item.id));if(!row)throw Error('Servizio non disponibile. Chiudi e riapri dal magazzino aggiornato.');return row;
}
function editor(parent,item){
 const box=node('section',undefined,'whOvcDefaultEditor');box.dataset.serviceId=item.id||'';
 box.append(node('h3','Prezzo OVC Card predefinito'));
 box.append(node('p','Vale per i clienti con card attiva, salvo un prezzo personale nella loro scheda. Vuoto = prezzo standard; 0,00 € = gratuito.'));
 parent.append(box);
 if(!item.id){box.append(node('p','Inserisci prima il servizio. Poi apri Mod. per impostare il prezzo OVC Card.'));return {dirty:()=>false,busy:()=>false};}
 const standard=node('p','Caricamento prezzo standard…','whOvcStandard');
 const label=node('label','Prezzo OVC Card predefinito (€)'),input=node('input');input.type='text';input.inputMode='decimal';input.maxLength=12;input.placeholder='Prezzo standard';input.setAttribute('aria-label','Prezzo OVC Card predefinito');input.autocomplete='off';input.disabled=true;label.append(input);
 const actions=node('div',undefined,'whOvcDefaultActions'),save=node('button','Salva prezzo OVC'),reload=node('button','Ricarica'),note=node('div');note.setAttribute('role','status');note.setAttribute('aria-live','polite');
 save.type=reload.type='button';save.disabled=true;actions.append(save,reload);box.append(standard,label,actions,note);
 let row=null,dirty=false,busy=false,seq=0;
 const state={dirty:()=>dirty,busy:()=>busy};
 input.addEventListener('input',()=>{dirty=true;box.dataset.dirty='true';});
 async function load(){const n=++seq;input.disabled=save.disabled=reload.disabled=true;note.textContent='Caricamento tariffa…';
  try{const r=await readService(item);if(!box.isConnected||n!==seq)return;row=r;input.value=r.card_price==null?'':Number(r.card_price).toFixed(2).replace('.',',');standard.textContent='Prezzo standard: '+euro(r.standard_price);dirty=false;box.dataset.dirty='false';note.textContent=r.card_price==null?'Prezzo OVC non impostato: viene usato lo standard.':'Prezzo OVC predefinito: '+euro(r.card_price);input.disabled=save.disabled=false;}
  catch(e){if(box.isConnected&&n===seq){row=null;note.textContent=err(e);}}finally{if(box.isConnected&&n===seq)reload.disabled=false;}
 }
 reload.onclick=()=>{if(!busy&&(!dirty||confirm('Ricaricare senza salvare il prezzo OVC modificato?')))load();};
 save.onclick=async()=>{
  if(busy||!row)return;
  const text=input.value.trim().replace(',','.');if(text&&!/^\d+(\.\d{1,2})?$/.test(text)||Number(text)>1000000){note.textContent='Inserisci un importo non negativo con massimo due decimali.';return;}
  const value=text===''?null:Number(text);busy=true;save.disabled=input.disabled=reload.disabled=true;note.textContent='Salvataggio…';
  try{
   const r=await call('service_price_set',{item_id:item.id,card_price:value,revision:row.revision});
   if(String(r?.item_id)!==String(item.id)||!Number.isInteger(Number(r.revision)))throw Error('Conferma del salvataggio incompleta. Premi Ricarica.');
   row={...row,card_price:r.card_price,revision:r.revision};dirty=false;box.dataset.dirty='false';
   if(box.isConnected){input.value=r.card_price==null?'':Number(r.card_price).toFixed(2).replace('.',',');note.textContent=r.card_price==null?'Salvato: usa il prezzo standard.':'Prezzo OVC predefinito salvato: '+euro(r.card_price);}
   window.dispatchEvent(new CustomEvent('optyker:ovc-updated',{detail:{item_id:item.id,default_price:true}}));
  }catch(e){if(box.isConnected)note.textContent=err(e);row=null;}finally{busy=false;if(box.isConnected){reload.disabled=false;input.disabled=save.disabled=!row;}}
 };
 box._state=state;load();return state;
}
function open(item){
 const d=node('dialog',undefined,'ovc11Dialog whOvcDefaultDialog');d.dataset.optykerContext='true';
 const head=node('header'),title=node('h2','Prezzo OVC Card · '+item.title),close=node('button','×');close.type='button';close.setAttribute('aria-label','Chiudi prezzo OVC');head.append(title,close);
 const body=node('section',undefined,'ovc11Body'),footer=node('footer','Prezzo predefinito del magazzino. Nessuna modifica alle tariffe personali o alle vendite già registrate.');d.append(head,body,footer);document.body.append(d);
 const state=editor(body,item);d._canClose=()=>!state.busy()&&(!state.dirty()||confirm('Chiudere senza salvare il prezzo OVC modificato?'));
 close.onclick=()=>{if(d._canClose())d.close();};d.addEventListener('cancel',e=>{if(!d._canClose())e.preventDefault();});d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();
}
function mountEditor(modal,item){
 if(modal.querySelector('.whOvcDefaultEditor'))return;
 const parent=node('div');modal.querySelector('.whFormFooter').before(parent);const state=editor(parent,item);
 ['whsSave','whsCancel'].forEach(id=>{const b=$(id);if(!b)return;b.addEventListener('click',e=>{if(state.busy()||state.dirty()){e.preventDefault();e.stopImmediatePropagation();parent.querySelector('[role=status]').textContent=state.busy()?'Attendi il salvataggio del prezzo OVC.':'Premi Salva prezzo OVC oppure Ricarica prima di chiudere o salvare il servizio.';}},true);});
 const close=modal.querySelector('.whModalClose');if(close)close.addEventListener('click',e=>{if(state.busy()||state.dirty()&&!confirm('Chiudere senza salvare il prezzo OVC modificato?')){e.preventDefault();e.stopImmediatePropagation();}},true);
 modal.addEventListener('click',e=>{if(e.target===modal&&(state.busy()||state.dirty()&&!confirm('Chiudere senza salvare il prezzo OVC modificato?'))){e.preventDefault();e.stopImmediatePropagation();}},true);
}
function mountTable(box,items){
 const cells=[...box.querySelectorAll('[data-ovc-default-id]')];
 cells.forEach(cell=>{const item=items.find(x=>String(x.id)===cell.dataset.ovcDefaultId);if(!item)return;const value=node('span','Verifica…','whOvcDefaultValue'),b=node('button','Imposta prezzo Card','whOvcDefaultButton');b.type='button';b.onclick=()=>open(item);cell.replaceChildren(value,b);});
 call('service_list',{search:''}).then(rows=>{if(!box.isConnected||!Array.isArray(rows))return;cells.forEach(cell=>{if(!cell.isConnected)return;const row=rows.find(x=>String(x.id)===cell.dataset.ovcDefaultId);cell.querySelector('span').textContent=!row?'Apri per verificare':row.card_price==null?'Standard · '+euro(row.standard_price):euro(row.card_price);});}).catch(()=>{cells.forEach(cell=>{if(cell.isConnected)cell.querySelector('span').textContent='Apri per verificare';});});
}
window.addEventListener('optyker:ovc-updated',()=>{const box=$('whTableWrap');if(!box)return;const cells=[...box.querySelectorAll('[data-ovc-default-id]')];if(!cells.length)return;call('service_list',{search:''}).then(rows=>{if(!Array.isArray(rows))return;cells.forEach(cell=>{const r=rows.find(x=>String(x.id)===cell.dataset.ovcDefaultId);if(r&&cell.isConnected)cell.querySelector('span').textContent=r.card_price==null?'Standard · '+euro(r.standard_price):euro(r.card_price);});}).catch(()=>{});});
window.optykerWarehouseCardDefaults={version:VERSION,mountTable,mountEditor,open};
})();
