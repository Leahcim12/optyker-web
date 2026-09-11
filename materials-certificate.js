/* Busta-scoped materials certificate. Every read and save is staff-authorized. */
(function(){
'use strict';if(window.OPTYKER_MATERIAL_CERTIFICATE)return;
const VERSION='20260911-materials1',$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>v==null?'':typeof v==='string'||typeof v==='number'?String(v).trim():'';
const list=v=>Array.isArray(v)?v.map(text).filter(Boolean).join(', '):text(v);
const own=v=>text(v).toLowerCase()==='del cliente';
const date=v=>{if(!v)return 'Non indicata';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00':v);return isNaN(d)?'Non indicata':new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome'}).format(d);};
const logged=()=>!!(window.optykerAuthenticated&&window.OPTYKER_CLOUD?.username&&window.OPTYKER_CLOUD?.password);
const fields=[['frame_brand','Marca'],['frame_model','Modello'],['frame_material','Materiale'],['frame_color','Colore'],['frame_code','Codice / barcode']];
const lensFields=[['brand','Marca'],['name','Modello / prodotto'],['material','Materiale'],['index','Indice di rifrazione'],['treatments','Trattamenti'],['color','Colore / fotocromia'],['code','Codice prodotto'],['lot','Lotto / riferimento fabbricante']];
let active=null;
function origin(s,side){const l=s.data?.lens||{},e=l['lens_'+side]||{},t=l['lens_type_'+side]||e.type||l.lens_type;return own(t)||e.client_owned===true;}
function defaults(s){
 const f=s.data?.frame||{},l=s.data?.lens||{},o={};fields.forEach(([k])=>o[k]=text(f[k.replace('frame_','')]));o.frame_code=text(f.barcode||f.code||f.sku);
 for(const side of ['od','os']){
  const e=l['lens_'+side],provided=origin(s,side),structured=e&&typeof e==='object';
  // A per-eye blank must stay blank: the aggregate can describe the OTHER eye.
  const pick=k=>text(structured?e[k]:l[k]);
  o[side+'_brand']=pick('brand');o[side+'_name']=pick('lens_name');o[side+'_material']=pick('material');
  o[side+'_index']=provided?'':text(e?.refractive_index||l.refractive_index);
  o[side+'_treatments']=provided?'':list(e?.treatments??l.treatments);
  o[side+'_color']=provided?'':[text(e?.color||l.color),l.photochromic===true?'Fotocromatico':''].filter(Boolean).join(' · ');
  o[side+'_code']=provided?'':text(e?.code||(!structured?l.code:''));o[side+'_lot']=provided?'':text(e?.lot||e?.lot_number);
  if(provided)for(const [k] of lensFields)o[side+'_'+k]='';
 }
 o.delivery_date='';o.public_notes='';return o;
}
function close(force=false){const v=active;if(!v)return true;if(!force&&(v.busy||v.d._dirty&&!confirm('Chiudere il certificato senza salvare le modifiche?')))return false;active=null;v.aborts.forEach(c=>c.abort());v.d.close();v.d.remove();return true;}
function valid(v){return active===v&&logged()&&window.OPTYKER_CLOUD.username===v.user&&String(window.clientCurrentId||'')===v.context;}
async function rpc(v,action,extra={}){
 if(!valid(v))throw Error('Cliente o sessione cambiati: riapri la busta.');
 const c=window.OPTYKER_CLOUD,abort=new AbortController();v.aborts.add(abort);const timer=setTimeout(()=>abort.abort(),20000);
 try{const r=await fetch(c.root+'/rest/v1/rpc/optyker_material_certificate_api',{method:'POST',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:{client_id:v.cid,sheet_id:v.sid,...extra}})});const x=await r.json();if(!valid(v))throw Error('Cliente o sessione cambiati.');if(!r.ok||!x?.ok)throw Error(x?.error||'Impossibile caricare il certificato');if(x.sheet?.id!==v.sid||x.sheet?.client_id!==v.cid||x.sheet?.sheet_type!=='eyewear_job'||x.sheet?.data?.mode!=='job')throw Error('Il documento non è una Busta Occhiali del cliente selezionato.');return x;}
 finally{clearTimeout(timer);v.aborts.delete(abort);}
}
const err=e=>e?.name==='AbortError'?'Risposta non ricevuta. Riapri il certificato per verificarne lo stato prima di riprovare.':e?.message||String(e);
function status(v,t){if(active===v)v.d.querySelector('[data-mc-status]').textContent=t;}
function values(v){const o={};v.d.querySelectorAll('[data-mc-field]').forEach(e=>o[e.dataset.mcField]=e.value.trim());return o;}
function input(k,label,value,type='text'){return '<label>'+esc(label)+'<input type="'+type+'" data-mc-field="'+k+'" value="'+esc(value||'')+'" maxlength="300" placeholder="Non specificato"></label>';}
function render(v){
 const x=v.x,s=x.sheet,f=s.data.frame||{},l=s.data.lens||{},a=x.certificate?.data||defaults(s);
 v.stale=!!x.certificate&&new Date(x.certificate.source_updated_at).getTime()!==new Date(s.updated_at).getTime();
 const body=v.d.querySelector('[data-mc-body]');
 body.innerHTML='<p class="mcSource">Busta <b>'+esc(s.reference_code||s.reference_no||s.id)+'</b> · '+esc(x.client_name)+'</p><p>I campi sono ripresi dalla busta salvata. Completa e verifica i materiali e i riferimenti con la documentazione del prodotto. Le note interne e i prezzi non vengono stampati.</p>'+(v.stale?'<p class="mcWarning">La busta è cambiata dopo il salvataggio del certificato: verifica i dati e salva una nuova revisione prima di stampare.</p>':'')+'<div class="mcEditor"><fieldset><legend>Montatura · '+esc(own(f.type)?'del cliente':text(f.type)||'tipo non indicato')+'</legend><div class="mcFields">'+fields.map(([k,n])=>input(k,n,a[k])).join('')+'</div></fieldset>'+['od','os'].map(side=>'<fieldset><legend>Lente '+(side==='od'?'destra (OD)':'sinistra (OS)')+' · '+esc(origin(s,side)?'del cliente':l['lens_type_'+side]||l['lens_'+side]?.type||l.lens_type||'tipo non indicato')+'</legend><div class="mcFields">'+lensFields.map(([k,n])=>input(side+'_'+k,n,a[side+'_'+k])).join('')+'</div></fieldset>').join('')+input('delivery_date','Data effettiva di consegna (facoltativa)',a.delivery_date,'date')+'<label>Note da stampare sul certificato<textarea data-mc-field="public_notes" maxlength="1500" rows="3">'+esc(a.public_notes||'')+'</textarea></label></div><iframe title="Anteprima certificato dei materiali" data-mc-preview hidden sandbox="allow-same-origin"></iframe><div class="mcActions"><button type="button" data-mc-preview-btn>Anteprima</button><button type="button" data-mc-source>Riprendi dati dalla busta</button><button type="button" data-mc-save>Salva certificato</button><button type="button" data-mc-print>Stampa / PDF</button></div>';
 v.d._dirty=false;
 body.oninput=()=>{v.d._dirty=true;status(v,'Modifiche non salvate. Salva il certificato prima di stamparlo.');};
 body.querySelector('[data-mc-preview-btn]').onclick=()=>preview(v);
 body.querySelector('[data-mc-save]').onclick=()=>save(v);
 body.querySelector('[data-mc-source]').onclick=()=>{if(!confirm('Riprendere i dati dalla busta? Le integrazioni del certificato verranno sostituite solo dopo un nuovo salvataggio.'))return;const a=defaults(s);body.querySelectorAll('[data-mc-field]').forEach(e=>e.value=a[e.dataset.mcField]||'');v.d._dirty=true;status(v,'Dati ripresi dalla busta. Verifica e salva il certificato.');};
 body.querySelector('[data-mc-print]').onclick=()=>print(v);
 status(v,x.certificate?'Certificato salvato · revisione '+x.certificate.revision+' · '+date(x.certificate.updated_at):'Certificato da completare: nessun dato salvato finché non premi Salva certificato.');
}
function missing(v,a){const names=[];if(!a.frame_material)names.push('materiale montatura');for(const side of ['od','os'])if(!a[side+'_material'])names.push('materiale lente '+(side==='od'?'destra':'sinistra'));return names;}
function html(v,a,draft){
 if(!window.optykerQuotePrint?.decorate)throw Error('Intestazione non ancora disponibile. Riapri la busta.');
 const s=v.x.sheet,f=s.data.frame||{},l=s.data.lens||{},cert=v.x.certificate;
 const val=t=>esc(t||'Non specificato'),pair=(n,t)=>'<div><dt>'+esc(n)+'</dt><dd>'+val(t)+'</dd></div>';
 let content='<h1>Certificato dei materiali</h1><p class="mcDocState">'+(draft?'ANTEPRIMA · dati non salvati':'Revisione '+cert.revision+' · compilato il '+date(cert.updated_at))+'</p><section class="mcIdentity">'+pair('Cliente',v.x.client_name)+pair('Busta Occhiali',s.reference_code||s.reference_no||s.id)+pair('Data busta',date(s.created_at))+pair('Consegna',a.delivery_date?date(a.delivery_date):'Non indicata')+'</section><h2>Montatura</h2><dl>'+pair('Provenienza',own(f.type)?'Fornita dal cliente':'Fornita con la busta')+pair('Tipo',f.type)+fields.map(([k,n])=>pair(n,a[k])).join('')+'</dl><h2>Lenti oftalmiche</h2><table><thead><tr><th>Caratteristica</th><th>Lente destra (OD)</th><th>Lente sinistra (OS)</th></tr></thead><tbody><tr><th>Provenienza</th>'+['od','os'].map(side=>'<td>'+ (origin(s,side)?'Del cliente':'Fornita con la busta')+'</td>').join('')+'</tr><tr><th>Tipologia</th>'+['od','os'].map(side=>'<td>'+val(l['lens_type_'+side]||l['lens_'+side]?.type||l.lens_type)+'</td>').join('')+'</tr>'+lensFields.map(([k,n])=>'<tr><th>'+esc(n)+'</th><td>'+val(a['od_'+k])+'</td><td>'+val(a['os_'+k])+'</td></tr>').join('')+'</tbody></table>';
 if(a.public_notes)content+='<h2>Note sui materiali</h2><p class="mcNotes">'+esc(a.public_notes)+'</p>';
 const absent=missing(v,a);if(absent.length)content+='<p class="mcMissing">Dati non specificati: '+esc(absent.join(', '))+'.</p>';
 content+='<footer><p>Documento descrittivo dei materiali registrati per la busta indicata. Non sostituisce le dichiarazioni o certificazioni del fabbricante. Per i componenti del cliente, i dati riportati sono quelli disponibili.</p><p>Compilato da: '+esc(draft?v.user:cert.compiled_by)+'</p><div class="mcSignature">Timbro e firma dell’operatore __________________________</div></footer>';
 const styles='body{font:12px/1.4 "Segoe UI",Arial,sans-serif;color:#17212b}h1{font-size:24px;margin:16px 0 4px}h2{font-size:14px;margin:15px 0 6px;border-bottom:1px solid #bbc5cc;padding-bottom:4px;break-after:avoid}p{margin:6px 0}.mcDocState{font-size:11px;color:#53616c}.mcIdentity{display:grid;grid-template-columns:1fr 1fr;background:#f4f6f7;padding:10px;gap:6px}dt{font-weight:600;color:#43525e}dd{margin:0;overflow-wrap:anywhere}dl{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin:0}dl>div{border-bottom:1px solid #eee;padding:3px 0}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;vertical-align:top;padding:6px;border:1px solid #d3dade;overflow-wrap:anywhere;white-space:pre-wrap}thead th{background:#eaf0f3}th{font-weight:600;width:30%}thead th:not(:first-child){width:35%}tr{break-inside:avoid}.mcNotes{white-space:pre-wrap;overflow-wrap:anywhere}.mcMissing{font-size:10px;border:1px solid #bfc4ca;padding:6px;margin-top:12px}footer{font-size:10px;color:#42515c;margin-top:16px;break-inside:avoid}.mcSignature{margin-top:22px;color:#17212b}@media print{h1,h2{break-after:avoid}.mcIdentity{break-inside:avoid}thead{display:table-header-group}}';
 return window.optykerQuotePrint.decorate('<!doctype html><html lang="it"><head><meta charset="utf-8"><style>'+styles+'</style></head><body>'+content+'</body></html>','Certificato dei materiali');
}
function preview(v){if(!valid(v))return;try{const a=values(v),frame=v.d.querySelector('[data-mc-preview]');frame.srcdoc=html(v,a,!v.x.certificate||v.d._dirty||v.stale);frame.hidden=false;frame.scrollIntoView({block:'start',behavior:'smooth'});}catch(e){status(v,err(e));}}
async function save(v){if(!valid(v)||v.busy)return;v.busy=true;const buttons=v.d.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);v.d.querySelectorAll('input,textarea').forEach(e=>e.disabled=true);status(v,'Salvataggio del certificato…');
 try{const a=values(v);v.x=await rpc(v,'save',{confirm:true,revision:v.x.certificate?.revision||0,source_updated_at:v.x.sheet.updated_at,values:a});if(valid(v)){render(v);status(v,'Certificato salvato nella busta · revisione '+v.x.certificate.revision+'.');}}
 catch(e){status(v,err(e));}finally{v.busy=false;if(active===v){v.d.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=false);}}
}
function print(v){if(!valid(v)||v.busy)return;if(!v.x.certificate||v.d._dirty||v.stale){status(v,'Salva prima il certificato e verifica i dati della busta. Poi premi Stampa / PDF.');return;}
 const a=values(v),absent=missing(v,a);if(absent.length&&!confirm('Mancano: '+absent.join(', ')+'.\n\nStampare comunque, indicando esplicitamente i dati non specificati?'))return;
 try{const source=html(v,a,false),w=window.open('','_blank');if(!w){status(v,'Consenti le finestre di stampa per Optyker.');return;}w.document.write(source);w.document.close();window.optykerQuotePrint.finish(w);}catch(e){status(v,err(e));}
}
async function open(sheetId,clientId){if(!logged()){alert('Accedi con un operatore autorizzato.');return;}if(!sheetId||!clientId){alert('Salva prima la Busta Occhiali su un cliente.');return;}if(!close())return;
 const d=document.createElement('dialog');d.id='optykerMaterialCertificate';d.dataset.optykerContext='true';d.setAttribute('aria-labelledby','mcTitle');d.innerHTML='<header><div><small>BUSTA OCCHIALI</small><h2 id="mcTitle">Certificato dei materiali</h2></div><button type="button" data-mc-close aria-label="Chiudi certificato">×</button></header><main data-mc-body>Caricamento…</main><footer data-mc-status role="status"></footer>';
 const v={d,sid:String(sheetId),cid:String(clientId),context:String(window.clientCurrentId||''),user:window.OPTYKER_CLOUD.username,busy:false,aborts:new Set()};active=v;document.body.append(d);d._dirty=false;d._canClose=()=>!v.busy&&(!d._dirty||confirm('Chiudere il certificato senza salvare?'));d.querySelector('[data-mc-close]').onclick=()=>close();d.addEventListener('cancel',e=>{e.preventDefault();close();});d.addEventListener('close',()=>{v.aborts.forEach(a=>a.abort());if(active===v)active=null;d.remove();});d.showModal();
 try{v.x=await rpc(v,'get');if(valid(v))render(v);}catch(e){if(active===v){d.querySelector('[data-mc-body]').textContent=err(e);}}
}
function attach(host,s){if(!host||s.sheet_type!=='eyewear_job'||s.data?.mode!=='job'||!s.client_id||host.querySelector('[data-mc-open]'))return;const actions=host.querySelector('.csBottom')||host;const b=document.createElement('button');b.type='button';b.dataset.mcOpen='true';b.textContent='Certificato dei materiali';b.onclick=()=>open(s.id,s.client_id);const anchor=actions.querySelector('[data-cs-print]');if(anchor)anchor.after(b);else actions.append(b);}
function tick(){
 if(active&&!valid(active))close(true);if(!logged())return;
 const actions=document.querySelector('#eyewearPanel .eyFinalActions');if(actions){let b=$('eyMaterialsCertificate');if(!b){b=document.createElement('button');b.id='eyMaterialsCertificate';b.type='button';b.textContent='Certificato dei materiali';actions.append(b);b.onclick=()=>{try{const bridge=window.optykerEyewearOrderBridge;if(!bridge)throw Error('Modulo Occhiali in caricamento.');const p=bridge.capture();if(!p)return;const row=bridge.saved(p);if(p.mode!=='job'||!row||!row.client_id)throw Error('Salva prima la Busta Occhiali sul cliente. Se hai modificato i dati, apri la busta salvata da Anagrafica → Occhiali.');open(row.id,row.client_id);}catch(e){alert(err(e));}};}
 b.style.setProperty('display',$('eyModeJob')?.classList.contains('active')?'inline-flex':'none','important');}
 const rows=window.optykerEyewearRecentRows?.()||[];document.querySelectorAll('#eyRecentList .eyRecentRow').forEach((r,i)=>{if(rows[i]?.sheet_type==='eyewear_job')attach(r,rows[i]);});
}
window.OPTYKER_MATERIAL_CERTIFICATE={version:VERSION,open,close,attach,defaults};
function boot(){tick();setInterval(()=>{if(!document.hidden||active)tick();},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
