// Staff-authenticated fiscal-only reissue. No payment/sale insertion and no printer dispatch.
import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {makeDocument,markAutomaticDocument} from 'https://raw.githubusercontent.com/Leahcim12/optyker-web/f3b89e6177495c81ee748211f6db1bfc3416e5b7/supabase/functions/optyker-fiscal-api/domain.mjs';
import {VERSION,validId,planForSale,choosePreparation} from './reissue-domain.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const fields='id,sale_id,payment_id,serial,operation,state,document,document_number,document_date,original_job_id,reissue_of_job_id,updated_at';
async function read(q){const {data,error}=await q;if(error)throw new Error(error.code==='23505'?'Riemissione già preparata: aggiorna lo stato.':error.message||'Registro non disponibile');return data;}
async function login(b){if(!b.username||String(b.password||'').length<8)throw new Error('AUTH_REQUIRED');const {data,error}=await db.rpc('optyker_staff_login_internal',{p_username:String(b.username).trim(),p_password:String(b.password)});if(error||!data?.ok)throw new Error('AUTH_REQUIRED');return String(data.username||b.username);}
async function load(saleId){const sale=await read(db.from('optyker_pos_sales').select('id,client_id,status,total,paid_amount,due_amount,data,delivered_at,updated_at').eq('id',validId(saleId)).single());const [payments,jobs]=await Promise.all([read(db.from('optyker_pos_payments').select('id,sale_id,client_id,amount,payment_method,invoice_requested,billing_invoice_id').eq('sale_id',sale.id)),read(db.from('optyker_fiscal_jobs').select(fields).eq('sale_id',sale.id))]);return {sale,payments,jobs,plan:planForSale(sale,payments,jobs)};}
function publicJob(j){return {id:j.id,sale_id:j.sale_id,payment_id:j.payment_id,state:j.state,operation:j.operation,document_number:j.document_number||null,document_date:j.document_date||null,reissue_of_job_id:j.reissue_of_job_id,total:Number(j.document?.totalCents||0)/100};}
async function status(p){const cid=validId(p.client_id);const sales=await read(db.from('optyker_pos_sales').select('id').eq('client_id',cid).eq('data->>fiscal_reissue_pending','true').limit(21));if(sales.length>20)throw new Error('Troppe riemissioni da verificare');return {version:VERSION,client_id:cid,sales:await Promise.all(sales.map(async s=>(await load(s.id)).plan))};}
async function prepare(p,operator){
 const x=await load(p.sale_id),e=choosePreparation(x.plan,p);
 if(x.sale.client_id!==validId(p.client_id))throw new Error('Cliente non corrispondente alla vendita');
 const existing=e.job_id?x.jobs.find(j=>j.id===e.job_id):null;
 if(existing&&!['prepared','not_started'].includes(existing.state))return {job:publicJob(existing)};
 const original=x.jobs.find(j=>j.id===e.original_job_id),payment=x.payments.find(q=>q.id===e.payment_id),old=original.document;
 const client=await read(db.from('optyker_clients').select('id,fiscal').eq('id',x.sale.client_id).single()),clientFiscal=String(client?.fiscal||'').trim().toUpperCase();
 if(old.talkingReceipt===true&&!clientFiscal)throw new Error('Codice fiscale cliente mancante per la riemissione');
 const input={not_already_issued:true,ts_requested:old.tsRequested===true,talking_receipt:old.talkingReceipt===true,opposition:old.opposition===true,lines:old.lines.map(l=>({department:l.department,quantity:l.quantity,unit_price:l.unitPriceCents/100,description:l.description,expense_code:l.expenseCode||'none'}))};
 const jobId=existing?.id||crypto.randomUUID(),cap=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(cap)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const document={...markAutomaticDocument(makeDocument(payment,input,clientFiscal),jobId),reissueOfJobId:original.id,reissueVoid:{jobId:e.void_job_id,number:e.void_number,date:e.void_date},cashUnchanged:true};
 if(document.serial!==original.serial)throw new Error('Registratore del documento originale non corrispondente');
 const patch={state:'prepared',document,claim_hash:hash,claim_expires_at:new Date(Date.now()+600000).toISOString(),operator_username:operator,updated_at:new Date().toISOString()};
 const job=existing?await read(db.from('optyker_fiscal_jobs').update(patch).eq('id',existing.id).eq('updated_at',existing.updated_at).in('state',['prepared','not_started']).select(fields).maybeSingle()):await read(db.from('optyker_fiscal_jobs').insert({...patch,id:jobId,payment_id:payment.id,sale_id:x.sale.id,serial:original.serial,operation:'sale',original_job_id:null,reissue_of_job_id:original.id}).select(fields).single());
 if(!job)throw new Error('Lo stato è cambiato: aggiorna senza ripetere la stampa');
 return {job:publicJob(job),claim_token:cap,cash_unchanged:true};
}
export async function handleReceiptReissue(b){
 if(JSON.stringify(b).length>12000)throw new Error('Richiesta troppo grande');
 const op=await login(b),p=b.payload||{};let data;
 if(b.action==='reissue_status')data=await status(p);
 else if(b.action==='reissue_prepare')data=await prepare(p,op);
 else if(b.action==='reissue_finish'){const x=await load(p.sale_id);if(x.sale.client_id!==validId(p.client_id)||!x.plan.complete)throw new Error('Riemissione non ancora completata e verificata');data=await read(db.rpc('optyker_finish_receipt_reissue',{p_sale_id:x.sale.id,p_operator:op}));}
 else throw new Error('Operazione non consentita');
 return {ok:true,data,version:VERSION};
}
