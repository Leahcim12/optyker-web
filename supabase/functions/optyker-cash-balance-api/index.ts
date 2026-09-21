import {createClient} from 'jsr:@supabase/supabase-js@2';
import {balances,VERSION} from './domain.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{autoRefreshToken:false,persistSession:false}});
const origins=new Set(['https://optyker.it','https://www.optyker.it']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function read(q:any){const {data,error}=await q;if(error)throw new Error('Verifica acconti non disponibile');return data;}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://optyker.it','Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin'};
 const out=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(origin&&!origins.has(origin))return out({ok:false,error:'Origin non consentita'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 try{
  const raw=await req.text();if(raw.length>12000)throw new Error('Richiesta troppo grande');
  const b=JSON.parse(raw),u=String(b.username||'').trim(),p=String(b.password||'');
  if(!u||p.length<8)throw new Error('AUTH_REQUIRED');
  const {data:auth,error}=await db.rpc('optyker_staff_login_internal',{p_username:u,p_password:p});
  if(error||auth?.ok!==true)throw new Error('AUTH_REQUIRED');
  if(b.action!=='snapshot')throw new Error('Solo lettura del saldo consentita');
  const id=String(b.payload?.client_id||'');if(id&&!uuid.test(id))throw new Error('Cliente non valido');
  const active=await read(db.from('optyker_fiscal_jobs').select('id,sale_id,payment_id,state,operation,document,created_at').eq('serial','72IV6003831').in('state',['sending','uncertain']).limit(2));
  const blockers=active.map((j:any)=>({id:j.id,sale_id:j.sale_id,payment_id:j.payment_id,state:j.state,operation:j.operation||'sale',amount_cents:Number.isSafeInteger(j.document?.totalCents)?j.document.totalCents:null,created_at:j.created_at}));
  if(!id)return out({ok:true,data:{version:VERSION,client_id:'',groups:[],conflicts:[],blockers,checked_at:new Date().toISOString()}});
  const cart=await read(db.from('optyker_client_carts').select('client_id,items,updated_at').eq('client_id',id).maybeSingle());
  const sales=await read(db.from('optyker_pos_sales').select('id,client_id,status,total,paid_amount,due_amount,delivered_at,created_at,data').eq('client_id',id).is('delivered_at',null).eq('data->>client_cart_selection','true').order('created_at',{ascending:false}).limit(301));
  if(sales.length>300)throw new Error('Troppe vendite da verificare: apri Acconti aperti');
  const ids=sales.map((s:any)=>s.id);
  const payments=ids.length?await read(db.from('optyker_pos_payments').select('id,sale_id,client_id,amount,payment_stage,invoice_requested,billing_invoice_id,created_at').in('sale_id',ids)):[];
  const jobs=ids.length?await read(db.from('optyker_fiscal_jobs').select('id,sale_id,payment_id,state,operation,document_number').in('sale_id',ids)):[];
  const projection=balances(id,cart?.items||[],sales,payments,jobs);
  return out({ok:true,data:{version:VERSION,client_id:id,cart_version:cart?.updated_at||null,...projection,blockers,checked_at:new Date().toISOString()}});
 }catch(e){const m=e instanceof Error?e.message:'Verifica non disponibile';return out({ok:false,error:m},m==='AUTH_REQUIRED'?401:400);}
});
