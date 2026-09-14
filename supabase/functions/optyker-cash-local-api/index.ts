import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { purchaseIdentity, fiscalLines, paymentDocument } from "https://raw.githubusercontent.com/Leahcim12/optyker-web/17025c4eac9cd2ade18f265c6aee3729e91cee6b/supabase/functions/optyker-cash-register-api/fiscal.mjs";

const U=Deno.env.get('SUPABASE_URL')||'';
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const LEGACY=U+'/functions/v1/optyker-cash-register-api';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
const norm=(v:any)=>String(v??'').trim();
const money=(v:any)=>{const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0};

async function auth(body:any){
 const username=norm(body?.username),password=String(body?.password||'');
 if(!username||password.length<8)throw new Error('AUTH_REQUIRED');
 const {data,error}=await db.rpc('optyker_staff_login_internal',{p_username:username,p_password:password});
 if(error||!data?.ok)throw new Error(data?.error||'Credenziali non valide');
 return String(data.username||username);
}
async function quote(body:any){
 const p=body?.payload||{};
 const r=await fetch(LEGACY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'quote_lines',username:body.username,password:body.password,payload:{lines:Array.isArray(p.lines)?p.lines:[],client_id:norm(p.client_id)}}),signal:AbortSignal.timeout(30000)});
 const x=await r.json().catch(()=>({}));
 if(!r.ok||x?.ok!==true)throw new Error(x?.error||'Impossibile verificare il carrello');
 return x.data||{};
}
async function clientById(id:string){
 if(!id)return null;
 const {data,error}=await db.from('optyker_clients').select('id,name,surname,email,phone,pec,fiscal,vat,street,street_number,postal_code,city,province,reference_no').eq('id',id).maybeSingle();
 if(error)throw error;return data||null;
}
async function previous(requestId:string){
 if(!requestId)return null;
 const {data,error}=await db.from('optyker_pos_sales').select('*').eq('data->>checkout_request_id',requestId).maybeSingle();
 if(error)throw error;if(!data)return null;
 const {data:payments,error:pe}=await db.from('optyker_pos_payments').select('*').eq('sale_id',data.id).order('created_at');
 if(pe)throw pe;return {...data,payment:payments?.[0]||null,recovered:true};
}
async function checkout(body:any,operator:string){
 const p=body?.payload||{},requestId=norm(p.request_id);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new Error('Riferimento univoco incasso richiesto');
 const old=await previous(requestId);if(old)return old;
 if(p.invoice_requested)throw new Error('Per la fattura usa il comando fattura: la stampa scontrino RCH è una funzione separata.');
 if(p.auto_receipt!==true)throw new Error('Questo endpoint è riservato alla vendita con scontrino fisico RCH.');
 const q=await quote(body),linesIn=Array.isArray(p.lines)?p.lines:[],base=Array.isArray(q.lines)?q.lines:[];
 if(!base.length)throw new Error('Il carrello è vuoto');
 const total=money(q.total);if(!(total>0))throw new Error('Totale vendita non valido');
 if(p.expected_total!=null&&Math.abs(money(p.expected_total)-total)>0.01)throw new Error('Il totale del carrello è cambiato: ricarica i prodotti prima di incassare.');
 const client=await clientById(norm(p.client_id));if(p.client_id&&!client)throw new Error('Cliente non trovato');
 const stage=['deposit','balance','delivery_balance'].includes(norm(p.payment_stage))?norm(p.payment_stage):'balance';
 const method=['cash','card'].includes(norm(p.payment_method))?norm(p.payment_method):'';if(!method)throw new Error('Per lo scontrino RCH seleziona Contanti o Carta.');
 let paidNow=total;if(stage==='deposit'){paidNow=money(p.deposit_amount);if(!(paidNow>0&&paidNow<total))throw new Error("L'acconto deve essere maggiore di 0 e inferiore al totale.");}
 const due=money(total-paidNow),paymentStatus=due>0?'partially_paid':'paid';
 const ts=!!p.ts_requested,tsCode=norm(p.ts_expense_code)==='AA'?'AA':'AD',opposition=!!p.ts_opposition;
 const identity=purchaseIdentity(client,p.fiscal_code,ts);
 const fiscal=fiscalLines(base,linesIn);
 const snapshot=paymentDocument(fiscal,method,paidNow,0,identity,{ts,code:tsCode,opposition});
 const requestHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(p))))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const salePayload:any={client_id:client?.id||null,operator_username:operator,payment_stage:stage,payment_method:method,payment_status:paymentStatus,status:due>0?'open_balance':'completed',subtotal:total,discount_total:money(q.discount_total),total,paid_amount:paidNow,due_amount:due,currency:'EUR',shopify_draft_order_id:null,shopify_order_id:null,shopify_order_name:null,note:norm(p.note).slice(0,1000),invoice_requested:false,completed_at:due>0?null:new Date().toISOString(),delivered_at:stage==='delivery_balance'&&due===0?new Date().toISOString():null,data:{source:'optyker_pos_local',channel:'physical_rch_receipt',shopify_order_created:false,checkout_request_id:requestId,checkout_request_hash:requestHash,pricing:{subtotal:q.subtotal??total,discount_total:q.discount_total??0,total:q.total??total},client_snapshot:client||null,fiscal_identity:identity,lines:fiscal,payment_stage:stage,paid_now:paidNow,due_amount:due}};
 const {data:sale,error:se}=await db.from('optyker_pos_sales').insert(salePayload).select('*').single();if(se)throw se;
 try{
  const items=fiscal.map((x:any)=>({sale_id:sale.id,shopify_product_id:x.product_id||null,shopify_variant_id:x.catalog_id?'':(x.shopify_variant_id||x.variant_id||''),title:String(x.title||'Prodotto'),variant_title:String(x.variant_title||''),sku:String(x.sku||''),barcode:String(x.barcode||''),quantity:Number(x.quantity||1),unit_price:money(x.price),total:money(x.total??Number(x.price||0)*Number(x.quantity||1)),data:{image:x.image||'',vendor:x.vendor||'',product_type:x.product_type||'',catalog_id:x.catalog_id||null,fiscal_department:x.fiscal_department,fiscal_vat_code:x.fiscal_vat_code,fiscal_item_type:x.fiscal_item_type}}));
  const {error:ie}=await db.from('optyker_pos_sale_items').insert(items);if(ie)throw ie;
  const {data:payment,error:pe}=await db.from('optyker_pos_payments').insert({sale_id:sale.id,client_id:client?.id||null,operator_username:operator,payment_stage:stage,payment_method:method,amount:paidNow,currency:'EUR',invoice_requested:false,note:norm(p.note).slice(0,1000),data:{source:'optyker_pos_local',channel:'physical_rch_receipt',shopify_order_id:'',shopify_order_name:'',fiscal_snapshot:snapshot}}).select('*').single();if(pe)throw pe;
  return {...sale,payment,shopify_order_created:false};
 }catch(e){await db.from('optyker_pos_sales').delete().eq('id',sale.id);throw e;}
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 try{const body=await req.json().catch(()=>({}));const operator=await auth(body);if(norm(body.action)!=='checkout')return out({ok:false,error:'Azione non riconosciuta'},400);return out({ok:true,data:await checkout(body,operator)});}catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali/.test(m)?401:400)}
});
