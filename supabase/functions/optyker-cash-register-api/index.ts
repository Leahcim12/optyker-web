import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { listHistory, receiptDetail, setHistoryVisibility } from './history.ts';
import { lensProduct, listLensProducts, isLensCatalogId, cashDraftLine, pricingTotals, assertLensTotal, discountBrands, LENS_CATALOG_VERSION } from './lens-pricing.mjs';

import { ovcContext, serviceProduct, serviceForId, serviceSearch, isServiceId, serviceDraftLine, assertOvcTotal, OVC_VERSION } from './ovc.mjs';

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const SHOP=(Deno.env.get("SHOPIFY_STORE_DOMAIN")||"vkk3n8-d0.myshopify.com").trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
const CID=(Deno.env.get("SHOPIFY_CLIENT_ID")||"").trim();
const CSECRET=(Deno.env.get("SHOPIFY_CLIENT_SECRET")||"").trim();
const VER="2026-07";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
let shopToken="",shopUntil=0;

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type, authorization",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Cache-Control":"no-store"
};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});

function norm(v:any){return String(v??"").trim()}
function money(v:any){const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0}
function gid(kind:string,v:any){
  const s=norm(v);if(!s)return "";
  if(s.startsWith("gid://"))return s;
  const m=s.match(/(\d+)$/);return m?("gid://shopify/"+kind+"/"+m[1]):s;
}
async function auth(body:any){
  const username=norm(body?.username);
  const password=String(body?.password||"");
  if(!username||password.length<8)throw new Error("AUTH_REQUIRED");
  const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:username,p_password:password});
  if(error||!data?.ok)throw new Error(data?.error||"Credenziali non valide");
  return String(data.username||username);
}
async function getToken(force=false){
  if(!force&&shopToken&&Date.now()<shopUntil-300000)return shopToken;
  if(!CID||!CSECRET)throw new Error("Shopify non configurato");
  const r=await fetch("https://"+SHOP+"/admin/oauth/access_token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"client_credentials",client_id:CID,client_secret:CSECRET})
  });
  const x=await r.json().catch(()=>({}));
  if(!r.ok||!x?.access_token)throw new Error(x?.error_description||x?.error||"Accesso Shopify non disponibile");
  shopToken=String(x.access_token);
  shopUntil=Date.now()+Math.max(60,Number(x.expires_in||86399))*1000;
  return shopToken;
}
async function gql(query:string,variables:any){
  let token=await getToken(false);
  let r=await fetch("https://"+SHOP+"/admin/api/"+VER+"/graphql.json",{
    method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token},
    body:JSON.stringify({query,variables})
  });
  if(r.status===401){
    token=await getToken(true);
    r=await fetch("https://"+SHOP+"/admin/api/"+VER+"/graphql.json",{
      method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token},
      body:JSON.stringify({query,variables})
    });
  }
  const x=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(x?.errors?.[0]?.message||("Shopify "+r.status));
  if(Array.isArray(x?.errors)&&x.errors.length)throw new Error(x.errors[0]?.message||"Errore Shopify");
  return x?.data||{};
}
function img(p:any){
  return String(p?.featuredMedia?.preview?.image?.url||p?.featuredImage?.url||"");
}
async function products(search:string,first:number,clientId:string){
  const context=await ovcContext(db,clientId);
  const q=[
    "query CashProducts($first:Int!,$query:String){",
    "products(first:$first,query:$query,sortKey:TITLE){",
    "nodes{",
    "id title handle vendor productType status",
    "featuredMedia{preview{image{url altText}}}",
    "variants(first:50){nodes{id title sku barcode price availableForSale inventoryQuantity}}",
    "}",
    "}",
    "}"
  ].join("\n");
  const clean=norm(search).replace(/[()"]/g," ").slice(0,100);
  const data=await gql(q,{first:Math.max(1,Math.min(100,first||60)),query:clean||null});
  const rows=Array.isArray(data?.products?.nodes)?data.products.nodes:[];
  const outRows:any[]=[];
  for(const p of rows){
    if(String(p?.status||"").toUpperCase()==="ARCHIVED")continue;
    const vars=Array.isArray(p?.variants?.nodes)?p.variants.nodes:[];
    for(const v of vars){
      if(v?.availableForSale===false)continue;
      outRows.push({
        product_id:String(p?.id||""),
        variant_id:String(v?.id||""),
        title:String(p?.title||"Prodotto"),
        variant_title:String(v?.title||""),
        vendor:String(p?.vendor||""),
        product_type:String(p?.productType||""),
        handle:String(p?.handle||""),
        image:img(p),
        sku:String(v?.sku||""),
        barcode:String(v?.barcode||""),
        price:money(v?.price),
        inventory_quantity:v?.inventoryQuantity==null?null:Number(v.inventoryQuantity),
        available:true
      });
    }
  }
  return [...serviceSearch(context,search),...listLensProducts(search),...outRows.filter(x=>!serviceForId(x.variant_id,context))];
}
async function clients(search:string){
  let q=db.from("optyker_clients")
    .select("id,name,surname,email,phone,pec,fiscal,vat,street,street_number,postal_code,city,province,shopify_customer_id,reference_no")
    .order("surname",{ascending:true}).order("name",{ascending:true}).limit(300);
  const s=norm(search).replace(/[%_,()]/g," ").slice(0,80);
  if(s)q=q.or("name.ilike.%"+s+"%,surname.ilike.%"+s+"%,email.ilike.%"+s+"%,phone.ilike.%"+s+"%,reference_no.ilike.%"+s+"%,fiscal.ilike.%"+s+"%,vat.ilike.%"+s+"%");
  const {data,error}=await q;if(error)throw error;return data||[];
}
async function lookupVariants(ids:string[],context:any){
  const uniq=[...new Set(ids.filter(x=>!isLensCatalogId(x)&&!isServiceId(x)).map(x=>gid("ProductVariant",x)).filter(Boolean))].slice(0,100);
  const local=ids.map(id=>isServiceId(id)?serviceForId(id,context):lensProduct(id)).filter(Boolean);
  if(!uniq.length)return local;
  const q=[
    "query CashVariants($ids:[ID!]!){",
    "nodes(ids:$ids){",
    "... on ProductVariant{",
    "id title sku barcode price availableForSale",
    "product{id title handle vendor productType featuredMedia{preview{image{url altText}}}}",
    "}",
    "}",
    "}"
  ].join("\n");
  const data=await gql(q,{ids:uniq});
  return local.concat((Array.isArray(data?.nodes)?data.nodes:[]).filter(Boolean).map((v:any)=>({
    variant_id:String(v.id),title:String(v?.product?.title||"Prodotto"),variant_title:String(v?.title||""),
    sku:String(v?.sku||""),barcode:String(v?.barcode||""),price:money(v?.price),available:v?.availableForSale!==false,
    product_id:String(v?.product?.id||""),image:img(v?.product),vendor:String(v?.product?.vendor||""),product_type:String(v?.product?.productType||"")
  })));
}
async function saveSale(payload:any){
  const {data,error}=await db.from("optyker_pos_sales").insert(payload).select("*").single();
  if(error)throw error;return data;
}
async function patchSale(id:string,payload:any){
  const {data,error}=await db.from("optyker_pos_sales").update({...payload,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();
  if(error)throw error;return data;
}

function stageLabel(v:string){
  if(v==="deposit")return "Acconto";
  if(v==="delivery_balance")return "Saldo consegna";
  return "Saldo";
}
async function clientById(id:string){
  if(!id)return null;
  const {data,error}=await db.from("optyker_clients")
    .select("id,name,surname,email,phone,pec,fiscal,vat,street,street_number,postal_code,city,province,shopify_customer_id,reference_no")
    .eq("id",id).maybeSingle();
  if(error)throw error;
  return data||null;
}
async function createPayment(sale:any,client:any,operator:string,stage:string,method:string,amount:number,invoiceRequested:boolean,note:string){
  const {data,error}=await db.from("optyker_pos_payments").insert({
    sale_id:sale.id,
    client_id:client?.id||null,
    operator_username:operator,
    payment_stage:stage,
    payment_method:method,
    amount:money(amount),
    currency:"EUR",
    invoice_requested:!!invoiceRequested,
    note:note||"",
    data:{source:"optyker_pos",shopify_order_id:sale.shopify_order_id||"",shopify_order_name:sale.shopify_order_name||""}
  }).select("*").single();
  if(error)throw error;
  return data;
}

async function createTsDocument(sale:any,payment:any,client:any,operator:string,stage:string,method:string,amount:number,expenseCode:string,opposition:boolean){
  if(!client)throw new Error("Per la detrazione Sistema TS seleziona un cliente.");
  const fiscal=norm(client.fiscal).toUpperCase().replace(/\s+/g,"");
  if(!/^[A-Z0-9]{16}$/.test(fiscal))throw new Error("Per il Sistema TS serve un Codice Fiscale cliente valido di 16 caratteri.");
  const code=expenseCode==="AA"?"AA":"AD";
  const traceable=method!=="cash";
  if(code==="AA"&&!traceable)throw new Error("Le spese AA sono detraibili solo con pagamento tracciabile.");
  if(!(Number(amount)>0))throw new Error("Non è possibile preparare una spesa TS con importo 0,00 €.");

  const today=new Date().toISOString().slice(0,10);
  const status=opposition?"opposition_recorded":"awaiting_fiscal_document";
  const payload={
    source:"optyker_pos",
    provider:"not_configured",
    provider_connection:"not_configured",
    fiscal_code:fiscal,
    expense_code:code,
    operation_type:"I",
    payment_traceable:traceable,
    opposition:!!opposition,
    payment_stage:stage,
    payment_method:method,
    shopify_order_id:sale?.shopify_order_id||"",
    shopify_order_name:sale?.shopify_order_name||"",
    lines:Array.isArray(sale?.data?.lines)?sale.data.lines:[],
    note:"Dati salvati in Optyker. Invio TS non configurato; necessario verificare il documento fiscale, la classificazione della spesa e il collegamento diretto TS."
  };
  const {data,error}=await db.from("optyker_ts_documents").insert({
    sale_id:sale.id,
    payment_id:payment?.id||null,
    client_id:client.id,
    operator_username:operator,
    fiscal_code:fiscal,
    document_type:"commercial_document",
    document_number:"",
    document_date:today,
    payment_date:today,
    expense_code:code,
    amount:money(amount),
    payment_method:method,
    payment_traceable:traceable,
    opposition:!!opposition,
    operation_type:"I",
    status,
    provider:"not_configured",
    provider_payload:payload
  }).select("*").single();
  if(error)throw error;
  return data;
}
async function createInvoiceDraft(sale:any,payment:any,client:any,operator:string,stage:string,method:string,amount:number){
  if(!client)throw new Error("Per creare la fattura seleziona un cliente.");
  const vat=norm(client.vat),fiscal=norm(client.fiscal);
  if(!vat&&!fiscal)throw new Error("Per creare la fattura completa P.IVA o Codice Fiscale nella scheda cliente.");
  const who=(norm(client.surname)+" "+norm(client.name)).trim()||"Cliente";
  const issueDate=new Date().toISOString().slice(0,10);
  let header="Pagamento cassa Optyker · "+stageLabel(stage)+(sale.shopify_order_name?(" · "+sale.shopify_order_name):"");
  const discount=Number(sale?.data?.pricing?.discount_total||0);
  if(discount>0 && discountBrands(sale?.data?.lines||[]))header+=" · Sconto "+discountBrands(sale?.data?.lines||[])+" 15% già applicato (sconto complessivo vendita: "+money(discount).toFixed(2)+" EUR)";
  const payload={
    source:"optyker_pos",
    provider:"FOCUS FE · Bludata",
    provider_connection:"not_configured",
    pos_sale_id:sale.id,
    lines:Array.isArray(sale?.data?.lines)?sale.data.lines:[],
    pricing:sale?.data?.pricing||null,
    payment_amount:money(amount),
    sale_total:money(sale.total),
    remaining_before_payment:money(sale.due_amount),
    pos_payment_id:payment?.id||null,
    payment_stage:stage,
    payment_method:method,
    operator,
    customer:{
      id:client.id,
      name:who,
      email:norm(client.email),
      pec:norm(client.pec),
      vat,
      fiscal_code:fiscal,
      address:{
        street:norm(client.street),
        street_number:norm(client.street_number),
        postal_code:norm(client.postal_code),
        city:norm(client.city),
        province:norm(client.province)
      }
    }
  };
  const {data,error}=await db.from("optyker_billing_invoices").insert({
    client_id:client.id,
    direction:"outgoing",
    invoice_number:"",
    issue_date:issueDate,
    counterparty_name:who,
    counterparty_vat:vat,
    counterparty_fiscal_code:fiscal,
    header,
    supplier_type:"cliente",
    total:money(amount),
    currency:"EUR",
    sdi_status:"draft",
    provider_status:"pending_focus_fe",
    provider_payload:payload
  }).select("*").single();
  if(error)throw error;
  if(payment?.id){
    await db.from("optyker_pos_payments").update({billing_invoice_id:data.id}).eq("id",payment.id);
  }
  await db.from("optyker_pos_sales").update({billing_invoice_id:data.id,invoice_requested:true,updated_at:new Date().toISOString()}).eq("id",sale.id);
  return data;
}
async function markOrderPaid(orderId:string){
  if(!orderId)return null;
  try{
    const q=[
      "mutation MarkCashOrderPaid($input:OrderMarkAsPaidInput!){",
      "orderMarkAsPaid(input:$input){",
      "order{id name displayFinancialStatus}",
      "userErrors{field message}",
      "}",
      "}"
    ].join("\n");
    const x=await gql(q,{input:{id:orderId}});
    const errs=x?.orderMarkAsPaid?.userErrors||[];
    if(errs.length)return {ok:false,error:errs[0]?.message||"Shopify non aggiornato"};
    return {ok:true,data:x?.orderMarkAsPaid?.order||null};
  }catch(e){
    return {ok:false,error:e instanceof Error?e.message:String(e)};
  }
}
async function quoteLines(linesIn:any[],clientId:string){
  const context=await ovcContext(db,clientId);
  if(linesIn.length>100)throw new Error("Carrello non valido");
  const quantities=new Map<string,number>();
  for(const l of linesIn){
    const rawId=norm(l?.variant_id);
    const id=(isLensCatalogId(rawId)||isServiceId(rawId))?rawId:gid("ProductVariant",rawId);
    const qty=Number(l?.quantity);
    if(!id||!Number.isInteger(qty)||qty<1||qty>99||(quantities.get(id)||0)+qty>99)throw new Error("Articolo o quantità non valida");
    quantities.set(id,(quantities.get(id)||0)+qty);
  }
  const current=await lookupVariants([...quantities.keys()],context);
  const byId=new Map(current.map((x:any)=>[x.variant_id,x]));
  const lines:any[]=[];
  let subtotal=0;
  for(const [id,qty] of quantities){
    const raw:any=byId.get(id);
    const v:any=raw?.available===false?raw:(serviceForId(id,context)||raw);
    if(!v)throw new Error("Un articolo non è più disponibile");
    if(!v.available)throw new Error(v.title+" non è disponibile");
    const total=money(v.price*qty);subtotal=money(subtotal+total);
    lines.push({...v,quantity:qty,total,discount_total:money((v.discount_amount||0)*qty)});
  }

  return {lines,...pricingTotals(lines),catalog_version:LENS_CATALOG_VERSION,ovc_version:OVC_VERSION,card:context.card};
}

async function checkout(body:any,operator:string){
  const p=body?.payload||{};
  const linesIn=Array.isArray(p.lines)?p.lines:[];
  if(!linesIn.length)throw new Error("Il carrello è vuoto");
  if(linesIn.length>100)throw new Error("Troppi articoli nel carrello");

  const quoted=await quoteLines(linesIn,norm(p.client_id));
  const lines=quoted.lines,subtotal=quoted.total;
  if(p.expected_total!=null)assertLensTotal(lines,p.expected_total);
  assertOvcTotal(lines,p.expected_total);

  const clientId=norm(p.client_id);
  const client=clientId?await clientById(clientId):null;
  if(clientId&&!client)throw new Error("Cliente non trovato");

  const rawStage=norm(p.payment_stage);
  const paymentStage=["deposit","balance","delivery_balance"].includes(rawStage)?rawStage:"balance";
  const pm=norm(p.payment_method);
  const paymentMethod=["cash","card","bank","other","pending"].includes(pm)?pm:"card";
  const invoiceRequested=!!p.invoice_requested;
  const tsRequested=!!p.ts_requested;
  const tsExpenseCode=norm(p.ts_expense_code)==="AA"?"AA":"AD";
  const tsOpposition=!!p.ts_opposition;
  const note=norm(p.note).slice(0,1000);

  let paidNow=0;
  if(paymentMethod!=="pending"){
    if(paymentStage==="deposit"){
      paidNow=money(p.deposit_amount);
      if(!(paidNow>0&&paidNow<subtotal))throw new Error("L'acconto deve essere maggiore di 0 e inferiore al totale.");
    }else{
      paidNow=subtotal;
    }
  }
  const due=money(Math.max(0,subtotal-paidNow));
  const paymentStatus=due>0?(paidNow>0?"partially_paid":"pending"):"paid";
  if(invoiceRequested&&paidNow<=0)throw new Error("Non è possibile fatturare un pagamento di 0,00 €.");
  if(invoiceRequested&&!client)throw new Error("Per creare la fattura seleziona un cliente.");
  if(tsRequested&&invoiceRequested)throw new Error("Per una spesa Sistema TS non usare la fattura elettronica: il documento TS va gestito come documento commerciale o fattura cartacea.");
  if(tsRequested&&!client)throw new Error("Per la detrazione Sistema TS seleziona un cliente.");
  if(tsRequested&&paidNow<=0)throw new Error("Per preparare il Sistema TS deve esserci un pagamento.");

  let sale=await saveSale({
    client_id:client?.id||null,
    operator_username:operator,
    payment_stage:paymentStage,
    payment_method:paymentMethod,
    payment_status:paymentStatus,
    status:"pending",
    subtotal,total:subtotal,paid_amount:paidNow,due_amount:due,currency:"EUR",note,
    invoice_requested:invoiceRequested,
    delivered_at:paymentStage==="delivery_balance"&&due===0?new Date().toISOString():null,
    data:{source:"optyker_pos",pricing:pricingTotals(lines),client_snapshot:client||null,lines,payment_stage:paymentStage,paid_now:paidNow,due_amount:due}
  });

  try{
    const attrs:any[]=[
      {key:"Optyker operatore",value:operator},
      {key:"Metodo pagamento",value:paymentMethod},
      {key:"Tipo pagamento",value:stageLabel(paymentStage)},
      {key:"Pagato ora",value:paidNow.toFixed(2)+" EUR"},
      {key:"Da saldare",value:due.toFixed(2)+" EUR"},
      {key:"Optyker sale id",value:String(sale.id)}
    ];
    if(client?.id)attrs.push({key:"Optyker client id",value:String(client.id)});
    if(invoiceRequested)attrs.push({key:"Fattura richiesta",value:"SI"});
    if(tsRequested)attrs.push({key:"Sistema TS",value:tsOpposition?"OPPOSIZIONE":"SI"});
    if(tsRequested)attrs.push({key:"Codice spesa TS",value:tsExpenseCode});

    const tags=["Optyker POS","Vendita negozio",stageLabel(paymentStage)];
    if(invoiceRequested)tags.push("Fattura richiesta");
    if(tsRequested)tags.push("Sistema TS");

    const draftInput:any={
      lineItems:lines.map(x=>serviceDraftLine(x)||cashDraftLine(x)),
      note:note||("Vendita cassa Optyker · "+stageLabel(paymentStage)+" · Operatore: "+operator),
      tags,
      customAttributes:attrs
    };
    if(client?.shopify_customer_id)draftInput.customerId=gid("Customer",client.shopify_customer_id);

    const createQ=[
      "mutation CashDraftCreate($input:DraftOrderInput!){",
      "draftOrderCreate(input:$input){",
      "draftOrder{id name totalPriceSet{shopMoney{amount currencyCode}}}",
      "userErrors{field message}",
      "}",
      "}"
    ].join("\n");
    const created=await gql(createQ,{input:draftInput});
    const ce=created?.draftOrderCreate?.userErrors||[];
    if(ce.length)throw new Error(ce[0]?.message||"Impossibile creare la vendita");
    const draft=created?.draftOrderCreate?.draftOrder;
    if(!draft?.id)throw new Error("Ordine Shopify non creato");
    sale=await patchSale(sale.id,{shopify_draft_order_id:draft.id,status:"draft"});
    assertLensTotal(lines,draft.totalPriceSet?.shopMoney?.amount,draft.totalPriceSet?.shopMoney?.currencyCode);
    assertOvcTotal(lines,draft.totalPriceSet?.shopMoney?.amount,draft.totalPriceSet?.shopMoney?.currencyCode);

    const completeQ=[
      "mutation CashDraftComplete($id:ID!,$paymentPending:Boolean!){",
      "draftOrderComplete(id:$id,paymentPending:$paymentPending){",
      "draftOrder{id name status order{id name displayFinancialStatus totalPriceSet{shopMoney{amount currencyCode}}}}",
      "userErrors{field message}",
      "}",
      "}"
    ].join("\n");
    const completed=await gql(completeQ,{id:draft.id,paymentPending:due>0});
    const ee=completed?.draftOrderComplete?.userErrors||[];
    if(ee.length)throw new Error(ee[0]?.message||"Impossibile completare la vendita");
    const done=completed?.draftOrderComplete?.draftOrder;
    const order=done?.order;
    const finalTotal=money(order?.totalPriceSet?.shopMoney?.amount||subtotal);

    sale=await patchSale(sale.id,{
      status:due>0?"open_balance":(order?.id?"completed":"draft"),
      shopify_order_id:String(order?.id||""),
      shopify_order_name:String(order?.name||draft?.name||""),
      total:finalTotal,
      paid_amount:paidNow,
      due_amount:money(Math.max(0,finalTotal-paidNow)),
      completed_at:order?.id?new Date().toISOString():null,
      data:{source:"optyker_pos",pricing:pricingTotals(lines),client_snapshot:client||null,lines,shopify:{draft,order},payment_stage:paymentStage,paid_now:paidNow,due_amount:money(Math.max(0,finalTotal-paidNow))}
    });

    const {error:itemsErr}=await db.from("optyker_pos_sale_items").insert(lines.map(x=>({
      sale_id:sale.id,shopify_product_id:x.product_id,shopify_variant_id:x.is_service?(x.shopify_variant_id||""):x.catalog_id?"":x.variant_id,title:x.title,variant_title:x.variant_title,
      sku:x.sku,barcode:x.barcode,quantity:x.quantity,unit_price:x.price,total:x.total,data:{image:x.image,vendor:x.vendor,product_type:x.product_type,list_price:x.list_price??x.price,discount_percent:x.discount_percent||0,discount_amount:x.discount_amount||0,discount_total:x.discount_total||0,catalog_id:x.catalog_id||null,price_unit:x.price_unit||null,inventory_item_id:x.inventory_item_id||null,ovc_card_applied:x.ovc_card_applied||false,standard_price:x.standard_price??null,card_price:x.card_price??null,ovc_card_number:x.ovc_card_number??null,ovc_card_revision:x.ovc_card_revision??null,ovc_price_revision:x.ovc_price_revision??null}
    })));
    if(itemsErr)console.error(itemsErr.message);

    let payment:any=null,invoice:any=null,tsDocument:any=null;
    if(paidNow>0){
      payment=await createPayment(sale,client,operator,paymentStage,paymentMethod,paidNow,invoiceRequested,note);
      if(invoiceRequested)invoice=await createInvoiceDraft(sale,payment,client,operator,paymentStage,paymentMethod,paidNow);
      if(tsRequested)tsDocument=await createTsDocument(sale,payment,client,operator,paymentStage,paymentMethod,paidNow,tsExpenseCode,tsOpposition);
    }

    if(order?.id){
      const online={
        shopify_order_id:String(order.id),order_name:String(order.name||""),
        shopify_customer_id:String(client?.shopify_customer_id||""),client_id:client?.id||null,
        financial_status:due>0?(paidNow>0?"partially_paid":"pending"):"paid",
        fulfillment_status:"unfulfilled",management_status:"managed",total:finalTotal,currency:"EUR",
        order_date:new Date().toISOString(),
        data:{source:"optyker_pos",payment_method:paymentMethod,payment_stage:paymentStage,paid_amount:paidNow,due_amount:money(Math.max(0,finalTotal-paidNow)),operator,client_snapshot:client||null,lines,invoice_requested:invoiceRequested,billing_invoice_id:invoice?.id||null}
      };
      const {error:upErr}=await db.from("optyker_online_orders").upsert(online,{onConflict:"shopify_order_id"});
      if(upErr)console.error(upErr.message);
    }
    return {...sale,payment,billing_invoice:invoice,ts_document:tsDocument};
  }catch(e){
    await patchSale(sale.id,{status:"error",error_message:e instanceof Error?e.message:String(e)}).catch(()=>{});
    throw e;
  }
}
async function openDeposits(clientId:string){
  let q=db.from("optyker_pos_sales")
    .select("id,client_id,operator_username,payment_stage,payment_method,payment_status,status,total,paid_amount,due_amount,currency,shopify_order_id,shopify_order_name,note,created_at,invoice_requested")
    .gt("due_amount",0).neq("status","error")
    .order("created_at",{ascending:false}).limit(100);
  if(clientId)q=q.eq("client_id",clientId);
  const {data,error}=await q;if(error)throw error;
  const rows=data||[];
  const ids=[...new Set(rows.map((x:any)=>x.client_id).filter(Boolean))];
  let names=new Map<string,any>();
  if(ids.length){
    const {data:cs,error:ce}=await db.from("optyker_clients").select("id,name,surname,reference_no").in("id",ids);
    if(ce)throw ce;
    names=new Map((cs||[]).map((x:any)=>[String(x.id),x]));
  }
  return rows.map((x:any)=>({...x,client:names.get(String(x.client_id||""))||null}));
}
async function settleSale(body:any,operator:string){
  const p=body?.payload||{};
  const saleId=norm(p.sale_id);if(!saleId)throw new Error("Vendita non selezionata");
  const {data:sale,error}=await db.from("optyker_pos_sales").select("*").eq("id",saleId).maybeSingle();
  if(error)throw error;if(!sale)throw new Error("Vendita non trovata");
  const due=money(sale.due_amount);
  if(due<=0)throw new Error("Questa vendita risulta già saldata.");
  const client=sale.client_id?await clientById(String(sale.client_id)):null;
  const rawStage=norm(p.payment_stage);
  const stage=rawStage==="delivery_balance"?"delivery_balance":"balance";
  const pm=norm(p.payment_method);
  const method=["cash","card","bank","other"].includes(pm)?pm:"card";
  const invoiceRequested=!!p.invoice_requested;
  const tsRequested=!!p.ts_requested;
  const tsExpenseCode=norm(p.ts_expense_code)==="AA"?"AA":"AD";
  const tsOpposition=!!p.ts_opposition;
  if(invoiceRequested&&!client)throw new Error("Per creare la fattura seleziona una vendita associata a un cliente.");
  if(tsRequested&&invoiceRequested)throw new Error("Per una spesa Sistema TS non usare la fattura elettronica.");
  if(tsRequested&&!client)throw new Error("Per la detrazione Sistema TS serve una vendita associata a un cliente.");

  const payment=await createPayment(sale,client,operator,stage,method,due,invoiceRequested,norm(p.note).slice(0,1000));
  let invoice:any=null,tsDocument:any=null;
  if(invoiceRequested)invoice=await createInvoiceDraft(sale,payment,client,operator,stage,method,due);
  if(tsRequested)tsDocument=await createTsDocument(sale,payment,client,operator,stage,method,due,tsExpenseCode,tsOpposition);

  const paidTotal=money(Number(sale.paid_amount||0)+due);
  const patched=await patchSale(sale.id,{
    payment_stage:stage,
    payment_method:method,
    payment_status:"paid",
    status:"completed",
    paid_amount:paidTotal,
    due_amount:0,
    invoice_requested:!!(sale.invoice_requested||invoiceRequested),
    billing_invoice_id:invoice?.id||sale.billing_invoice_id||null,
    delivered_at:stage==="delivery_balance"?new Date().toISOString():sale.delivered_at||null,
    completed_at:new Date().toISOString()
  });

  const shopifyResult=await markOrderPaid(String(sale.shopify_order_id||""));
  if(sale.shopify_order_id){
    const {data:oo}=await db.from("optyker_online_orders").select("data").eq("shopify_order_id",sale.shopify_order_id).maybeSingle();
    const od=oo?.data&&typeof oo.data==="object"?oo.data:{};
    await db.from("optyker_online_orders").update({
      financial_status:"paid",
      data:{...od,payment_stage:stage,paid_amount:paidTotal,due_amount:0,last_payment_method:method,last_payment_at:new Date().toISOString(),billing_invoice_id:invoice?.id||od?.billing_invoice_id||null}
    }).eq("shopify_order_id",sale.shopify_order_id);
  }
  return {...patched,payment,billing_invoice:invoice,ts_document:tsDocument,shopify_payment_update:shopifyResult};
}
async function tsDocuments(clientId:string){
  let q=db.from("optyker_ts_documents")
    .select("id,sale_id,payment_id,client_id,fiscal_code,document_type,document_number,document_date,payment_date,expense_code,amount,payment_method,payment_traceable,opposition,operation_type,status,focus_progressive,ts_protocol,error_message,created_at")
    .order("created_at",{ascending:false}).limit(100);
  if(clientId)q=q.eq("client_id",clientId);
  const {data,error}=await q;if(error)throw error;return data||[];
}
async function recentSales(clientId:string){
  let q=db.from("optyker_pos_sales").select("id,client_id,operator_username,payment_stage,payment_method,payment_status,status,total,paid_amount,due_amount,currency,shopify_order_name,note,invoice_requested,billing_invoice_id,created_at,completed_at,error_message")
    .order("created_at",{ascending:false}).limit(30);
  if(clientId)q=q.eq("client_id",clientId);
  const {data,error}=await q;if(error)throw error;return data||[];
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const operator=await auth(body);
    const action=norm(body.action);
    const p=body?.payload||{};
    if(action==="products")return out({ok:true,data:await products(norm(p.search),Number(p.first||60),norm(p.client_id))});
    if(action==="quote_lines")return out({ok:true,data:await quoteLines(Array.isArray(p.lines)?p.lines:[],norm(p.client_id))});
    if(action==="clients")return out({ok:true,data:await clients(norm(p.search))});
    if(action==="checkout")return out({ok:true,data:await checkout(body,operator)});
    if(action==="settle")return out({ok:true,data:await settleSale(body,operator)});
    if(action==="open_deposits")return out({ok:true,data:await openDeposits(norm(p.client_id))});
    if(action==="recent_sales")return out({ok:true,...await listHistory(db,p)});
    if(action==="receipt_detail")return out({ok:true,data:await receiptDetail(db,p)});
    if(action==="history_visibility")return out({ok:true,data:await setHistoryVisibility(db,p,operator)});
    if(action==="ts_documents")return out({ok:true,data:await tsDocuments(norm(p.client_id))});
    return out({ok:false,error:"Azione non riconosciuta"},400);
  }catch(e){
    const m=e instanceof Error?e.message:String(e);
    return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali|Troppi tentativi/.test(m)?401:400);
  }
});
