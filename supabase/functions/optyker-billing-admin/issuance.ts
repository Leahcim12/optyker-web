import { withFic } from './fic.ts';
import { validateImportedSource } from './foreign.ts';
const BASE='https://api-v2.fattureincloud.it';
const DRAFTS='optyker_fic_drafts', SERIES='optyker_fic_series';
export async function reviewHash(doc:any){
 const sort=(v:any):any=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
 const keys=['id','type','number','numeration','date','entity','items_list','payments_list','amount_gross','amount_net','amount_vat','stamp_duty','e_invoice','ei_data','ei_raw','notes','visible_subject'];
 const bytes=new TextEncoder().encode(JSON.stringify(sort(Object.fromEntries(keys.map(k=>[k,doc[k]??null])))));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
class ProviderError extends Error { status:number; constructor(message:string,status:number){super(message);this.status=status} }
async function request(token:string,path:string,body?:unknown,xml=false){
 const r=await fetch(BASE+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:xml?'application/xml':'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 if(!r.ok){
  let detail='';try{const j=await r.json();detail=String(j.error?.message||j.error?.validation_result?.[0]?.message||'').slice(0,500)}catch{}
  throw new ProviderError('Fatture in Cloud (HTTP '+r.status+'): '+(detail||'richiesta non riuscita'),r.status);
 }
 return xml?r.text():r.json();
}
function text(v:any,max=200){return String(v??'').trim().slice(0,max)}
function date(v:any){const s=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw new Error('Data non valida');return s}
function positive(v:any,zero=false){const n=Number(v);if(!Number.isFinite(n)||(zero?n<0:n<=0)||n>10000000)throw new Error('Importo o quantità non validi');return n}
export function makeDocument(b:any,series:any,info:any){
 const issueDate=date(b.date);
 if(Number(issueDate.slice(0,4))!==series.year)throw new Error('Anno diverso da quello della serie');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(issueDate>today)throw new Error('La data non può essere futura');
 const foreign=series.code==='foreign';
 if(!['sdi','health'].includes(b.channel)||foreign&&b.channel!=='sdi')throw new Error('Seleziona il tipo di fatturazione');
 const entity={name:text(b.entity?.name),type:b.entity?.type==='person'?'person':'company',vat_number:text(b.entity?.vat_number,32).toUpperCase(),tax_code:text(b.entity?.tax_code,32).toUpperCase(),address_street:text(b.entity?.address_street),address_postal_code:text(b.entity?.address_postal_code,12),address_city:text(b.entity?.address_city),address_province:text(b.entity?.address_province,2).toUpperCase(),country:text(b.entity?.country,80),ei_code:text(b.entity?.ei_code,7).toUpperCase(),certified_email:text(b.entity?.certified_email,200)};
 if(!entity.name||!entity.address_street||!entity.address_postal_code||!entity.address_city||!entity.country)throw new Error('Completa nome e indirizzo del cliente o fornitore');
 if(!info.countries_list?.includes(entity.country))throw new Error('Seleziona un paese valido');
 if(!entity.vat_number&&!entity.tax_code)throw new Error('Inserisci partita IVA o codice fiscale');
 if(foreign){if(entity.country==='Italia'||!entity.vat_number)throw new Error('Seleziona il fornitore estero con identificativo fiscale');entity.ei_code='';entity.type='company'}
 else {
  if(entity.country!=='Italia')throw new Error('Per questa serie sono supportati clienti con indirizzo italiano');
  if(!/^[A-Z]{2}$/.test(entity.address_province)||!/^\d{5}$/.test(entity.address_postal_code))throw new Error('Controlla CAP e provincia');
  if(entity.vat_number&&!/^(IT)?\d{11}$/.test(entity.vat_number))throw new Error('Partita IVA italiana non valida');
  if(entity.type==='person'&&!/^[A-Z0-9]{16}$/.test(entity.tax_code))throw new Error('Inserisci il codice fiscale della persona');
  if(entity.type==='company'&&!entity.vat_number)throw new Error('La partita IVA è obbligatoria per le aziende');
  if(b.channel==='sdi'&&!/^[A-Z0-9]{7}$/.test(entity.ei_code))throw new Error('Inserisci il codice destinatario di 7 caratteri, anche 0000000 quando appropriato');
 }
 if(b.channel==='health'&&(entity.type!=='person'||series.code!=='retail'))throw new Error('Il documento sanitario per persona fisica usa la serie dettaglio');
 const td=foreign?text(b.td,4):'TD01';
 if(foreign&&!['TD17','TD18','TD19'].includes(td))throw new Error('Seleziona TD17, TD18 o TD19 in base all’operazione');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>40)throw new Error('Inserisci da 1 a 40 righe');
 const items=b.items.map((i:any)=>{
  const vat=info.vat_types_list?.find((v:any)=>v.id===Number(i.vat_id)&&!v.is_disabled&&(b.channel==='health'||v.e_invoice!==false));
  if(!vat)throw new Error('Seleziona un’aliquota IVA valida per ogni riga');
  const name=text(i.name,500);if(!name)throw new Error('Descrizione riga obbligatoria');
  return {name,qty:positive(i.qty),net_price:positive(i.net_price,true),vat:{id:vat.id},stock:false};
 });
 if(!/^MP(0[1-9]|1[0-9]|2[0-3])$/.test(b.payment_method))throw new Error('Seleziona la modalità di pagamento');
 const due=date(b.due_date);if(due<issueDate)throw new Error('La scadenza non può precedere la fattura');
 const doc:any={type:foreign?'self_supplier_invoice':'invoice',date:issueDate,year:series.year,numeration:series.suffix,entity,currency:{id:'EUR'},language:{code:'it'},visible_subject:text(b.subject),subject:text(b.subject),notes:text(b.notes,2000),use_gross_prices:false,e_invoice:b.channel==='sdi',items_list:items,ei_data:{payment_method:b.payment_method},stamp_duty:positive(b.stamp_duty??0,true),payments_list:[{amount:0,due_date:due,status:'not_paid'}],extra_data:{ts_communication:false},ei_raw:{FatturaElettronicaBody:{DatiGenerali:{DatiGeneraliDocumento:{TipoDocumento:td}}}}};
 if(doc.stamp_duty!==0&&doc.stamp_duty!==2)throw new Error('Bollo supportato: 0 oppure 2 euro');
 if(foreign){
  const original=text(b.original_number,100);if(!original)throw new Error('Numero della fattura estera obbligatorio');
  const originalDate=date(b.original_date);if(originalDate>today)throw new Error('La data della fattura estera non può essere futura');
  doc.ei_raw.FatturaElettronicaBody.DatiGenerali.DatiFattureCollegate=[{IdDocumento:original,Data:originalDate}];
 }
 return doc;
}
async function seriesRows(db:any){const r=await db.from(SERIES).select('*').order('code');if(r.error)throw r.error;return r.data}
async function getDraft(db:any,id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Documento non valido');const r=await db.from(DRAFTS).select('*').eq('id',id).single();if(r.error||!r.data)throw new Error('Documento non trovato');return r.data}
async function updateDraft(db:any,id:string,data:any){const r=await db.from(DRAFTS).update({...data,updated_at:new Date().toISOString()}).eq('id',id);if(r.error)throw r.error}
function summary(d:any){return {id:d.id,series:d.series,number:d.number,document:d.payload,totals:d.totals,state:d.state,provider_id:d.provider_id,last_error:d.last_error,source_id:d.source_id||null,source_context:d.source_context||null}}
async function allDocuments(token:string,company:string,type:string){
 const docs:any[]=[];const started=Date.now();
 for(let page=1;page<=20;page++){
  if(Date.now()-started>40000)throw new Error('Verifica numerazione troppo lunga: riprova più tardi');
  const r=await request(token,`/c/${company}/issued_documents?type=${type}&fieldset=detailed&per_page=100&page=${page}`);
  if(!Array.isArray(r.data))throw new Error('Elenco documenti non valido');docs.push(...r.data);
  if(!r.last_page||page>=r.last_page)return docs;
 }
 throw new Error('Troppi documenti: numerazione da verificare con l’assistenza');
}
export function remoteSequence(docs:any[],payload:any){const rows=docs.filter(d=>d.numeration===payload.numeration&&String(d.date).slice(0,4)===String(payload.year));return {number:Math.max(0,...rows.map(d=>Number(d.number)||0)),date:rows.map(d=>d.date).filter(Boolean).sort().at(-1)||null}}
async function mirror(db:any,company:string,d:any){
 const row={provider_invoice_id:`fic:${company}:${d.id}`,direction:'outgoing',invoice_number:String(d.number)+String(d.numeration||''),issue_date:d.date,counterparty_name:d.entity?.name||'',counterparty_vat:d.entity?.vat_number||'',counterparty_fiscal_code:d.entity?.tax_code||'',header:d.visible_subject||d.subject||'',total:d.amount_gross??null,currency:'EUR',sdi_status:d.e_invoice?(d.ei_status||'not_sent'):'not_applicable',provider_status:d.ei_status||'',provider_payload:d,updated_at:new Date().toISOString()};
 const old=await db.from('optyker_billing_invoices').select('id').eq('direction','outgoing').eq('provider_invoice_id',row.provider_invoice_id).maybeSingle();if(old.error)throw old.error;
 const r=old.data?await db.from('optyker_billing_invoices').update(row).eq('id',old.data.id):await db.from('optyker_billing_invoices').insert(row);if(r.error)throw r.error;
}
export function assertXml(xml:string,doc:any){
 const type=doc.ei_raw?.FatturaElettronicaBody?.DatiGenerali?.DatiGeneraliDocumento?.TipoDocumento;
 if(!new RegExp('<(?:\\w+:)?TipoDocumento>\\s*'+type+'\\s*</').test(xml))throw new Error('Tipo documento XML diverso da quello scelto: invio bloccato');
 if(doc.type==='self_supplier_invoice'&&!/<(?:\w+:)?DatiFattureCollegate[>\s]/.test(xml))throw new Error('Riferimento fattura estera mancante nell’XML: invio bloccato');
 if(doc.type==='self_supplier_invoice'){
  const original=doc.ei_raw.FatturaElettronicaBody.DatiGenerali.DatiFattureCollegate[0];
  const decode=(v:string)=>v.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  const linked=[...xml.matchAll(/<(?:\w+:)?DatiFattureCollegate(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?DatiFattureCollegate>/g)];
  const value=(block:string,tag:string)=>decode((block.match(new RegExp('<(?:\\w+:)?'+tag+'>([\\s\\S]*?)</(?:\\w+:)?'+tag+'>'))?.[1]||'').trim());
  if(!linked.some(m=>value(m[1],'IdDocumento')===original.IdDocumento&&value(m[1],'Data')===original.Data))throw new Error('Numero o data della fattura originale diversi nell’XML: invio bloccato');
 }
}
export async function issuance(db:any,action:string,b:any){
 if(action==='fic_draft')return {draft:summary(await getDraft(db,b.id))};
 if(action==='fic_drafts'){const r=await db.from(DRAFTS).select('*').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;return {drafts:r.data.map(summary)}}
 return withFic(db,async(token,company,canWrite)=>{
  const root='/c/'+encodeURIComponent(company);
  if(action==='fic_form'){
   const series=await seriesRows(db);const info=await request(token,root+'/issued_documents/info?type='+(b.series==='foreign'?'self_supplier_invoice':'invoice'));
   return {series,info:info.data,can_write:canWrite};
  }
  if(action==='fic_preview'){
   const sourceContext=await validateImportedSource(db,b);
   const series=(await seriesRows(db)).find((s:any)=>s.code===b.series&&s.year===Number(String(b.date).slice(0,4)));if(!series)throw new Error('Serie non configurata per questo anno');
   const info=await request(token,root+'/issued_documents/info?type='+(series.code==='foreign'?'self_supplier_invoice':'invoice'));
   const doc=makeDocument(b,series,info.data);const totals=await request(token,root+'/issued_documents/totals',{data:doc,options:{fix_payments:true}});
   if(!Number.isFinite(Number(totals.data?.amount_gross))||Number(totals.data.amount_gross)<=0)throw new Error('Totale del documento non valido');
   doc.payments_list[0].amount=Number(totals.data.amount_due??totals.data.amount_gross);
   let id=crypto.randomUUID(),reservedNumber=null;
   if(b.draft_id){const old=await getDraft(db,b.draft_id);if(!['preview','create_rejected'].includes(old.state))throw new Error('Documento già creato o in elaborazione');if(old.series!==series.code||old.year!==series.year)throw new Error('La serie di un documento prenotato non può cambiare');if((old.source_id||null)!==(b.source_id||null))throw new Error('Il documento originale collegato non può cambiare');id=old.id;reservedNumber=old.number;if(old.number)doc.number=old.number;}
   if(!doc.number){const seq=remoteSequence(await allDocuments(token,company,doc.type),doc);doc.number=Math.max(seq.number,series.last_number)+1;}
   doc.extra_data.imported_by='optyker:'+id;
   const row={id,number:reservedNumber,review_hash:null,reviewed_at:null,series:series.code,year:series.year,payload:doc,totals:totals.data,state:'preview',last_error:null,source_id:b.source_id||null,source_context:sourceContext?.context||null,updated_at:new Date().toISOString()};
   const r=sourceContext?await db.rpc('optyker_fic_save_import_preview',{p_row:row,p_invoice_key:sourceContext.invoiceKey}):await db.from(DRAFTS).upsert(row).select('*').single();
   if(r.error){if(r.error.code==='23505'&&b.source_id)throw new Error('Fattura originale o integrazione già presente. Riapri il documento esistente dall’elenco Fatture estere.');throw r.error}
   return {...summary(Array.isArray(r.data)?r.data[0]:r.data),suggested_number:doc.number||series.last_number+1};
  }
  if(!canWrite)throw new Error('Abilita creazione e invio con il pulsante di autorizzazione Fatture in Cloud.');
  let d=await getDraft(db,b.id);
  if(action==='fic_create'){
   if(b.confirm_create!==true||b.confirm_date!==true)throw new Error('Conferma creazione e data rispetto alla precedente fattura della serie');
   if(d.provider_id)return summary(d);
   if(!['preview','create_rejected'].includes(d.state))throw new Error('Esito creazione da verificare. Non creare un duplicato: controlla Fatture in Cloud.');
   const existing=await allDocuments(token,company,d.payload.type);const seq=remoteSequence(existing,d.payload);
   if(d.number&&existing.some(x=>x.number===d.number&&x.numeration===d.payload.numeration&&String(x.date).slice(0,4)===String(d.year)))throw new Error('Numero già presente in Fatture in Cloud: verifica il documento');
   const localSeries=(await seriesRows(db)).find((s:any)=>s.code===d.series&&s.year===d.year);
   if(!d.number&&d.payload.number!==Math.max(seq.number,localSeries.last_number)+1)throw new Error('La numerazione è cambiata. Torna alla modifica e aggiorna l’anteprima.');
   const reserved=await db.rpc('optyker_fic_reserve',{p_id:d.id,p_remote_number:seq.number,p_remote_date:seq.date});if(reserved.error)throw reserved.error;d=Array.isArray(reserved.data)?reserved.data[0]:reserved.data;if(!d?.id)throw new Error('Prenotazione numero non riuscita');
   // Never automatically retry an ambiguous create response.
   let result:any;
   try{result=await request(token,root+'/issued_documents',{data:d.payload,options:{fix_payments:true}})}catch(e){await updateDraft(db,d.id,{state:e instanceof ProviderError&&e.status>=400&&e.status<500?'create_rejected':'create_unknown',last_error:e instanceof Error?e.message:'Esito sconosciuto'});throw e}
   if(!result.data?.id){await updateDraft(db,d.id,{state:'create_unknown',last_error:'Identificativo non restituito: verificare Fatture in Cloud'});throw new Error('Esito creazione da verificare in Fatture in Cloud')}
   await updateDraft(db,d.id,{provider_id:String(result.data.id),state:'created',last_error:null});
   const saved=await db.from(SERIES).update({last_date:d.payload.date}).eq('code',d.series).eq('year',d.year);if(saved.error)throw saved.error;
   await mirror(db,company,result.data);return summary(await getDraft(db,d.id));
  }
  if(!d.provider_id)throw new Error('Prima crea la fattura');
  const current=await request(token,root+'/issued_documents/'+encodeURIComponent(d.provider_id)+'?fieldset=detailed');
  if(action==='fic_document'){const hash=await reviewHash(current.data);await updateDraft(db,d.id,{review_hash:hash,reviewed_at:new Date().toISOString()});await mirror(db,company,current.data);return {...summary(d),remote:current.data,review_hash:hash}}
  if(action==='fic_send'){
   if(!b.review_hash||b.review_hash!==d.review_hash||await reviewHash(current.data)!==d.review_hash||Date.now()-Date.parse(d.reviewed_at)>600000)throw new Error('Riapri l’anteprima prima di inviare: il documento potrebbe essere cambiato.');
   if(b.confirm_send!==true)throw new Error('Conferma esplicita di invio SDI richiesta');
   if(!d.payload.e_invoice||!current.data.e_invoice)throw new Error('Questo documento non prevede l’invio allo SDI');
   if(['sent','sending','send_unknown'].includes(d.state))throw new Error('Invio già richiesto o esito da verificare: aggiorna lo stato');
   if(d.state!=='created'||current.data.ei_status!=='not_sent')throw new Error('Lo stato del documento non consente l’invio da Optyker');
   if(current.data.number!==d.number||current.data.numeration!==d.payload.numeration||current.data.date!==d.payload.date||Number(current.data.amount_gross)!==Number(d.totals.amount_gross))throw new Error('La fattura è stata modificata in Fatture in Cloud: verifica prima dell’invio');
   const xml=await request(token,root+'/issued_documents/'+d.provider_id+'/e_invoice/xml',undefined,true);assertXml(xml,d.payload);
   await request(token,root+'/issued_documents/'+d.provider_id+'/e_invoice/send',{options:{dry_run:true}});
   await updateDraft(db,d.id,{state:'sending',last_error:null});
   try{await request(token,root+'/issued_documents/'+d.provider_id+'/e_invoice/send',{options:{dry_run:false}})}catch(e){await updateDraft(db,d.id,{state:e instanceof ProviderError&&e.status>=400&&e.status<500?'created':'send_unknown',last_error:e instanceof Error?e.message:'Esito sconosciuto'});throw e}
   await updateDraft(db,d.id,{state:'sent',last_error:null});return summary(await getDraft(db,d.id));
  }
  throw new Error('Azione non riconosciuta');
 });
}
