(function(){
'use strict';
if(window.OPTYKER_ORDER_SHEET_ACTIONS)return;window.OPTYKER_ORDER_SHEET_ACTIONS='20260915-order-params1';
var busy=false;
window.optykerCancelOrderSheet=async function(row){
  if(busy||!row)return false;
  var c=window.OPTYKER_CLOUD||{},cid=String(row.client_id||''),current=String(window.clientCurrentId||document.getElementById('eyClient')?.value||'');
  if(!cid||cid!==current){alert('Apri il cliente della scheda prima di eliminarla.');return false}
  if(!confirm('Eliminare '+String(row.reference_code||row.reference_no||row.title||'questa scheda')+'?\n\nAnnulla anche l’ordine di Laboratorio e archivia gli eventuali Preventivo/Busta collegati allo stesso ordine, rimuovendoli dal carrello.\nPagamenti, acconti e scontrini già registrati NON vengono annullati né rimborsati. Una copia delle schede resta conservata.'))return false;
  busy=true;refresh();
  try{
    if(!c.username||!c.password)throw new Error('Sessione operatore non disponibile.');
    var r=await fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:c.username,password:c.password,action:'cancel_order_sheet',payload:{client_id:cid,sheet_id:row.id,expected_updated_at:row.updated_at,confirm:true}})});
    var x=await r.json();if(!r.ok||x.ok!==true)throw new Error(x.error||'Annullamento non completato.');
    var d=x.data||{},ids=d.archived_sheet_ids||[row.id];
    if(c.sheets&&Array.isArray(c.sheets[cid]))c.sheets[cid]=c.sheets[cid].filter(function(s){return !ids.includes(s.id)});
    window.dispatchEvent(new CustomEvent('optyker:sheet-removed',{detail:{client_id:cid,sheet_id:row.id,archived_sheet_ids:ids}}));
    window.dispatchEvent(new CustomEvent('optyker:client-cart-updated',{detail:{client_id:cid}}));
    if(window.clientRenderVisits)window.clientRenderVisits(true);
    alert(d.cancelled_orders?'Scheda eliminata e ordine annullato. Pagamenti e scontrini invariati.':'Scheda eliminata. Copia di recupero conservata.');return true;
  }catch(e){alert('Annullamento da verificare: '+e.message);return false}finally{busy=false;refresh()}
};
function refresh(){
  var rows=window.optykerEyewearRecentRows?.()||[];
  document.querySelectorAll('#eyRecentList .eyRecentRow').forEach(function(el,i){
    var row=rows[i];if(!row||!row.id)return;
    var b=el.querySelector('[data-delete-ordered-sheet]');
    if(!b){b=document.createElement('button');b.type='button';b.className='eyBtn';b.dataset.deleteOrderedSheet=row.id;b.textContent='Elimina scheda';el.appendChild(b)}
    b.disabled=busy;b.onclick=function(){window.optykerCancelOrderSheet(row)};
  });
}
var timer=0;new MutationObserver(function(){if(timer)return;timer=setTimeout(function(){timer=0;refresh()},100)}).observe(document.documentElement,{childList:true,subtree:true});
refresh();
})();
