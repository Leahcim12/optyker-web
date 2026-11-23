/* OVC eyewear cover: actual buttons, authenticated benefits, report-to-chat, no automatic charges. */
(function(){
'use strict';if(window.OPTYKER_APP_COVER)return;
const VERSION='20260912-eyewear-cover1',URL_API=U+'/functions/v1/optyker-eyewear-cover';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DATE=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'da confermare';
const statusNames={pending:'In attesa dell’ottica',fulfilled:'Ricambio consegnato',rejected:'Non accolta / annullata'};
let active=null;const cached=new Map();
const customer=()=>String(state?.home?.customer?.id||state?.me?.customer?.id||'');
function nameOf(row){if(String(row?.frame?.type||'').trim().toLowerCase()==='del cliente')return 'Base solo lenti';return row?.warranty?.name||'Base';}
function stop(){if(active){active.abort?.abort();active.d.close();active.d.remove();active=null;}}
function live(v){return active===v&&v.d.isConnected&&state.me?.role==='customer'&&customer()===v.cid;}
async function api(v,action,p={}){
 if(!live(v))throw Error('Sessione cambiata. Riapri la garanzia.');
 const jwt=await token();if(!jwt)throw Error('Accedi nuovamente all’app');
 const c=new AbortController();v.abort=c;const timer=setTimeout(()=>c.abort(),25000);
 try{const r=await fetch(URL_API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:K,Authorization:'Bearer '+jwt},signal:c.signal,body:JSON.stringify({action,payload:{...p,sheet_id:v.sid}})});
  const x=await r.json().catch(()=>({}));if(!live(v))throw Error('Sessione cambiata');if(!r.ok||x.ok!==true)throw Error(x.error||'Garanzia non disponibile');return x;
 }catch(e){if(e?.name==='AbortError')throw Error('Risposta non ricevuta. Riapri la garanzia per verificare lo stato prima di riprovare.');throw e;}finally{clearTimeout(timer);}
}
function feedback(v,t){if(live(v))v.d.querySelector('[data-cover-status]').textContent=t;}
function chat(v,txt){const sid=v.sid,ref=v.ref;stop();goTab('chat');setTimeout(()=>{const field=document.getElementById('chatInput');if(field&&!field.value)field.value=txt||('Assistenza garanzia occhiale · '+ref);},300);}
function shell(sid,title='Garanzia occhiale'){
 stop();const cid=customer();if(state.me?.role!=='customer'||!cid){alert('Accedi con il tuo account cliente.');return;}
 const d=document.createElement('dialog');d.id='ovcAppCover';d.setAttribute('aria-labelledby','ovcCoverTitle');
 d.innerHTML='<header><h2 id="ovcCoverTitle">'+E(title)+'</h2><button type="button" data-cover-close aria-label="Chiudi garanzia">×</button></header><main>Caricamento…</main><footer data-cover-status role="status" aria-live="polite"></footer>';
 const v={d,cid,sid,busy:false,ref:(state.eyewear||[]).find(r=>r.id===sid)?.reference||sid};active=v;document.body.append(d);d.showModal();d.querySelector('[data-cover-close]').onclick=()=>{if(!v.busy)stop();};d.addEventListener('cancel',e=>{e.preventDefault();if(!v.busy)stop();});return v;
}
async function load(v){try{const x=await api(v,'get');if(live(v)){v.x=x;cached.set(v.cid+':'+v.sid,x.coverage);display(v);}}catch(e){feedback(v,e.message);if(live(v))v.d.querySelector('main').innerHTML='<p>Impossibile caricare la garanzia.</p><button type="button" data-cover-retry>Riprova</button>';v.d.querySelector('[data-cover-retry]')?.addEventListener('click',()=>load(v));}}
function display(v){
 const x=v.x,c=x.coverage,main=v.d.querySelector('main');v.busy=false;
 const activeDate=c.state==='active';
 main.innerHTML='<div class="coverBadge">Garanzia '+E(c.name)+'</div><p class="coverReference">'+E(v.ref)+'</p><p>'+ (c.starts_on?'Consegna: <b>'+DATE(c.starts_on)+'</b> · Copertura fino al giorno precedente il '+DATE(c.ends_before):'<b>Data di consegna da confermare in ottica.</b> La garanzia decorre dalla consegna, non dalla creazione della busta.')+'</p>'+
 (c.state==='expired'?'<p class="coverNotice">I 24 mesi di copertura sono terminati.</p>':'')+
 (c.tier==='base'||c.tier==='base_solo_lenti'?'<p class="coverQuota">Lenti: '+c.replacements_used+' ricambi utilizzati · '+c.replacements_pending+' richieste in attesa · '+c.replacements_remaining+' disponibili su 2 in due anni.</p>':'')+
 c.benefits.map((b,i)=>'<article class="coverBenefit"><h3>'+E(b.label)+'</h3><p>'+E(b.terms)+'</p><button type="button" data-cover-reason="'+i+'">'+(b.reason==='loss'?'Denuncia e richiesta in chat':b.eligible?(b.discount_percent===100?'Richiedi ricambio in omaggio':'Richiedi con sconto '+b.discount_percent+'%'):'Vedi condizioni / assistenza')+'</button></article>').join('')+
 '<p class="coverNotice">Ogni richiesta viene verificata dall’ottica. Nessun addebito o ordine automatico.</p><button type="button" data-cover-chat>Apri chat assistenza</button><section><h3>Le tue richieste per questo occhiale</h3>'+ (x.claims.length?x.claims.map(r=>'<p>'+E(c.benefits.find(b=>b.reason===r.reason)?.label||r.reason)+(r.eye?' · '+E(r.eye):'')+'<br><b>'+E(statusNames[r.status]||r.status)+'</b> · '+DATE(r.created_at)+'</p>').join(''):'<p>Nessuna richiesta inviata.</p>')+'</section>';
 main.querySelectorAll('[data-cover-reason]').forEach(b=>b.onclick=()=>reasonView(v,c.benefits[Number(b.dataset.coverReason)]));main.querySelector('[data-cover-chat]').onclick=()=>chat(v);feedback(v,'Garanzia commerciale OVC · '+VERSION);
}
function reasonView(v,b){
 const c=v.x.coverage,m=v.d.querySelector('main');v.reason=b;v.requestId=crypto.randomUUID();
 const quota=b.reason==='scratched_lens'&&c.replacements_remaining<=0;
 m.innerHTML='<button type="button" data-cover-back>‹ Torna alla garanzia</button><h3>'+E(b.label)+'</h3><p>'+E(b.terms)+'</p>'+
 (!b.eligible?'<p class="coverNotice">'+(c.state==='pending_activation'?'L’ottica deve confermare la data effettiva di consegna prima di attivare la richiesta.':'La copertura non è disponibile in questo periodo.')+'</p>':'')+
 (quota?'<p class="coverNotice">Hai già utilizzato o prenotato i 2 ricambi complessivi. Le richieste annullate dall’ottica liberano il ricambio.</p>':'')+
 (b.reason==='scratched_lens'?'<label>Lente interessata<select data-cover-eye><option value="">Seleziona</option><option value="OD">Destra (OD)</option><option value="OS">Sinistra (OS)</option><option value="entrambi">Entrambe</option></select></label>':'')+
 (b.reason==='loss'?'<div class="coverNotice">Invia la denuncia in chat. Puoi allegare un PDF o una foto; sarà visibile soltanto nella tua conversazione con l’ottica.</div><label>Denuncia (massimo 3 MB)<input type="file" data-cover-file accept="application/pdf,image/jpeg,image/png,image/webp"></label><button type="button" data-cover-upload>Invia denuncia in chat</button><label>Denuncia già inviata per questa busta<select data-cover-report><option value="">Seleziona il documento</option>'+v.x.reports.map(r=>'<option value="'+E(r.id)+'">'+E(r.name)+' · '+DATE(r.created_at)+'</option>').join('')+'</select></label>':'')+
 '<button type="button" data-cover-send '+(!b.eligible||quota?'disabled':'')+'>Conferma e invia richiesta all’ottica</button><button type="button" data-cover-chat>Apri chat assistenza</button><p>Nessun pagamento viene effettuato da questo pulsante.</p>';
 m.querySelector('[data-cover-back]').onclick=()=>display(v);m.querySelector('[data-cover-chat]').onclick=()=>chat(v,'Assistenza '+b.label+' · Garanzia '+c.name+' · Busta '+v.ref);
 m.querySelector('[data-cover-send]').onclick=async()=>{
  if(v.busy)return;const eye=m.querySelector('[data-cover-eye]')?.value||'',evidence=m.querySelector('[data-cover-report]')?.value||'';
  if(b.reason==='scratched_lens'&&!eye){feedback(v,'Seleziona la lente interessata.');return;}
  if(b.reason==='loss'&&!evidence){feedback(v,'Inoltra prima la denuncia in chat e selezionala.');return;}
  if(!confirm('Inviare la richiesta per '+b.label+' · '+v.ref+'?\n'+b.terms+'\nNessun addebito automatico.'))return;
  v.busy=true;m.querySelectorAll('button').forEach(x=>x.disabled=true);feedback(v,'Invio richiesta…');
  try{const x=await api(v,'request',{reason:b.reason,eye,evidence_message_id:evidence||null,request_id:v.requestId,confirm:true});await load(v);feedback(v,x.already_requested?'La richiesta era già stata ricevuta. Non è stato creato un duplicato.':'Richiesta ricevuta e visibile in chat. L’ottica la verificherà.');}
  catch(e){feedback(v,e.message);v.busy=false;m.querySelectorAll('button').forEach(x=>x.disabled=false);}
 };
 m.querySelector('[data-cover-upload]')?.addEventListener('click',async()=>{
  if(v.busy)return;const f=m.querySelector('[data-cover-file]').files?.[0];if(!f){feedback(v,'Seleziona la denuncia da inviare.');return;}
  if(f.size>3*1024*1024){feedback(v,'Il file supera 3 MB. Seleziona una copia più piccola.');return;}
  if(!confirm('Inviare questo documento nella chat privata con Ottica Visual Care?'))return;
  v.busy=true;m.querySelectorAll('button').forEach(x=>x.disabled=true);feedback(v,'Invio denuncia in chat…');
  try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Impossibile leggere il file'));r.readAsDataURL(f);});v.uploadId=v.uploadId||crypto.randomUUID();const x=await api(v,'report',{request_id:v.uploadId,confirm:true,attachment_data:data,attachment_name:f.name,attachment_type:f.type});v.x=await api(v,'get');v.uploadId=null;reasonView(v,v.reason);v.d.querySelector('[data-cover-report]').value=x.evidence_message_id;feedback(v,'Denuncia inviata in chat. Ora conferma la richiesta di smarrimento.');}
  catch(e){feedback(v,e.message);}finally{v.busy=false;if(live(v)){m.querySelectorAll('button').forEach(x=>x.disabled=false);const send=m.querySelector('[data-cover-send]');if(send)send.disabled=!b.eligible||quota;}}
 });
}
async function open(sid){const v=shell(sid);if(v)await load(v);}
async function certificate(sid){
 const v=shell(sid,'Certificato dell’occhiale');if(!v)return;
 try{const x=await api(v,'certificate');if(!x.data){v.d.querySelector('main').textContent=x.message;return;}
  const a=x.data,bytes=Uint8Array.from(atob(a.pdf_base64.replace(/\s/g,'')),c=>c.charCodeAt(0)),h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(h!==a.pdf_sha256)throw Error('Verifica del documento non riuscita. Riprova.');
  if(!live(v))return;const url=window.URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));v.d.addEventListener('close',()=>window.URL.revokeObjectURL(url),{once:true});
  v.d.querySelector('main').innerHTML='<p>Copia firmata archiviata · '+E(a.reference)+'<br>Consegna: '+DATE(a.delivery_date)+'</p><a class="coverPdf" href="'+url+'" target="_blank" rel="noopener">Apri il certificato PDF</a>';
 }catch(e){feedback(v,e.message);}
}
const base=eyewearMarkup;
eyewearMarkup=function(){
 const html=base.apply(this,arguments);if(state.me?.role!=='customer')return html;
 const box=document.createElement('div');box.innerHTML=html;const rows=Array.isArray(state.eyewear)?state.eyewear:[];
 box.querySelectorAll('.refGlassesCard').forEach(card=>{
  const row=rows[0];if(!row)return;const c=cached.get(customer()+':'+row.id);const label=c?.name||nameOf(row);
  const badge=card.querySelector('.refWarrantyGold');if(badge)badge.textContent='Garanzia '+label;
  card.querySelectorAll('.refSpec').forEach(spec=>{
   if(spec.querySelector('.refSpecText b')?.textContent==='Garanzia'){
    const b=document.createElement('button');b.type='button';b.className='refSpec coverOpen';b.dataset.coverOpen=row.id;b.setAttribute('aria-label','Apri garanzia '+label);b.innerHTML=spec.innerHTML;const small=b.querySelector('small');if(small)small.textContent=label+' · Tocca per coperture e richieste';spec.replaceWith(b);
   }else{spec.querySelectorAll('.refSpecArrow').forEach(n=>n.remove());spec.removeAttribute('onclick');spec.removeAttribute('tabindex');spec.removeAttribute('role');}
  });
  const cert=card.querySelector('.refEyewearActions button');if(cert){cert.removeAttribute('onclick');cert.dataset.coverCert=row.id;}
 });
 const historic=box.querySelector('.refGlassesCard')?rows.slice(1,4):rows;
 box.querySelectorAll('.refPreviousCard').forEach((card,i)=>{const row=historic[i];if(!row)return;card.querySelectorAll('.refSpecArrow').forEach(n=>n.remove());const b=document.createElement('button');b.type='button';b.className='coverHistoryButton';b.dataset.coverOpen=row.id;b.textContent='Garanzia '+nameOf(row);card.append(b);});
 return box.innerHTML;
};
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-cover-open],[data-cover-cert]');if(!b)return;e.preventDefault();e.stopPropagation();if(b.dataset.coverOpen)open(b.dataset.coverOpen);else certificate(b.dataset.coverCert);});
// A switched account or logout must close the old customer's modal, including delayed responses.
setInterval(()=>{if(active&&!live(active))stop();},500);
window.OPTYKER_APP_COVER={version:VERSION,open,close:stop};
})();
