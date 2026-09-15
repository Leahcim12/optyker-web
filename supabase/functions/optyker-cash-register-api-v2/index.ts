import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {auth,cleanLottery,CORS,missingStock,norm,out,productsV2,proxy,RELEASE} from './base.ts';
import {checkoutStatusV2,createOrderRequest,customCheckout,deliveries,markDelivery,postZeroSale} from './actions.ts';
import {clearClientCart,getClientCart,hasClientCartLine,saveClientCart} from './cart.ts';
import {clientCartCheckout} from './cart-checkout.ts';

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
  const body=await req.json().catch(()=>({})),action=norm(body.action),p=body.payload||{};
  if(action==="products")return out({ok:true,...await productsV2(body)});
  if(action==="checkout_status"){await auth(body);return out({ok:true,data:await checkoutStatusV2(body),release:RELEASE})}
  if(action==="client_cart_get"){await auth(body);return out({ok:true,data:await getClientCart(body),release:RELEASE})}
  if(action==="client_cart_save"){const op=await auth(body);return out({ok:true,data:await saveClientCart(body,op),release:RELEASE})}
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
   if(p.client_id)await clearClientCart(p.client_id,op);
   return out({ok:true,data:sale,release:RELEASE});
  }
  return out({...await proxy(body),release:RELEASE});
 }catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},m==="AUTH_REQUIRED"?401:400)}
});
