import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { purchaseIdentity, fiscalLines, paymentDocument } from "https://raw.githubusercontent.com/Leahcim12/optyker-web/17025c4eac9cd2ade18f265c6aee3729e91cee6b/supabase/functions/optyker-cash-register-api/fiscal.mjs";

const U=Deno.env.get('SUPABASE_URL')||'';
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const LEGACY=U+'/functions/v1/optyker-cash-register-api-v2';
const INVENTORY=U+'/functions/v1/optyker-inventory-api';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
const norm=(v:any)=>String(v??'').trim();
const money=(v:any)=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
function mixedBreakdown(value:any,total:number){
 const valid=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<1e-7;
 if(!value||typeof value!=='object'||!valid(value.cash)||!valid(value.card)||Math.round(value.cash*100)+Math.round(value.card*100)!==Math.round(total*100))throw new Error('Contanti e carta devono coprire esattamente l’importo da incassare.');
 return {cash:money(value.cash),card:money(value.card)};
}
const keyOf=(v:any)=>norm(v?.variant_id||v?.shopify_variant_id||v?.catalog_id||v?.id);

async function auth(body:any){
 const username=norm(body?.username),password=String(body?.password||'');
 if(!username||password.length<8)throw new Error('AUTH_REQUIRED');
 const {data,error}=await db.rpc('optyker_staff_login_internal',{p_username:username,p_password:password});
 if(error||!data?.ok)throw new Error(data?.error||'Credenziali non valide');
 return String(data.username||username);
}
async function callApi(url:string,body:any){
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const x=await r.json().catch(()=>({}));
 if(!r.ok||x?.ok!==true)throw new Error(x?.error||('HTTP '+r.status));
 return x.data;
}
async function quote(body:any){
 const p=body?.payload||{};
 return await callApi(LEGACY,{action:'quote_lines',username:body.username,password:body.password,payload:{lines:Array.isArray(p.lines)?p.lines:[],client_id:norm(p.client_id)}})||{};
}
async function clientById(id:string){
 if(!id)return null;
 const {data,error}=await db.from('optyker_clients').select('id,name,surname,email,phone,pec,fiscal,vat,street,street_number,postal_code,city,province,reference_no').eq('id',id).maybeSingle();
 if(error)throw error;return data||null;
}
function priceLines(base:any[],choices:any[]){
 const map=new Map<string,any>();for(const c of choices){const k=keyOf(c);if(k)map.set(k,c)}
 return base.map((l:any)=>{
   const c=map.get(keyOf(l)),before=money(l.price),qty=Number(l.quantity||c?.quantity||1);let price=before,manual=false;
   if(c&&Object.prototype.hasOwnProperty.call(c,'unit_price_override')){
     const raw=c.unit_price_override,n=Number(raw);
     if(raw===''||raw===null||raw===undefined||!Number.isFinite(n)||n<0||n>1000000)throw new Error('Prezzo manuale non valido per '+String(l.title||'prodotto'));
     price=money(n);manual=Math.abs(price-before)>0.0001;
   }
   return {...l,quantity:qty,quoted_unit_price:before,manual_price_override:manual,price,total:money(price*qty)};
 });
}
function priceSummary(q:any,lines:any[]){
 const quoted=money(q?.total??lines.reduce((s,l)=>s+money(l.quoted_unit_price)*Number(l.quantity||1),0));
 const total=money(lines.reduce((s,l)=>s+money(l.price)*Number(l.quantity||1),0));
 return {quoted_total:quoted,subtotal:total,discount_total:money(q?.discount_total||0),manual_adjustment:money(total-quoted),total};
}
function stockLines(lines:any[]){
 const m=new Map<string,any>();
 for(const l of lines){
   if(l?.is_service===true||String(l?.fiscal_item_type||'')==='services')continue;
   const inventoryId=norm(l.inventory_item_id),variant=norm(l.shopify_variant_id||l.variant_id);
   if(!inventoryId&&!variant.startsWith('gid://shopify/ProductVariant/'))continue;
   const k=inventoryId||variant,q=Number(l.quantity||1),old=m.get(k);
   if(old){old.quantity+=q;continue}
   m.set(k,{inventory_item_id:inventoryId||null,variant_id:variant,quantity:q,unit_price:money(l.price)});
 }
 return [...m.values()];
}
async function syncInventory(body:any,saleId:string){
 const {data,error}=await db.from('optyker_inventory_movements').select('*').eq('sale_id',saleId).order('created_at');if(error)throw error;
 const warnings:string[]=[];
 for(const movement of data||[]){
   if(movement.shopify_synced===true)continue;
   try{
     const {data:item,error:ie}=await db.from('optyker_inventory_items').select('id,inventory_quantity,shopify_inventory_item_id,shopify_location_id').eq('id',movement.inventory_item_id).maybeSingle();if(ie)throw ie;
     if(!item)throw new Error('Prodotto magazzino non trovato');
     if(!item.shopify_inventory_item_id||!item.shopify_location_id){
       await db.from('optyker_inventory_movements').update({shopify_synced:true,updated_at:new Date().toISOString(),data:{...(movement.data||{}),shopify_sync:'not_linked'}}).eq('id',movement.id);
       continue;
     }
     await callApi(INVENTORY,{action:'stock_difference',username:body.username,password:body.password,payload:{id:item.id,actual_quantity:Number(item.inventory_quantity||0)}});
     await db.from('optyker_inventory_movements').update({shopify_synced:true,updated_at:new Date().toISOString(),data:{...(movement.data||{}),shopify_sync_at:new Date().toISOString()}}).eq('id',movement.id);
   }catch(e){
     const msg=e instanceof Error?e.message:String(e);warnings.push(msg);
     await db.from('optyker_inventory_movements').update({updated_at:new Date().toISOString(),data:{...(movement.data||{}),shopify_sync_error:msg,shopify_sync_error_at:new Date().toISOString()}}).eq('id',movement.id);
   }
 }
 return warnings;
}
async function applyInventory(body:any,sale:any,lines:any[],operator:string){
 const payload=stockLines(lines);if(!payload.length)return {count:0,warnings:[]};
 const {data,error}=await db.rpc('optyker_apply_pos_inventory_movements',{p_sale_id:sale.id,p_lines:payload,p_operator:operator});
 if(error)throw new Error(error.message||'Impossibile scaricare il magazzino');
 const movements=Array.isArray(data)?data:[],warnings=await syncInventory(body,sale.id);
 if(movements.length<payload.length)warnings.push('Uno o più prodotti non risultano collegati al magazzino Optyker.');
 return {count:movements.length,warnings};
}
async function completeCart(sale:any,operator:string){const {data,error}=await db.rpc('optyker_complete_client_cart_sale',{p_sale_id:sale.id,p_operator:operator});if(error)throw new Error('Carrello da sincronizzare: usa Recupera incasso. '+error.message);return data}
async function previous(body:any,requestId:string){
 if(!requestId)return null;
 const {data,error}=await db.from('optyker_pos_sales').select('*').eq('data->>checkout_request_id',requestId).maybeSingle();if(error)throw error;if(!data)return null;
 const {data:payments,error:pe}=await db.from('optyker_pos_payments').select('*').eq('sale_id',data.id).order('created_at');if(pe)throw pe;
 const warnings=await syncInventory(body,data.id).catch(e=>[e instanceof Error?e.message:String(e)]);
 return {...data,client_cart:await completeCart(data,norm(body.username)),payment:payments?.[0]||null,recovered:true,shopify_order_created:false,inventory_warning:warnings.join(' · ')};
}
function stageLabel(v:string){return v==='deposit'?'Acconto':v==='delivery_balance'?'Saldo consegna':'Saldo'}
async function invoiceDraft(sale:any,payment:any,client:any,operator:string,stage:string,method:string,amount:number){
 if(!client)throw new Error('Per creare la fattura seleziona un cliente.');
 const vat=norm(client.vat),fiscal=norm(client.fiscal);if(!vat&&!fiscal)throw new Error('Per creare la fattura completa P.IVA o Codice Fiscale nella scheda cliente.');
 const who=(norm(client.surname)+' '+norm(client.name)).trim()||'Cliente',issueDate=new Date().toISOString().slice(0,10),header='Pagamento cassa Optyker · '+stageLabel(stage);
 const payload={source:'optyker_pos_local',channel:'physical_invoice',shopify_order_created:false,pos_sale_id:sale.id,lines:sale?.data?.lines||[],pricing:sale?.data?.pricing||null,payment_amount:money(amount),sale_total:money(sale.total),remaining_before_payment:money(sale.due_amount),pos_payment_id:payment?.id||null,payment_stage:stage,payment_method:method,operator,customer:{id:client.id,name:who,email:norm(client.email),pec:norm(client.pec),vat,fiscal_code:fiscal,address:{street:norm(client.street),street_number:norm(client.street_number),postal_code:norm(client.postal_code),city:norm(client.city),province:norm(client.province)}}};
 const {data,error}=await db.from('optyker_billing_invoices').insert({client_id:client.id,direction:'outgoing',invoice_number:'',issue_date:issueDate,counterparty_name:who,counterparty_vat:vat,counterparty_fiscal_code:fiscal,header,supplier_type:'cliente',total:money(amount),currency:'EUR',sdi_status:'draft',provider_status:'pending_fic_review',provider_payload:payload}).select('*').single();if(error)throw error;
 if(payment?.id)await db.from('optyker_pos_payments').update({billing_invoice_id:data.id}).eq('id',payment.id);
 await db.from('optyker_pos_sales').update({billing_invoice_id:data.id,invoice_requested:true,updated_at:new Date().toISOString()}).eq('id',sale.id);return data;
}
async function checkout(body:any,operator:string){
 const p=body?.payload||{},requestId=norm(p.request_id);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new Error('Riferimento univoco incasso richiesto');
 const old=await previous(body,requestId);if(old)return old;
 const q=await quote(body),choices=Array.isArray(p.lines)?p.lines:[],base=Array.isArray(q.lines)?q.lines:[];if(!base.length)throw new Error('Il carrello è vuoto');
 const priced=priceLines(base,choices),pricing=priceSummary(q,priced),total=pricing.total;
 if(p.expected_total!=null&&Math.abs(money(p.expected_total)-total)>0.01)throw new Error('Il totale del carrello è cambiato: ricarica i prodotti prima di incassare.');
 const client=await clientById(norm(p.client_id));if(p.client_id&&!client)throw new Error('Cliente non trovato');
 let stage=['deposit','balance','delivery_balance'].includes(norm(p.payment_stage))?norm(p.payment_stage):'balance';
 let method=['cash','card','mixed','bank','other','pending'].includes(norm(p.payment_method))?norm(p.payment_method):'card';
 const invoiceRequested=!!p.invoice_requested,ts=!!p.ts_requested,stockOnly=total===0,tsCode=norm(p.ts_expense_code)==='AA'?'AA':'AD',opposition=!!p.ts_opposition;
 let autoReceipt=p.auto_receipt===true&&total>0;if(stockOnly){stage='balance';method='other';autoReceipt=false}
 if(invoiceRequested&&!client)throw new Error('Per creare la fattura seleziona un cliente.');
 if(stockOnly&&invoiceRequested)throw new Error('Uno scarico magazzino a 0,00 € non genera fattura.');
 if(stockOnly&&ts)throw new Error('Uno scarico magazzino a 0,00 € non genera una spesa Sistema TS.');
 if(ts&&invoiceRequested)throw new Error('Per una spesa Sistema TS non usare la fattura elettronica.');
 if(autoReceipt&&invoiceRequested)throw new Error('La fattura elettronica e lo scontrino RCH sono flussi separati.');
 if(autoReceipt&&!['cash','card','mixed'].includes(method))throw new Error('Per lo scontrino RCH seleziona Contanti o Carta.');
 let paidNow=0;if(!stockOnly&&method!=='pending'){if(stage==='deposit'){paidNow=money(p.deposit_amount);if(!(paidNow>0&&paidNow<total))throw new Error("L'acconto deve essere maggiore di 0 e inferiore al totale.")}else paidNow=total}
 if(method==='mixed'&&(!autoReceipt||invoiceRequested||ts))throw new Error('Il pagamento misto richiede uno scontrino RCH senza fattura né invio TS.');
 if(method!=='mixed'&&p.payment_breakdown!=null)throw new Error('Ripartizione ammessa solo per Contanti + carta.');
 const breakdown=method==='mixed'?mixedBreakdown(p.payment_breakdown,paidNow):null;
 if(invoiceRequested&&paidNow<=0)throw new Error('Non è possibile fatturare un pagamento di 0,00 €.');if(ts&&paidNow<=0)throw new Error('Per preparare il Sistema TS deve esserci un pagamento.');
 const due=stockOnly?0:money(Math.max(0,total-paidNow)),paymentStatus=stockOnly?'paid':due>0?(paidNow>0?'partially_paid':'pending'):'paid',identity=stockOnly?null:purchaseIdentity(client,p.fiscal_code,ts);
 let lines:any[]=priced,snapshot:any=null;if(autoReceipt){lines=fiscalLines(priced,choices);snapshot=paymentDocument(lines,method==='mixed'?'card':method,paidNow,0,identity,{ts,code:tsCode,opposition});if(breakdown)snapshot.input.payment_breakdown=breakdown}
 const requestHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(p))))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const channel=stockOnly?'physical_stock_only':autoReceipt?'physical_rch_receipt':invoiceRequested?'physical_invoice':'physical_pos_pending';
 const salePayload:any={client_id:client?.id||null,operator_username:operator,payment_stage:stage,payment_method:method,payment_status:paymentStatus,status:due>0?'open_balance':'completed',subtotal:total,discount_total:money(q.discount_total),total,paid_amount:paidNow,due_amount:due,currency:'EUR',shopify_draft_order_id:null,shopify_order_id:null,shopify_order_name:null,note:norm(p.note).slice(0,1000),invoice_requested:invoiceRequested,completed_at:due>0?null:new Date().toISOString(),delivered_at:stage==='delivery_balance'&&due===0?new Date().toISOString():null,data:{source:'optyker_pos_local',channel,shopify_order_created:false,stock_only:stockOnly,checkout_request_id:requestId,checkout_request_hash:requestHash,client_cart_selection:true,pricing,client_snapshot:client||null,fiscal_identity:identity,lines,payment_stage:stage,paid_now:paidNow,due_amount:due,...(breakdown?{payment_breakdown:breakdown}:{})}};
 const {data:sale,error:se}=await db.from('optyker_pos_sales').insert(salePayload).select('*').single();if(se)throw se;
 let inventoryDone=false,saleDone=false;
 try{
   const items=lines.map((x:any)=>({sale_id:sale.id,shopify_product_id:x.product_id||null,shopify_variant_id:x.catalog_id?'':(x.shopify_variant_id||x.variant_id||''),title:String(x.title||'Prodotto'),variant_title:String(x.variant_title||''),sku:String(x.sku||''),barcode:String(x.barcode||''),quantity:Number(x.quantity||1),unit_price:money(x.price),total:money(x.total??Number(x.price||0)*Number(x.quantity||1)),data:{image:x.image||'',vendor:x.vendor||'',product_type:x.product_type||'',catalog_id:x.catalog_id||null,inventory_item_id:x.inventory_item_id||null,fiscal_department:x.fiscal_department||null,fiscal_vat_code:x.fiscal_vat_code||'',fiscal_item_type:x.fiscal_item_type||'',quoted_unit_price:money(x.quoted_unit_price??x.price),manual_price_override:x.manual_price_override===true,shopify_order_created:false}}));
   const {error:ie}=await db.from('optyker_pos_sale_items').insert(items);if(ie)throw ie;
   let payment:any=null;if(paidNow>0){const {data,error:pe}=await db.from('optyker_pos_payments').insert({sale_id:sale.id,client_id:client?.id||null,operator_username:operator,payment_stage:stage,payment_method:method,amount:paidNow,currency:'EUR',invoice_requested:invoiceRequested,note:norm(p.note).slice(0,1000),data:{source:'optyker_pos_local',channel,shopify_order_id:'',shopify_order_name:'',shopify_order_created:false,fiscal_snapshot:snapshot,...(breakdown?{payment_breakdown:breakdown}:{})}}).select('*').single();if(pe)throw pe;payment=data}
   const inventory=await applyInventory(body,sale,lines,operator);inventoryDone=true;
   let invoice:any=null,invoiceWarning='';if(invoiceRequested&&payment){try{invoice=await invoiceDraft(sale,payment,client,operator,stage,method,paidNow)}catch(e){invoiceWarning=e instanceof Error?e.message:String(e)}}
   saleDone=true;const client_cart=await completeCart(sale,operator);
   return {...sale,client_cart,payment,billing_invoice:invoice,invoice_warning:invoiceWarning,shopify_order_created:false,stock_only:stockOnly,inventory_adjusted:inventory.count,inventory_warning:inventory.warnings.join(' · ')};
 }catch(e){if(saleDone)throw e;if(!inventoryDone)await db.from('optyker_pos_sales').delete().eq('id',sale.id);else await db.from('optyker_pos_sales').update({status:'error',updated_at:new Date().toISOString()}).eq('id',sale.id);throw e}
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);try{const body=await req.json().catch(()=>({})),operator=await auth(body);if(norm(body.action)!=='checkout')return out({ok:false,error:'Azione non riconosciuta'},400);return out({ok:true,data:await checkout(body,operator)})}catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali/.test(m)?401:400)}});
