/* Client privacy register. Separate from clinical LAC/Ortho consent.
 * No consent is preselected, copied or automatically granted. Server computes renewal.
 * Signatures are simple drawn acknowledgements, not qualified digital signatures.
 */
(function () {
 'use strict';
 if(window.__optykerPrivacyV1)return;window.__optykerPrivacyV1=true;
 const $=id=>document.getElementById(id);
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const S={client:'',seq:0,state:null,error:'',loaded:0,dialogClient:'',view:'hub',busy:false,ink:false,requestId:'',template:null,record:null,submitted:null};
 const DRAFT=`INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI — CLIENTI
Articoli 13 e 14 del Regolamento (UE) 2016/679

1. TITOLARE E RECAPITI
Mologni Company S.R.L. — Ottica Visual Care.
Sede operativa: Via Primo Maggio 4, 24040 Lallio (BG).
Contatto per i diritti privacy: otticavisualcare.lallio@outlook.it.
[DA COMPLETARE: verificare titolare, sede legale e recapito per i diritti. Indicare il recapito del DPO, se nominato, o l'assenza di nomina.]

2. DATI TRATTATI
Dati identificativi, anagrafici, di contatto e fiscali; appuntamenti, ordini, consegne e pagamenti. Ove necessari al servizio richiesto, prescrizioni e informazioni sulla funzione visiva possono rivelare dati relativi alla salute. Il documento firmato e le scelte espresse sono conservati per documentare l'informativa fornita e i consensi. La firma acquisita nel gestionale è un'immagine grafica; non vengono raccolte dinamiche biometriche della scrittura.

3. FINALITÀ E BASI GIURIDICHE
Gestione delle richieste, preventivi, forniture, appuntamenti e assistenza: esecuzione di misure precontrattuali o del contratto (art. 6.1.b). Adempimenti amministrativi e fiscali previsti dalla normativa applicabile: obbligo legale (art. 6.1.c).
Dati sulla salute necessari all'allestimento dei dispositivi ottici e alla gestione delle relative schede: ove il trattamento si fondi sul consenso, consenso esplicito, specifico e revocabile (artt. 6.1.a e 9.2.a). Il rifiuto limita solo le attività che richiedono effettivamente tali dati e tale base giuridica, non le altre prestazioni.
Comunicazioni promozionali del centro, mediante email, SMS o messaggistica ai recapiti forniti: solo con consenso facoltativo, separato e revocabile. Il rifiuto non condiziona acquisti, prezzi o assistenza.
[DA COMPLETARE: verificare le basi giuridiche applicabili alle attività realmente svolte, le finalità precise e gli eventuali ulteriori trattamenti.]

4. MODALITÀ E DESTINATARI
Trattamento cartaceo ed elettronico da parte di personale autorizzato. I dati strettamente necessari possono essere comunicati ai fornitori che realizzano i dispositivi richiesti, a consulenti amministrativi e fiscali, ai gestori dei servizi informatici e alle autorità nei casi previsti dalla legge; i ruoli sono definiti in base all'attività svolta.
[DA COMPLETARE: elencare i destinatari o le categorie effettive, gli eventuali responsabili e le informazioni sui trattamenti tramite gestionale, app e negozio online.]

5. TRASFERIMENTI FUORI DALLO SPAZIO ECONOMICO EUROPEO
[DA COMPLETARE: indicare se avvengono trasferimenti, verso quali destinatari/paesi e con quali garanzie, nonché come ottenerne copia. Non dichiarare l'assenza di trasferimenti senza averla verificata.]

6. CONSERVAZIONE
[DA COMPLETARE: indicare tempi o criteri concreti e distinti per dati contrattuali e fiscali, prescrizioni e schede, promozioni, prova dei consensi e richieste di revoca. Evitare conservazione indefinita.]
Il richiamo annuale dell'informativa è una procedura organizzativa del centro, non un termine di conservazione e non una scadenza automatica del consenso stabilita dal GDPR.

7. CONFERIMENTO E DECISIONI AUTOMATIZZATE
I dati necessari a gestire una richiesta o un obbligo sono richiesti solo per tali scopi; in loro assenza la relativa attività potrebbe non essere eseguibile. I recapiti e consensi per promozioni sono facoltativi.
[DA COMPLETARE: indicare l'eventuale presenza di profilazione o decisioni automatizzate e, se applicabile, logica, importanza e conseguenze. Per dati non forniti direttamente indicare anche categorie e fonte.]

8. DIRITTI E REVOCA
Nei casi previsti dagli artt. 15–22 si possono richiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Il consenso può essere revocato in ogni momento contattando il recapito privacy sopra riportato o rivolgendosi al centro; la revoca non pregiudica la liceità del trattamento precedente e non elimina gli obblighi fondati su altre basi giuridiche. È possibile proporre reclamo al Garante per la protezione dei dati personali.
Una copia dell'informativa e delle scelte può essere richiesta al centro.
`;
 const PURPOSES={health:'Acconsento esplicitamente al trattamento dei dati relativi alla salute per l’allestimento dei dispositivi ottici richiesti e la gestione delle relative schede, nei limiti e sulla base del consenso descritti nell’informativa.',marketing:'Acconsento a ricevere comunicazioni promozionali di Ottica Visual Care tramite email, SMS o messaggistica ai recapiti che ho fornito. Il consenso è facoltativo e separato dai servizi richiesti.'};
 const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.split('-').reverse().join('/'):s||'—';
 const clientId=()=>String(window.clientCurrentId||'');
 const session=()=>window.optykerAuthenticated && window.OPTYKER_CLOUD?.username && window.OPTYKER_CLOUD?.password;
 const uid=()=>crypto.randomUUID();
 function api(action,payload){
   const c=window.OPTYKER_CLOUD||{},owner=c.username;if(!session())return Promise.reject(Error('Accedi con un operatore autorizzato.'));
   const control=new AbortController(),timer=setTimeout(()=>control.abort(),20000);
   return fetch(c.root+'/rest/v1/rpc/optyker_privacy_api',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},signal:control.signal,cache:'no-store',body:JSON.stringify({p_username:owner,p_password:c.password,p_action:action,p_payload:payload||{}})})
    .then(async r=>{let x;try{x=await r.json()}catch(e){throw Error('Risposta del server non leggibile.')}if(!r.ok||!x||x.ok===false)throw Error(x?.error||'Operazione privacy non riuscita.');if(!session()||window.OPTYKER_CLOUD.username!==owner)throw Error('Sessione cambiata: accedi nuovamente.');return x.data;})
    .catch(e=>{if(e.name==='AbortError')throw Error('Risposta non ricevuta. Riprova: la stessa richiesta non crea duplicati.');throw e;}).finally(()=>clearTimeout(timer));
 }
 function banner(){
   const hero=$('clientWorkspaceHero');if(!hero)return;
   let b=$('optykerPrivacyBanner');if(!b){b=document.createElement('section');b.id='optykerPrivacyBanner';b.setAttribute('aria-label','Stato privacy del cliente');hero.insertAdjacentElement('afterend',b);}
   b.hidden=!S.client||!session();if(b.hidden)return;
   const d=S.state,err=S.error,loading=!d&&!err;
   b.dataset.state=err?'error':loading?'loading':d.needs_renewal?'due':'current';
   const title=err?'Privacy: verifica non riuscita':loading?'Verifica privacy…':d.reason==='missing'?'Privacy da acquisire':d.reason==='annual'?'Privacy: rinnovo annuale da richiedere':d.reason==='template_changed'?'Privacy: nuova versione da acquisire':'Privacy acquisita';
   const detail=err|| (loading?'Controllo del registro condiviso.':d.reason==='missing'?'Acquisisci l’informativa del cliente. I consensi LAC e Ortocheratologia rimangono separati.':d.reason==='annual'?'Nuova acquisizione richiesta dal '+date(d.due_on)+'. Le copie precedenti restano nello storico.':d.reason==='template_changed'?'Il testo è cambiato: presentare la nuova informativa al cliente.':'Prossimo richiamo: '+date(d.due_on)+'.')+(d?.revoked_scopes?.length?' Attenzione: consenso revocato per '+d.revoked_scopes.map(x=>x==='health'?'dati sulla salute':'promozioni').join(' e ')+'.':'')+(d&&!d.template?' Configura prima il testo da far firmare.':'');
   b.innerHTML='<div><strong>'+esc(title)+'</strong><small>'+esc(detail)+'</small></div><button type="button">'+(err?'Riprova':loading?'Attendi…':d.needs_renewal?'Apri privacy cliente':'Privacy e storico')+'</button>';
   const button=b.querySelector('button');button.disabled=loading;button.onclick=()=>err?refresh(true):open();
 }
 async function refresh(force){
   const id=clientId();if(!session()||!id){S.client='';S.state=null;S.seq++;S.ink=false;S.dialogClient='';S.submitted=null;const current=$('optykerPrivacyDialog');if(current?.open)current.close();if(current)current.innerHTML='';banner();return;}
   if(!force&&id===S.client&&Date.now()-S.loaded<60000)return;
   if(id!==S.client){S.state=null;S.error='';}S.client=id;S.loaded=Date.now();const seq=++S.seq;banner();
   try{const d=await api('state',{client_id:id});if(seq!==S.seq||clientId()!==id)return;S.state=d;S.error='';banner();}
   catch(e){if(seq!==S.seq||clientId()!==id)return;S.state=null;S.error=e.message;banner();}
 }
 function dialog(){
   let d=$('optykerPrivacyDialog');if(d)return d;
   d=document.createElement('dialog');d.id='optykerPrivacyDialog';d.className='optykerPrivacyDialog';d.setAttribute('aria-labelledby','optykerPrivacyTitle');document.body.appendChild(d);
   d.addEventListener('cancel',e=>{e.preventDefault();close();});return d;
 }
 function close(){if(S.busy)return;if(S.ink&&!confirm('Chiudere senza salvare la nuova privacy?'))return;S.ink=false;S.requestId='';dialog().close();refresh(true);}
 function frame(body,buttons){
   const d=dialog();d.innerHTML='<header class="optykerPrivacyHead"><div><h2 id="optykerPrivacyTitle">Privacy cliente</h2><p>'+esc(S.state?.patient?.name||'Informativa')+'</p></div><button type="button" aria-label="Chiudi privacy">×</button></header><div class="optykerPrivacyBody">'+body+'</div><footer class="optykerPrivacyFoot"><div id="optykerPrivacyFeedback" role="status" aria-live="polite"></div>'+buttons+'</footer>';
   d.querySelector('header button').onclick=close;d.scrollTop=0;
 }
 const btn=(id,text,primary=false)=>'<button id="'+id+'" class="optykerPrivacyAction'+(primary?' primary':'')+'" type="button">'+text+'</button>';
 function feedback(text){if($('optykerPrivacyFeedback'))$('optykerPrivacyFeedback').textContent=text;}
 async function open(){
   const id=clientId();if(!id||!session())return;
   S.dialogClient=id;S.ink=false;S.requestId='';S.view='hub';frame('<p>Caricamento del registro privacy…</p>','');if(!dialog().open)dialog().showModal();
   try{const d=await api('state',{client_id:id});if(!dialog().open||S.dialogClient!==id||clientId()!==id)return;S.state=d;S.client=id;S.error='';S.loaded=Date.now();hub();banner();}
   catch(e){feedback(e.message);}
 }
 function history(){
   const h=S.state?.history||[];return '<section class="optykerPrivacyBox"><h3>Storico privacy</h3>'+(!h.length?'<p class="optykerPrivacyNote">Nessuna privacy cliente registrata. Le informative cliniche restano nell’archivio esistente.</p>':h.map(r=>'<div class="optykerPrivacyHistoryItem"><div><strong>'+esc(r.file_name)+'</strong><small>'+esc(r.operator||'')+' · '+date(r.acquired_on)+(r.renewal_due_on?' · Richiamo '+date(r.renewal_due_on):'')+'</small></div><div>'+btn('view-'+r.id,'Visualizza')+' '+btn('print-'+r.id,'Stampa')+'</div></div>').join(''))+'</section>';
 }
 function bindHistory(){(S.state?.history||[]).forEach(r=>{if($('view-'+r.id))$('view-'+r.id).onclick=()=>viewRecord(r.id,false);if($('print-'+r.id))$('print-'+r.id).onclick=()=>viewRecord(r.id,true);});}
 function hub(){
   S.view='hub';const d=S.state;
   frame('<section class="optykerPrivacyBox"><h3>'+(d.needs_renewal?'Nuova privacy cliente':'Privacy e richiami')+'</h3><p class="optykerPrivacyNote">'+(d.due_on?'Prossimo richiamo annuale: <b>'+date(d.due_on)+'</b>. ':'')+'Ogni acquisizione richiede nuove scelte e una nuova firma. Il documento precedente non viene sovrascritto.</p>'+(d.template?'<p class="optykerPrivacyNote">Testo in uso: <b>'+esc(d.template.version)+'</b></p>':'<div class="optykerPrivacyWarning">Il modulo è pronto. Prima della prima firma, completa e approva il testo privacy per i trattamenti effettivi del centro. La bozza proposta non è ancora un’informativa approvata.</div>')+(d.revoked_scopes?.length?'<div class="optykerPrivacyWarning">Revoca registrata per: '+esc(d.revoked_scopes.map(x=>x==='health'?'dati sulla salute':'promozioni').join(' e '))+'. Applicare la richiesta anche negli altri sistemi prima di ulteriori trattamenti fondati sul consenso.</div>':'')+'</section>'+history()+'<p class="optykerPrivacyNote">Il richiamo ogni 12 mesi è una regola interna del centro. Non comporta la cancellazione dei documenti o una scadenza legale automatica del consenso. Nessun messaggio viene inviato automaticamente.</p>',btn('optykerPrivacyConfigure',d.template?'Aggiorna testo':'Configura testo')+(d.latest_id?btn('optykerPrivacyWithdraw','Registra revoca'):'')+btn('optykerPrivacyNew','Nuova privacy da firmare',true));
   $('optykerPrivacyConfigure').onclick=configure;$('optykerPrivacyNew').disabled=!d.template;$('optykerPrivacyNew').onclick=signForm;if($('optykerPrivacyWithdraw'))$('optykerPrivacyWithdraw').onclick=withdrawForm;bindHistory();
 }
 function configure(){
   S.view='configure';const t=S.state.template;
   frame('<div class="optykerPrivacyWarning">Questo testo viene usato per tutti i clienti. Verifica recapiti, basi giuridiche, conservazione, destinatari, trasferimenti e finalità con chi segue la privacy del centro. Le copie già firmate conservano il loro testo originale.</div><label>Versione del testo<input id="optykerPrivacyVersion" maxlength="80" value="'+esc(t?.version||'Privacy clienti 2026 — v1')+'"></label><label>Testo integrale dell’informativa<textarea id="optykerPrivacyNotice">'+esc(t?.body||DRAFT)+'</textarea></label><label class="optykerPrivacyCheck"><input id="optykerPrivacyApproved" type="checkbox"><span>Confermo che il testo è completo, verificato e approvato dal titolare per i trattamenti realmente svolti. Ho eliminato e sostituito tutti i campi “DA COMPLETARE”.</span></label>',btn('optykerPrivacyBack','Indietro')+btn('optykerPrivacyPublish','Approva e salva testo',true));
   $('optykerPrivacyBack').onclick=hub;
   $('optykerPrivacyPublish').onclick=async()=>{
    if(S.busy)return;const body=$('optykerPrivacyNotice').value.trim(),version=$('optykerPrivacyVersion').value.trim();
    if(!version||body.length<900||/DA COMPLETARE|\[INSERIRE|TODO|\[VERIFICARE/i.test(body)||!$('optykerPrivacyApproved').checked){feedback('Completa il testo e conferma la revisione prima di attivarlo.');return;}
    busy(true);try{const t=await api('template_save',{body,version,approved:true,previous_id:S.state.template?.id||''});S.state.template=t;hub();feedback('Testo approvato e salvato. Ora puoi acquisire la firma.');S.loaded=0;}catch(e){feedback(e.message);}finally{busy(false);}
   };
 }
 function choice(key,title){return '<fieldset><legend>'+title+'</legend><p class="optykerPrivacyNote">'+esc(PURPOSES[key])+'</p><div class="optykerPrivacyChoiceRow"><label><input type="radio" name="optykerPrivacy-'+key+'" value="yes"> Acconsento</label><label><input type="radio" name="optykerPrivacy-'+key+'" value="no"> Non acconsento</label></div></fieldset>';}
 function signForm(){
   if(!S.state.template)return;S.view='sign';S.template=Object.assign({},S.state.template);S.requestId=uid();S.submitted=null;S.ink=false;
   const p=S.state.patient;
   frame('<section class="optykerPrivacyBox"><h3>Informativa · '+esc(S.template.version)+'</h3><div class="optykerPrivacyText" tabindex="0">'+esc(S.template.body)+'</div></section><section class="optykerPrivacyBox"><div class="optykerPrivacyFields"><label>Cliente<input readonly value="'+esc(p.name)+'"></label><label>Data di acquisizione<input readonly value="'+date(S.state.today)+'"></label><label>Chi firma<select id="optykerPrivacyRole"><option value="self">Cliente maggiorenne</option><option value="guardian">Genitore / tutore</option><option value="representative">Rappresentante autorizzato</option></select></label><label>Nome e cognome del firmatario<input id="optykerPrivacySigner" maxlength="160" value="'+esc(p.name)+'"></label><label>Relazione / titolo del rappresentante<input id="optykerPrivacyRelationship" maxlength="160" placeholder="Da compilare per genitore, tutore o rappresentante"></label></div><label class="optykerPrivacyCheck"><input id="optykerPrivacyAuthority" type="checkbox"><span>L’operatore ha verificato l’identità del firmatario e la maggiore età oppure il titolo a rappresentare il cliente.</span></label><label class="optykerPrivacyCheck"><input id="optykerPrivacyAcknowledged" type="checkbox"><span>Il cliente o il rappresentante dichiara di aver ricevuto e letto l’informativa sopra riportata. Questa dichiarazione non equivale al consenso per tutte le finalità.</span></label>'+choice('health','Dati relativi alla salute — scelta esplicita')+choice('marketing','Comunicazioni promozionali — scelta facoltativa')+'</section><section class="optykerPrivacyBox"><h3>Firma del cliente o rappresentante</h3><p class="optykerPrivacyNote">Firma dopo aver letto il testo ed espresso le scelte. Usa mouse, penna o touch su questo dispositivo. Non è una firma digitale qualificata.</p><canvas id="optykerPrivacySign" width="900" height="220" aria-label="Riquadro firma del cliente"></canvas>'+btn('optykerPrivacyClear','Cancella firma')+'</section>',btn('optykerPrivacyBack','Indietro')+btn('optykerPrivacyPreview','Anteprima')+btn('optykerPrivacySave','Salva privacy firmata',true));
   $('optykerPrivacyBack').onclick=()=>{if(S.ink&&!confirm('Tornare indietro senza salvare la firma?'))return;S.ink=false;hub();};
   $('optykerPrivacyClear').onclick=clearSignature;
   $('optykerPrivacySave').onclick=saveSignature;
   $('optykerPrivacyPreview').onclick=()=>printHtml(buildDocument(previewRecord()),false);
   const canvas=$('optykerPrivacySign'),ctx=canvas.getContext('2d');let drawing=false,last=null;
   function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
   ctx.lineWidth=2.8;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#132e4b';
   canvas.onpointerdown=e=>{if(S.busy)return;e.preventDefault();drawing=true;last=point(e);canvas.setPointerCapture(e.pointerId);};
   canvas.onpointermove=e=>{if(!drawing||S.busy)return;e.preventDefault();const p=point(e);if(Math.hypot(p.x-last.x,p.y-last.y)<1)return;ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;S.ink=true;};
   canvas.onpointerup=canvas.onpointercancel=()=>{drawing=false;last=null;};
   dialog().querySelectorAll('input:not([readonly]),select').forEach(el=>el.addEventListener('change',()=>{if(S.ink){clearSignature();feedback('Scelte modificate: acquisisci nuovamente la firma.');}}));
   $('optykerPrivacyRole').addEventListener('change',()=>{if($('optykerPrivacyRole').value==='self')$('optykerPrivacySigner').value=p.name;else $('optykerPrivacySigner').value='';});
 }
 function clearSignature(){const c=$('optykerPrivacySign');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);S.ink=false;}
 function form(){return {acknowledged:!!$('optykerPrivacyAcknowledged')?.checked,adult_or_authority_confirmed:!!$('optykerPrivacyAuthority')?.checked,health:dialog().querySelector('[name="optykerPrivacy-health"]:checked')?.value||'',marketing:dialog().querySelector('[name="optykerPrivacy-marketing"]:checked')?.value||'',signer_role:$('optykerPrivacyRole')?.value||'',signer_name:$('optykerPrivacySigner')?.value.trim()||'',relationship:$('optykerPrivacyRelationship')?.value.trim()||''};}
 function busy(v){S.busy=v;dialog().querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=v);}
 async function saveSignature(){
   if(S.busy)return;if(clientId()!==S.dialogClient){feedback('Cliente cambiato: riapri Informativa dalla scheda corretta.');return;}
   const f=form();if(!f.acknowledged||!f.adult_or_authority_confirmed||!f.health||!f.marketing||!f.signer_name||(!f.relationship&&f.signer_role!=='self')||!S.ink){feedback('Completa le dichiarazioni, scegli Acconsento o Non acconsento per ogni finalità e acquisisci la firma.');return;}
   const payload={client_id:S.dialogClient,template_id:S.template.id,request_id:S.requestId,form:f,signature_data_url:$('optykerPrivacySign').toDataURL('image/png')};
   const fingerprint=JSON.stringify([payload.template_id,payload.form,payload.signature_data_url]);if(S.submitted&&S.submitted!==fingerprint){S.requestId=uid();payload.request_id=S.requestId;}S.submitted=fingerprint;
   busy(true);try{const result=await api('acquire',payload);S.ink=false;S.requestId='';feedback('Privacy salvata. Prossimo richiamo: '+date(result.renewal_due_on));await afterSave();}catch(e){feedback(e.message);}finally{busy(false);}
 }
 async function afterSave(){
   const id=S.dialogClient;try{S.state=await api('state',{client_id:id});if(dialog().open&&S.dialogClient===id){hub();feedback('Registrazione salvata nel cloud.');}if(clientId()===id){S.client=id;S.error='';S.loaded=Date.now();banner();}if(typeof window.cloudLoadConsents==='function')window.cloudLoadConsents(id).then(()=>{if(clientId()===id)window.clientRenderInformativeDocs?.(true);}).catch(()=>{});}catch(e){feedback('Il salvataggio è riuscito; ricarica per aggiornare lo storico. '+e.message);}
 }
 function withdrawForm(){
   S.view='withdraw';S.requestId=uid();frame('<div class="optykerPrivacyWarning">Registra esclusivamente una revoca effettivamente richiesta dal cliente. Questa registrazione conserva i documenti precedenti e non invia messaggi né cancella gli archivi. Gli operatori devono interrompere le attività fondate sul consenso revocato anche negli altri sistemi.</div><label>Finalità da revocare<select id="optykerPrivacyScope"><option value="">Seleziona…</option><option value="health">Dati relativi alla salute</option><option value="marketing">Comunicazioni promozionali</option><option value="all">Entrambe le finalità</option></select></label><label class="optykerPrivacyCheck"><input id="optykerPrivacyRevocationRequest" type="checkbox"><span>Confermo che la revoca è stata richiesta dal cliente o dal suo rappresentante.</span></label>',btn('optykerPrivacyBack','Indietro')+btn('optykerPrivacyRevoke','Registra revoca',true));
   $('optykerPrivacyScope').onchange=()=>{S.requestId=uid();};$('optykerPrivacyBack').onclick=hub;$('optykerPrivacyRevoke').onclick=async()=>{if(S.busy)return;if(clientId()!==S.dialogClient){feedback('Cliente cambiato: riapri Informativa.');return;}const scope=$('optykerPrivacyScope').value;if(!scope||!$('optykerPrivacyRevocationRequest').checked){feedback('Seleziona la finalità e conferma la richiesta del cliente.');return;}busy(true);try{await api('withdraw',{client_id:S.dialogClient,request_id:S.requestId,target_id:S.state.latest_id,scope,requested_by_client:true});await afterSave();}catch(e){feedback(e.message);}finally{busy(false);}};
 }
 function previewRecord(){return {consent_type:'privacy',signature_data_url:S.ink?$('optykerPrivacySign').toDataURL('image/png'):'',data:{notice:S.template.body,template_version:S.template.version,patient:S.state.patient,statements:PURPOSES,form:form(),acquired_on:S.state.today,operator:window.OPTYKER_CLOUD.username,preview:true}};}
 function buildDocument(r){
   const d=r.data||{},f=d.form||{},p=d.patient||{},rev=r.consent_type==='privacy_withdrawal';
   const signature=/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.signature_data_url||'')?r.signature_data_url:'';
   const h='<header><b>OTTICA VISUAL CARE</b><h1>'+(rev?'Registrazione revoca privacy':'Informativa privacy del cliente')+'</h1><p>'+esc(p.name||'')+' · '+date(d.acquired_on)+'</p></header>'+(d.preview?'<p class="warn">ANTEPRIMA NON REGISTRATA</p>':'')+(rev?'<p>Revoca richiesta per: <b>'+esc({health:'Dati relativi alla salute',marketing:'Comunicazioni promozionali',all:'Entrambe le finalità'}[d.scope]||d.scope)+'</b>.</p><p>Registrata dall’operatore a seguito della richiesta del cliente. La firma della precedente informativa non è una firma della revoca.</p>':'<p>Versione testo: '+esc(d.template_version)+'</p><div class="notice">'+esc(d.notice)+'</div><section><h2>Dichiarazioni e scelte</h2><p>Presa visione: '+(f.acknowledged?'Sì':'Non confermata')+'.</p><p>'+esc(d.statements?.health||PURPOSES.health)+'<br><b>Scelta: '+esc(f.health==='yes'?'Acconsento':f.health==='no'?'Non acconsento':'Non espressa')+'</b></p><p>'+esc(d.statements?.marketing||PURPOSES.marketing)+'<br><b>Scelta: '+esc(f.marketing==='yes'?'Acconsento':f.marketing==='no'?'Non acconsento':'Non espressa')+'</b></p><p>Firmatario: '+esc(f.signer_name)+' · '+esc({self:'Cliente maggiorenne',guardian:'Genitore / tutore',representative:'Rappresentante autorizzato'}[f.signer_role]||'')+(f.relationship?' · '+esc(f.relationship):'')+'</p>'+(signature?'<img class="signature" src="'+signature+'" alt="Firma del cliente o rappresentante">':'<p>Firma non acquisita.</p>')+'</section>')+'<footer><p>Operatore: '+esc(d.operator)+' · Riferimento: '+esc(r.id||'Anteprima')+'</p>'+(d.renewal_due_on?'<p>Prossimo richiamo interno: '+date(d.renewal_due_on)+'. Non è una scadenza legale automatica del consenso.</p>':'')+(d.document_sha256?'<p class="digest">Impronta documento: '+esc(d.document_sha256)+'</p>':'')+'<p>La firma grafica acquisita non è una firma digitale qualificata. Documento generato dal registro Optyker.</p></footer>';
   return '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:"><title>Privacy cliente</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt/1.6 Arial,sans-serif;color:#162f46;margin:25px auto;max-width:780px;padding:20px}header{border-bottom:2px solid #2c6c9a;margin-bottom:18px}header b{letter-spacing:.1em;color:#27628d}h1{font-size:23pt;margin:10px 0}h2{font-size:15pt}.notice{white-space:pre-wrap;overflow-wrap:anywhere}section{margin-top:22px;border-top:1px solid #abc6de;padding-top:12px;break-inside:avoid}.signature{max-width:330px;height:90px;object-fit:contain;object-position:left center}footer{font-size:8pt;border-top:1px solid #abc6de;margin-top:22px;padding-top:10px}.digest{overflow-wrap:anywhere}.warn{background:#fff1d4;padding:10px}@media print{body{padding:0;margin:0;max-width:none}header{break-after:avoid}}</style></head><body>'+h+'</body></html>';
 }
 function printHtml(html,print,w){
   w=w||window.open('','_blank');if(!w){feedback('Consenti le finestre popup per visualizzare o stampare il documento.');return;}
   w.document.open();w.document.write(html);w.document.close();
   if(print)Promise.all(Array.from(w.document.images).map(img=>img.decode?.().catch(()=>{})||Promise.resolve())).then(()=>{if(!w.closed){w.focus();w.print();}});
 }
 async function viewRecord(id,print){
   const w=window.open('','_blank');if(!w){feedback('Consenti le finestre popup per Optyker.');return;}
   w.document.body.textContent='Caricamento documento privacy…';
   try{const r=await api('get',{client_id:S.dialogClient||clientId(),id});printHtml(buildDocument(r),print,w);}catch(e){w.document.body.textContent='Documento non disponibile: '+e.message;}
 }
 function legacyRecords(){
   // Keep all clinical documents unchanged; privacy documents use their saved text snapshot.
   const old=window.cloudConsentRecordHtml;if(typeof old==='function')window.cloudConsentRecordHtml=function(r){return ['privacy','privacy_withdrawal'].includes(r?.consent_type)?buildDocument(r):old.apply(this,arguments);};
   const render=window.clientRenderInformativeDocs;if(typeof render==='function')window.clientRenderInformativeDocs=function(){const result=render.apply(this,arguments);const records=window.OPTYKER_CLOUD?.consents?.[clientId()]||[];$('clientConsentList')?.querySelectorAll('.clientDanger').forEach(b=>{const raw=b.getAttribute('onclick')||'';const r=records.find(r=>raw.includes(r.id));if(r&&['privacy','privacy_withdrawal'].includes(r.consent_type)){b.removeAttribute('onclick');b.textContent='Privacy e storico';b.classList.remove('clientDanger');b.onclick=open;}});return result;};
 }
 function install(){
   if(!$('mainApp'))return;
   const b=$('clientPrivacyTop');if(b)b.textContent='Informativa';
   const chooser=$('consentChooser');if(chooser&&!$('optykerPrivacyChoice')){const b=document.createElement('button');b.type='button';b.id='optykerPrivacyChoice';b.className='consentDocChoice';b.innerHTML='<div class="consentDocName">Privacy cliente</div><div class="consentDocInfo">Informativa sul trattamento dei dati, scelte del cliente, firma e richiamo ogni 12 mesi. Storico delle acquisizioni.</div>';b.onclick=open;chooser.prepend(b);}
   legacyRecords();
   let pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;refresh(false);});}
   const hero=$('clientWorkspaceHero');if(hero)new MutationObserver(schedule).observe(hero,{childList:true,subtree:true});
   const app=$('mainApp');if(app)new MutationObserver(schedule).observe(app,{attributes:true,attributeFilter:['style','class']});
   const panel=$('clientsPanel');if(panel)new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['style','class']});
   window.addEventListener('focus',()=>refresh(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
   setInterval(()=>{if(!document.hidden&&panel&&panel.getClientRects().length)refresh(false);},60000);schedule();
   window.optykerOpenPrivacy=open;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}());
