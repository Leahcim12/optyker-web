import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {auth,cleanLottery,db,CORS,missingStock,norm,out,productsV2,proxy,RELEASE} from './base.ts';
import {checkoutStatusV2,createOrderRequest,customCheckout,deliveries,markDelivery,postZeroSale} from './actions.ts';
import {clearClientCart,completeClientCart,getClientCart,hasClientCartLine,quoteClientCartLines,saveClientCart} from './cart.ts';
import {clientCartCheckout} from './cart-checkout.ts';

function money(v:any){const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0}
function isClientCartId(v:any){return norm(v).startsWith('client_cart:')}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
  const body=await req.json().catch(()=>({})),action=norm(body.action),p=body.payload||{};
  if(action==="products")return out({ok:true,...await productsV2(body)});
  if(action==="quote_lines"){
   await auth(body);
   const lines=Array.isArray(p.lines)?p.lines:[];
   const locked=lines.filter((x:any)=>isClientCartId(x?.variant_id));
   const normal=lines.filter((x:any)=>!isClientCartId(x?.variant_id));
   const base=await proxy({...body,payload:{...p,lines:normal}}),baseData=base.data||{};
   const lockedQuoted=locked.length?await quoteClientCartLines(p.client_id,locked):[];
   const normalQuoted=Array.isArray(baseData.lines)?baseData.lines:[];
   const byId=new Map([...normalQuoted,...lockedQuoted].map((x:any)=>[String(x.variant_id||x.catalog_id||''),x]));
   const ordered=lines.map((x:any)=>{
    const id=String(x?.variant_id||'');
    return byId.get(id)||byId.get(String(x?.catalog_id||''));
   }).filter(Boolean);
   if(ordered.length!==lines.length)throw new Error('Un articolo del carrello non è più disponibile. Ricarica la Cassa.');
   const listTotal=money(ordered.reduce((s:number,x:any)=>s+Number((x.list_price??x.price)||0)*Number(x.quantity||1),0));
   const total=money(ordered.reduce((s:number,x:any)=>s+Number(x.price||0)*Number(x.quantity||1),0));
   return out({ok:true,data:{...baseData,lines:ordered,list_total:listTotal,discount_total:money(listTotal-total),total},release:RELEASE});
  }
  if(action==="checkout_status"){await auth(body);return out({ok:true,data:await checkoutStatusV2(body),release:RELEASE})}
  if(action==="client_cart_get"){await auth(body);return out({ok:true,data:await getClientCart(body),release:RELEASE})}
  if(action==="client_cart_save"){const op=await auth(body);return out({ok:true,data:await saveClientCart(body,op),release:RELEASE})}
  if(action==='cancel_order_sheet'){
   const op=await auth(body);if(p.confirm!==true)throw new Error('Conferma esplicita richiesta');
   let sheetId=norm(p.sheet_id),expected=p.expected_updated_at;
   if(p.work_order_id){
    if(sheetId)throw new Error('Seleziona una sola scheda');
    const {data:w,error}=await db.from('optyker_work_orders').select('id,source_sheet_id,status').eq('id',p.work_order_id).eq('client_id',p.client_id).maybeSingle();if(error)throw error;
    if(!w?.source_sheet_id)throw new Error('Scheda collegata all’ordine non disponibile');
    if(w.status!=='annullato'){
     const cart=await getClientCart(body);
     if(String(cart.updated_at||'')!==String(p.expected_cart_updated_at||''))throw new Error('Il carrello è cambiato: riapri la Cassa prima di annullare');
     if(!cart.items.some((x:any)=>x.variant_id==='client_cart:'+w.id))throw new Error('Ordine non presente in questo carrello');
    }
    sheetId=w.source_sheet_id;
    const {data:s,error:se}=await db.from('optyker_sheets').select('updated_at').eq('id',sheetId).eq('client_id',p.client_id).single();if(se)throw se;expected=s.updated_at;
   }
   const {data,error}=await db.rpc('optyker_cancel_order_sheet',{p_client_id:p.client_id,p_sheet_id:sheetId,p_expected_updated_at:expected,p_operator:op,p_confirm:true});if(error)throw error;
   return out({ok:true,data:{...data,client_cart:await getClientCart(body)},release:RELEASE});
  }
  if(action==="client_cart_clear"){const op=await auth(body);return out({ok:true,data:await clearClientCart(p.client_id,op),release:RELEASE})}
  if(action==="order_missing_items"){const op=await auth(body);return out({ok:true,data:await createOrderRequest(body,op),release:RELEASE})}
  if(action==="deliveries"){await auth(body);return out({ok:true,data:await deliveries(),release:RELEASE})}
  if(action==="mark_delivery"){const op=await auth(body);return out({ok:true,data:await markDelivery(body,op),release:RELEASE})}
  if(action==="checkout"){
   const op=await auth(body),lines=Array.isArray(p.lines)?p.lines:[],missing=await missingStock(lines),lottery=cleanLottery(p.lottery_code),persistent=hasClientCartLine(lines);
   let sale:any;
   if(persistent)sale=await clientCartCheckout(body,op,missing);
   else if(missing.length||lottery)sale=await customCheckout(body,op,missing);
   else {const x=await proxy(body);sale=await postZeroSale(body,x.data)}
   if(!sale.recovered&&!sale.data?.client_cart_selection){
    const {error}=await db.from('optyker_pos_sales').update({data:{...(sale.data||{}),client_cart_selection:true}}).eq('id',sale.id);if(error)throw error;
   }
   sale.client_cart=await completeClientCart(sale.id,op);
   return out({ok:true,data:sale,release:RELEASE});
  }
  return out({...await proxy(body),release:RELEASE});
 }catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},m==="AUTH_REQUIRED"?401:400)}
});
