import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {makeDocument,makeVoid,reference,resultState,SERIAL,RELEASE} from './domain.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(['https://www.optyker.it','https://optyker.it']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(v:any){if(!uuid.test(String(v||'')))throw new Error('Riferimento non valido');return String(v);}
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const now=()=>new Date().toISOString();
async function readBody(req:Request){
 if(!req.body)throw new Error('Richiesta mancante');const reader=req.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>150000){await reader.cancel();throw new Error('Richiesta troppo grande');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
 finally{reader.releaseLock();}
 try{return JSON.parse(text);}catch{throw new Error('Formato richiesta non valido');}
}
async function one(q:any){const {data,error}=await q;if(error)throw new Error(error.code==='P0001'?error.message:error.code==='23505'?'Operazione già registrata o registratore impegnato. Aggiorna lo stato prima di continuare.':'Impossibile aggiornare il registro fiscale');return data;}
function publicJob(j:any){if(!j)return null;const {claim_hash,claim_expires_at,result_hash,document,...out}=j;return {...out,operation:j.operation||'sale',original_document:document.original||null,void_reason:document.operation==='void'?document.reason:null,total:document.totalCents/100,talking_receipt:document.talkingReceipt,ts_requested:document.tsRequested};}
async function login(b:any){
 if(!b.username||String(b.password||'').length<8)throw new Error('AUTH_REQUIRED');
 const {data,error}=await db.rpc('optyker_staff_login_internal',{p_username:String(b.username).trim(),p_password:String(b.password)});
 if(error||!data?.ok)throw new Error('AUTH_REQUIRED');return String(data.username);
}
async function getJob(jobId:any){const j=await one(db.from('optyker_fiscal_jobs').select('*').eq('id',id(jobId)).maybeSingle());if(!j)throw new Error('Emissione non trovata');return j;}
async function jobView(jobId:any){
 const job=await getJob(jobId),out=publicJob(job);
 if(job.operation==='sale')out.void_job=publicJob(await one(db.from('optyker_fiscal_jobs').select('*').eq('original_job_id',job.id).eq('operation','void').maybeSingle()));
 return out;
}
async function saleView(saleId:any){
 const sale=await one(db.from('optyker_pos_sales').select('id,status,total,data,invoice_requested').eq('id',id(saleId)).maybeSingle());
 if(!sale)throw new Error('Vendita non trovata');
 const payments=await one(db.from('optyker_pos_payments').select('id,payment_stage,payment_method,amount,invoice_requested,billing_invoice_id,created_at').eq('sale_id',sale.id).order('created_at'));
 const jobs=await one(db.from('optyker_fiscal_jobs').select('*').eq('sale_id',sale.id));
 return {sale_id:sale.id,status:sale.status,total:sale.total,lines:sale.data?.lines||[],has_fiscal_code:!!sale.data?.client_snapshot?.fiscal,payments,jobs:jobs.filter((j:any)=>j.operation==='sale').map((j:any)=>({...publicJob(j),void_job:publicJob(jobs.find((v:any)=>v.original_job_id===j.id&&v.operation==='void'))}))};
}
async function prepare(p:any,operator:string){
 const payment=await one(db.from('optyker_pos_payments').select('*').eq('id',id(p.payment_id)).maybeSingle());
 if(!payment)throw new Error('Pagamento non trovato');
 const sale=await one(db.from('optyker_pos_sales').select('id,status,data').eq('id',payment.sale_id).single());
 if(!['completed','open_balance'].includes(sale.status))throw new Error('Completa prima la registrazione della vendita');
 // Use the recorded client identity, never an arbitrary CF from a print request.
 const document=makeDocument(payment,p,sale.data?.client_snapshot?.fiscal||'');
 const existing=await one(db.from('optyker_fiscal_jobs').select('*').eq('payment_id',payment.id).eq('operation','sale').maybeSingle());
 if(existing&&!['prepared','not_started'].includes(existing.state))return {job:publicJob(existing)};
 const cap=token();const patch={state:'prepared',document,claim_hash:await hash(cap),claim_expires_at:new Date(Date.now()+600000).toISOString(),updated_at:now()};
 let job;
 if(existing){job=await one(db.from('optyker_fiscal_jobs').update(patch).eq('id',existing.id).in('state',['prepared','not_started']).select('*').maybeSingle());}
 else job=await one(db.from('optyker_fiscal_jobs').insert({...patch,payment_id:payment.id,sale_id:sale.id,operator_username:operator,serial:SERIAL}).select('*').single());
 if(!job)throw new Error('Stato modificato: aggiorna prima di continuare');
 return {job:publicJob(job),claim_token:cap};
}
async function prepareVoid(p:any,operator:string){
 const original=await getJob(p.original_job_id),document=makeVoid(original,p);
 const existing=await one(db.from('optyker_fiscal_jobs').select('*').eq('original_job_id',original.id).eq('operation','void').maybeSingle());
 if(existing&&!['prepared','not_started'].includes(existing.state))return {job:publicJob(existing)};
 const queue=await one(db.from('optyker_ts_outbox').select('state,protocol').eq('job_id',original.id).maybeSingle());
 if(queue&&(queue.state!=='awaiting_configuration'||queue.protocol))throw new Error('Spesa TS già elaborata o sospesa: verificarne la rettifica prima dell’annullo');
 const cap=token(),patch={state:'prepared',document,claim_hash:await hash(cap),claim_expires_at:new Date(Date.now()+600000).toISOString(),operator_username:operator,updated_at:now()};
 const job=existing?await one(db.from('optyker_fiscal_jobs').update(patch).eq('id',existing.id).in('state',['prepared','not_started']).select('*').maybeSingle()):
  await one(db.from('optyker_fiscal_jobs').insert({...patch,operation:'void',original_job_id:original.id,payment_id:original.payment_id,sale_id:original.sale_id,serial:original.serial}).select('*').single());
 if(!job)throw new Error('Stato modificato: aggiorna prima di continuare');
 return {job:publicJob(job),claim_token:cap};
}
async function claim(p:any){
 if(!/^[a-f0-9]{64}$/.test(String(p.token||'')))throw new Error('AUTH_REQUIRED');
 const resultToken=token();
 const operation=p.operation||'sale';if(!['sale','void'].includes(operation))throw new Error('Operazione non valida');
 const job=await one(db.rpc('optyker_claim_fiscal_job',{p_job_id:id(p.job_id),p_claim_hash:await hash(p.token),p_result_hash:await hash(resultToken),p_operation:operation}));
 return {job_id:job.id,document:job.document,result_token:resultToken};
}
async function outcome(p:any){
 if(!/^[a-f0-9]{64}$/.test(String(p.token||'')))throw new Error('AUTH_REQUIRED');
 const job=await getJob(p.job_id);if(job.result_hash!==await hash(p.token))throw new Error('AUTH_REQUIRED');
 if(job.state!=='sending')return {job:publicJob(job)};
 const r=p.result||{},state=resultState(r,job.document.commands.length);
 const safe={state,commandsAcknowledged:Number.isInteger(r.commandsAcknowledged)?r.commandsAcknowledged:0,writeStarted:r.writeStarted===true,idleAfter:r.idleAfter===true,error:String(r.error||'').slice(0,250),connectorVersion:String(r.connectorVersion||'').slice(0,60)};
 const updated=await one(db.rpc('optyker_record_fiscal_outcome',{p_job_id:job.id,p_result_hash:await hash(p.token),p_state:state,p_result:safe}));
 return {job:publicJob(updated)};
}
async function saveReference(p:any,operator:string){
 let job=await getJob(p.job_id);
 if(!['awaiting_reference','completed'].includes(job.state))throw new Error('Serve prima una chiusura confermata dalla RCH. Gli esiti incerti richiedono una verifica tecnica.');
 if(job.operation==='void'&&p.void_verified!==true)throw new Error('Conferma che la stampa è un annullo riferito allo scontrino originale');
 const ref=reference(p,job.document.totalCents);
 if(job.state==='completed'&&(job.document_number!==ref.number||job.document_date!==ref.date))throw new Error('Riferimento già registrato: non può essere sostituito');
 let doc=null;
 if(job.document.tsRequested){
  const payment=await one(db.from('optyker_pos_payments').select('created_at').eq('id',job.payment_id).single());
  const paymentDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date(payment.created_at));
  doc={serial:job.serial,number:ref.number,date:ref.date,paymentDate,paymentMethod:job.document.paymentMethod,
   opposition:job.document.opposition,fiscalCode:job.document.opposition?'':job.document.fiscalCode,
   lines:job.document.lines.filter((l:any)=>l.expenseCode!=='none'),referenceSource:'paper_confirmed',referenceConfirmedBy:operator};
 }
 job=await one(db.rpc('optyker_confirm_fiscal_reference',{p_job_id:job.id,p_number:ref.number,p_date:ref.date,p_operator:operator,p_ts_document:doc}));
 return {job:publicJob(job)};
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://www.optyker.it','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const out=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return out({ok:false,error:'Origin non consentita'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 try{
  const body=await readBody(req),p=body.payload||{},a=body.action;
  // The bridge has a short-lived, single-use capability bound to one payment;
  // it never receives the operator password or the service_role key.
  if(a==='bridge_claim')return out({ok:true,data:await claim(p)});
  if(a==='bridge_outcome')return out({ok:true,data:await outcome(p)});
  const operator=await login(body);
  if(a==='sale')return out({ok:true,data:await saleView(p.sale_id)});
  if(a==='prepare')return out({ok:true,data:await prepare(p,operator)});
  if(a==='prepare_void')return out({ok:true,data:await prepareVoid(p,operator)});
  if(a==='job')return out({ok:true,data:{job:await jobView(p.job_id)}});
  if(a==='reference')return out({ok:true,data:await saveReference(p,operator)});
  if(a==='ts_outbox'){
   const data=await one(db.from('optyker_ts_outbox').select('id,job_id,state,document,protocol,outcome,created_at').order('created_at',{ascending:false}).limit(100));
   return out({ok:true,data,transport_ready:false,reason:'Kit tecnico e accesso TS da verificare; nessun invio effettuato',release:RELEASE});
  }
  throw new Error('Azione non valida');
 }catch(e){const message=e instanceof Error?e.message:'Errore fiscale';return out({ok:false,error:message},message==='AUTH_REQUIRED'?401:400);}
});
