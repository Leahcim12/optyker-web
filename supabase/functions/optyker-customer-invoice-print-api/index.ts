import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Cache-Control":"no-store"
};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const norm=(v:any)=>String(v??"").trim();
const money=(v:any)=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function auth(body:any){
  const username=norm(body?.username),password=String(body?.password||"");
  if(!username||password.length<8)throw new Error("AUTH_REQUIRED");
  const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:username,p_password:password});
  if(error||!data?.ok)throw new Error(data?.error||"Credenziali non valide");
  return String(data.username||username);
}
function object(v:any){return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}
function arr(v:any){return Array.isArray(v)?v:[]}
function first(...values:any[]){for(const v of values){const x=norm(v);if(x)return x}return ""}
function safeLines(payload:any,total:number,header:string){
  const p=object(payload);
  const raw=arr(p.lines).length?arr(p.lines):arr(p.items_list).length?arr(p.items_list):arr(p.items);
  const rows=raw.map((x:any)=>{
    const r=object(x),qty=Math.max(0,Number(r.quantity??r.qty??1)||0),unit=money(r.price??r.unit_price??r.net_price??r.unit_net_price??0),lineTotal=money(r.total??r.gross_price??r.net_price_total??unit*qty);
    return {description:first(r.title,r.description,r.name,header,"Articolo"),variant:first(r.variant_title,r.subtitle),sku:first(r.sku,r.code),quantity:qty||1,unit_price:unit,total:lineTotal,vat_code:first(r.fiscal_vat_code,r.vat_code,r.vat?.value,r.vat?.description),discount_percent:Math.max(0,Number(r.discount_percent||0)||0)};
  }).filter((x:any)=>x.description);
  if(rows.length)return rows;
  return [{description:header||"Fattura",variant:"",sku:"",quantity:1,unit_price:money(total),total:money(total),vat_code:"",discount_percent:0}];
}
function customerFrom(row:any,payload:any){
  const p=object(payload),c=object(p.customer),snap=object(p.client_snapshot),entity=object(p.entity),address=object(c.address),snapAddress=object(snap.address);
  return {name:first(c.name,entity.name,row.counterparty_name),vat:first(c.vat,c.vat_number,entity.vat_number,row.counterparty_vat),fiscal_code:first(c.fiscal_code,c.tax_code,entity.tax_code,row.counterparty_fiscal_code),email:first(c.email,snap.email,entity.email),pec:first(c.pec,snap.pec),address:{street:first(address.street,snapAddress.street,entity.address_street,entity.address),street_number:first(address.street_number,snapAddress.street_number),postal_code:first(address.postal_code,snapAddress.postal_code,entity.address_postal_code),city:first(address.city,snapAddress.city,entity.address_city),province:first(address.province,snapAddress.province,entity.address_province),country:first(address.country,snapAddress.country,entity.country)}};
}
async function loadRow(id:string){
  if(!UUID.test(id))throw new Error("Fattura non selezionata");
  const {data,error}=await db.from("optyker_billing_invoices").select("id,client_id,direction,invoice_number,issue_date,counterparty_name,counterparty_vat,counterparty_fiscal_code,header,total,currency,supplier_type,sdi_status,sdi_protocol,provider_status,provider_invoice_id,provider_payload,created_at,updated_at").eq("id",id).eq("direction","outgoing").maybeSingle();
  if(error)throw error;if(!data)throw new Error("Fattura cliente non trovata");if(String(data.supplier_type||"").toLowerCase()!=="cliente")throw new Error("Questa non è una fattura cliente");return data;
}
async function paymentLock(row:any,p:any){
  const paymentId=norm(p.pos_payment_id);if(!UUID.test(paymentId))return {linked:false,total:null};
  const {data,error}=await db.from("optyker_pos_payments").select("id,amount").eq("id",paymentId).maybeSingle();if(error)throw error;if(!data)return {linked:false,total:null};return {linked:true,total:money(data.amount)};
}
async function invoicePrint(payload:any){
  const row=await loadRow(norm(payload?.id)),p=object(row.provider_payload),total=money(row.total),header=norm(row.header)||"Fattura",lock=await paymentLock(row,p);
  return {id:row.id,number:norm(row.invoice_number),issue_date:row.issue_date||row.created_at||null,header,total,currency:norm(row.currency)||"EUR",sdi_status:norm(row.sdi_status)||"not_applicable",sdi_protocol:norm(row.sdi_protocol),provider_status:norm(row.provider_status),is_draft:!norm(row.invoice_number),no_sdi:true,editable:!row.provider_invoice_id&&!norm(row.sdi_protocol),linked_payment:lock.linked,locked_total:lock.total,notes:norm(p.invoice_notes??p.notes),customer:customerFrom(row,p),lines:safeLines(p,total,header),seller:{brand:"OTTICA VISUAL CARE",legal_name:"MOLOGNI COMPANY S.R.L.",vat:"04679780165"}};
}
function normalizeLines(v:any){
  const raw=arr(v);if(!raw.length||raw.length>40)throw new Error("Inserisci da 1 a 40 righe");const allowed=new Set(["","4","04","5","05","10","22","ART10"]);
  return raw.map((x:any,i:number)=>{const r=object(x),description=norm(r.description??r.title??r.name).slice(0,500);if(!description)throw new Error(`Descrizione obbligatoria alla riga ${i+1}`);const qty=Number(r.quantity??r.qty??1),unit=Number(r.unit_price??r.price??0);if(!Number.isFinite(qty)||qty<=0||qty>10000)throw new Error(`Quantità non valida alla riga ${i+1}`);if(!Number.isFinite(unit)||unit<0||unit>1000000)throw new Error(`Prezzo non valido alla riga ${i+1}`);let vat=norm(r.vat_code).toUpperCase();if(vat==="4")vat="04";if(vat==="5")vat="05";if(!allowed.has(vat))throw new Error(`IVA non valida alla riga ${i+1}`);const q=Math.round(qty*1000)/1000,u=money(unit),t=money(q*u);return {description,quantity:q,unit_price:u,price:u,total:t,vat_code:vat,fiscal_vat_code:vat,manual_invoice_line:true};});
}
async function invoiceUpdate(payload:any,operator:string){
  const row=await loadRow(norm(payload?.id));if(row.provider_invoice_id||norm(row.sdi_protocol))throw new Error("Documento già collegato a un sistema elettronico: modifica bloccata");
  const p=object(row.provider_payload),lines=normalizeLines(payload?.lines),notes=norm(payload?.notes).slice(0,2000),total=money(lines.reduce((s:number,x:any)=>s+x.total,0)),lock=await paymentLock(row,p);if(total<=0)throw new Error("Il totale della fattura deve essere maggiore di 0");if(lock.linked&&Math.abs(total-money(lock.total))>0.01)throw new Error(`La fattura è collegata a un pagamento di ${money(lock.total).toFixed(2)} €. Il totale delle righe deve restare uguale.`);
  const next={...p,lines,invoice_notes:notes,manual_invoice_lines:true,invoice_lines_updated_at:new Date().toISOString(),invoice_lines_updated_by:operator,document_scope:"customer_no_sdi"};
  const {error}=await db.from("optyker_billing_invoices").update({total,supplier_type:"cliente",sdi_status:"not_applicable",provider_status:"customer_invoice_internal",provider_payload:next,updated_at:new Date().toISOString()}).eq("id",row.id);if(error)throw error;return invoicePrint({id:row.id});
}
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);try{const body=await req.json().catch(()=>({})),operator=await auth(body),action=norm(body.action);if(action==="invoice_print")return out({ok:true,data:await invoicePrint(body.payload||{})});if(action==="invoice_update")return out({ok:true,data:await invoiceUpdate(body.payload||{},operator)});return out({ok:false,error:"Azione non riconosciuta"},400)}catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali|Troppi tentativi/.test(m)?401:400)}});
