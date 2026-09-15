import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {normalizeOrderParameters} from '../../../eyewear-order-parameters.mjs';

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const norm=(v:any)=>String(v??"").trim();
const money=(v:any)=>{const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0};
const low=(v:any)=>norm(v).toLocaleLowerCase("it-IT");

async function auth(body:any){
  const username=norm(body?.username),password=String(body?.password||"");
  if(!username||password.length<8)throw new Error("AUTH_REQUIRED");
  const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:username,p_password:password});
  if(error||!data?.ok)throw new Error(data?.error||"Credenziali non valide");
  return String(data.username||username);
}
function isClientLens(t:string){return low(t)==="del cliente"}
function isPrescription(t:string){const x=low(t);return !!x&&x!=="del cliente"&&!/neutra|sole/.test(x)}
function isProgressiveOrSupport(t:string){return /progressiv|supporto\s+accomod/.test(low(t))}
function isMonofocal(t:string){return /monofocal/.test(low(t))}
const ALLOWED_TREATMENTS=new Set(["Indurente","Antiriflesso","Antiriflesso premium","Filtro luce blu","UV","Polarizzato","Precal","Personalizzazione"]);

function extras(types:string[],treatments:string[],mounting:string){
  const sold=types.filter(t=>norm(t)&&!isClientLens(t));
  const rx=sold.filter(isPrescription);
  const lines:any[]=[];let treatmentTotal=0;
  for(const tr of treatments){
    let amount=0,unit=0,count=0,free=false;
    if(tr==="Indurente"){unit=10;count=sold.length;amount=unit*count}
    else if(tr==="Antiriflesso"){unit=15;count=sold.length;amount=unit*count}
    else if(tr==="Filtro luce blu"){unit=25;count=sold.length;amount=unit*count}
    else if(tr==="UV"){unit=5;count=sold.length;amount=unit*count}
    else if(tr==="Precal"){unit=25;count=sold.length;amount=unit*count}
    else if(tr==="Personalizzazione"){unit=0;count=sold.length;amount=0;free=true}
    else if(tr==="Polarizzato"){if(!rx.length)throw new Error("Polarizzato è disponibile solo sulle lenti di ricetta.");unit=20;count=rx.length;amount=unit*count}
    else if(tr==="Antiriflesso premium"){if(!rx.length)throw new Error("Antiriflesso premium è disponibile solo sulle lenti di ricetta.");amount=rx.reduce((sum,t)=>sum+(isProgressiveOrSupport(t)?25:20),0);count=rx.length}
    amount=money(amount);treatmentTotal=money(treatmentTotal+amount);lines.push({name:tr,unit_price:tr==="Antiriflesso premium"?null:unit,quantity:count,total:amount,free});
  }
  const m=low(mounting);let mountingPrice=0,mountingLabel="";
  if(m==="special"||m==="montaggio speciale"){mountingPrice=25;mountingLabel="Montaggio speciale"}
  else if(m==="traditional"||m==="montaggio tradizionale"){mountingPrice=types.some(isProgressiveOrSupport)?25:15;mountingLabel="Montaggio tradizionale"}
  return {sold_quantity:sold.length,prescription_quantity:rx.length,treatment_lines:lines,treatment_total:treatmentTotal,mounting:mountingLabel,mounting_price:money(mountingPrice)};
}
function colorExtra(mode:string,qty:number){
  const m=low(mode);let unit=0,label="";
  if(/photo|foto/.test(m)){unit=40;label="Fotocromatico"}
  else if(/sun|sole/.test(m)){unit=20;label="Sole"}
  return {mode:norm(mode),label,unit_price:unit,quantity:qty,total:money(unit*qty)};
}
function indexExtra(value:any,qty:number){
  const raw=norm(value).replace(",",".");let v=raw||"1.5",unit=0,label="1.50";
  if(v==="1.50")v="1.5";
  if(v==="1.5"){unit=0;label="1.50"}
  else if(v==="1.6"||v==="1.60"){v="1.6";unit=10;label="1.60"}
  else if(v==="1.67"){unit=20;label="1.67"}
  else if(v==="1.74"){unit=30;label="1.74"}
  else throw new Error("Indice lente non valido.");
  return {value:v,label,unit_price:unit,quantity:qty,total:money(unit*qty)};
}
function geometryExtra(value:any,types:string[]){
  const soldMonofocal=types.filter(t=>norm(t)&&!isClientLens(t)&&isMonofocal(t));const qty=soldMonofocal.length;
  if(!qty)return {value:"",label:"",unit_price:0,quantity:0,total:0};
  const v=low(value||"sferica").replace(/[\s-]+/g,"_");
  if(v==="sferica"||v==="standard")return {value:"sferica",label:"Sferica",unit_price:0,quantity:qty,total:0};
  if(v==="asferica")return {value:"asferica",label:"Asferica",unit_price:10,quantity:qty,total:money(10*qty)};
  if(v==="bi_asferica"||v==="biasferica")return {value:"bi_asferica",label:"Bi-asferica",unit_price:20,quantity:qty,total:money(20*qty)};
  throw new Error("Geometria monofocale non valida.");
}
function warrantyExtra(value:any,framePrice:number){
  const w=low(value||"base");
  if(w==="base")return {name:"Base",price:0,total:0,eligibility:"Tutte le montature"};
  if(w==="silver"){if(framePrice>150)throw new Error("La Garanzia Silver è disponibile solo per montature fino a € 150.");return {name:"Silver",price:20,total:20,eligibility:"Montature fino a € 150"}}
  if(w==="gold"){if(framePrice<=150)throw new Error("La Garanzia Gold è disponibile solo per montature oltre € 150.");return {name:"Gold",price:100,total:100,eligibility:"Montature oltre € 150"}}
  throw new Error("Garanzia non valida.");
}
function sideData(src:any,side:string,fallbackType:string,fallback:any){
  src=src&&typeof src==="object"?src:{};fallback=fallback&&typeof fallback==="object"?fallback:{};
  const t=norm(src.type||fallbackType),client=isClientLens(t);
  return {side,type:t,brand:client?"":norm(src.brand||fallback.brand).slice(0,120),lens_name:client?"":norm(src.lens_name||fallback.lens_name).slice(0,180),design:client?"":norm(src.design||fallback.design).slice(0,120),material:client?"":norm(src.material||fallback.material).slice(0,120),unit_price:client?0:money(src.unit_price),client_owned:client};
}
function cleanData(p:any){
  const mode=norm(p.mode)==="quote"?"quote":"job";
  const frame=p.frame&&typeof p.frame==="object"?p.frame:{};
  const lens=p.lens&&typeof p.lens==="object"?p.lens:{};
  const frameType=norm(frame.type),frameIsClient=low(frameType)==="del cliente";
  const framePrice=frameIsClient?0:money(frame.price),lensUnit=money(lens.unit_price);
  const od=norm(lens.lens_type_od||lens.lens_od?.type||lens.lens_type),os=norm(lens.lens_type_os||lens.lens_os?.type||lens.lens_type);
  if(!frameType)throw new Error("Seleziona il tipo montatura.");
  if(!frameIsClient&&!norm(frame.brand)&&!norm(frame.model)&&!norm(frame.description))throw new Error("Inserisci la montatura oppure seleziona Del cliente.");
  if(!od||!os)throw new Error("Seleziona prima il tipo lente DX e poi il tipo lente SX.");
  const treatments=Array.isArray(lens.treatments)?lens.treatments.map((x:any)=>norm(x)).filter((x:string)=>ALLOWED_TREATMENTS.has(x)).slice(0,20):[];
  const ex=extras([od,os],treatments,norm(lens.mounting));const qty=ex.sold_quantity;
  const discount=Math.max(0,Math.min(100,Number(p.discount_percent||0)));
  const lensGross=money(lensUnit*qty),lensDiscount=money(lensGross*discount/100),lensNet=money(lensGross-lensDiscount);
  const color=colorExtra(norm(lens.color_mode),qty),index=indexExtra(lens.refractive_index||lens.index,qty),geometry=geometryExtra(lens.geometry,[od,os]),warranty=warrantyExtra(p.warranty,framePrice);
  const total=money(framePrice+lensNet+ex.treatment_total+ex.mounting_price+color.total+index.total+geometry.total+warranty.total);
  const generalType=od===os?od:("DX: "+od+" / SX: "+os);
  const odSide=sideData(lens.lens_od,"OD",od,{brand:lens.brand,lens_name:lens.lens_name,design:lens.design,material:lens.material});
  const osSide=sideData(lens.lens_os,"OS",os,{brand:lens.brand,lens_name:lens.lens_name,design:lens.design,material:lens.material});
  if(!isClientLens(od)&&!odSide.unit_price)odSide.unit_price=money(lens.unit_price_od||lensUnit);
  if(!isClientLens(os)&&!osSide.unit_price)osSide.unit_price=money(lens.unit_price_os||lensUnit);
  return {
    version:5,sheetType:mode==="quote"?"eyewear_quote":"eyewear_job",documentType:mode==="quote"?"Preventivo":"Busta",mode,
    client_id:norm(p.client_id)||null,warranty:warranty.name,warranty_pricing:warranty,
    frame:{brand:frameIsClient?"Del cliente":norm(frame.brand).slice(0,120),model:frameIsClient?"":norm(frame.model).slice(0,120),type:frameType.slice(0,100),color:frameIsClient?"":norm(frame.color).slice(0,120),description:frameIsClient?"":norm(frame.description).slice(0,500),price:framePrice,warehouse_item_id:frameIsClient?null:(norm(frame.warehouse_item_id)||null),barcode:frameIsClient?"":norm(frame.barcode).slice(0,120),sku:frameIsClient?"":norm(frame.sku).slice(0,120),stock_quantity:frameIsClient?null:(frame.stock_quantity==null?null:Number(frame.stock_quantity))},
    lens:{catalog_id:norm(lens.catalog_id)||null,code:norm(lens.code).slice(0,100),supplier:norm(lens.supplier).slice(0,120),brand:norm(lens.brand).slice(0,120),lens_name:norm(lens.lens_name).slice(0,180),lens_type:generalType,lens_type_od:od.slice(0,120),lens_type_os:os.slice(0,120),lens_od:odSide,lens_os:osSide,design:norm(lens.design).slice(0,120),material:norm(lens.material).slice(0,120),refractive_index:index.value,index_pricing:index,geometry:geometry.value,geometry_pricing:geometry,treatments,treatment_pricing:ex.treatment_lines,treatment_total:ex.treatment_total,mounting:ex.mounting,mounting_price:ex.mounting_price,color_mode:norm(lens.color_mode).slice(0,80),color:norm(lens.color).slice(0,100),color_pricing:color,polarized:treatments.includes("Polarizzato"),photochromic:/photo|foto/.test(low(lens.color_mode)),quantity:qty,unit_price:lensUnit,unit_price_od:odSide.unit_price,unit_price_os:osSide.unit_price},
    discount_percent:discount,
    pricing:{frame_price:framePrice,lens_unit_price:lensUnit,lens_quantity:qty,lens_gross:lensGross,discount_percent:discount,lens_discount:lensDiscount,lens_net:lensNet,index_total:index.total,geometry_total:geometry.total,treatment_total:ex.treatment_total,mounting_price:ex.mounting_price,color_total:color.total,warranty_total:warranty.total,total},
    notes:norm(p.notes).slice(0,4000),savedAt:new Date().toISOString()
  };
}
function sameInstant(a:any,b:any){const x=Date.parse(String(a||"")),y=Date.parse(String(b||""));return Number.isFinite(x)&&Number.isFinite(y)&&x===y}
async function updateSheet(p:any,operator:string){
  const id=norm(p.edit_sheet_id),clientId=norm(p.client_id),expected=norm(p.expected_updated_at);
  if(!id||!clientId||!expected)throw new Error("Apri di nuovo il documento dall’anagrafica prima di salvarlo.");
  const {data:existing,error:eErr}=await db.from("optyker_sheets").select("*").eq("id",id).eq("client_id",clientId).maybeSingle();
  if(eErr)throw eErr;if(!existing)throw new Error("Scheda Occhiali non disponibile per il cliente selezionato.");
  if(existing.archived_at)throw new Error('Scheda annullata: non può essere modificata.');
  if(!["eyewear_quote","eyewear_job"].includes(String(existing.sheet_type||"")))throw new Error("Il documento selezionato non è una scheda Occhiali.");
  if(!sameInstant(expected,existing.updated_at))throw new Error("La scheda è stata modificata: riaprila dall’anagrafica prima di salvare.");
  if(existing.sheet_type==="eyewear_quote"){
    const {data:link,error:lErr}=await db.from("optyker_quote_order_links").select("quote_id").eq("quote_id",id).limit(1);
    if(lErr)throw lErr;if(link?.length)throw new Error("Preventivo già trasformato in ordine: modifica la Busta collegata.");
  }
  const {data:work,error:wErr}=await db.from("optyker_work_orders").select("id,status,payload").eq("source_sheet_id",id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(wErr)throw wErr;if(work&&["completato","annullato"].includes(String(work.status||"")))throw new Error("Ordine già chiuso: la scheda non può essere modificata.");
  let cleaned=cleanData({...p,mode:existing.sheet_type==="eyewear_quote"?"quote":"job",client_id:clientId});
  const old=existing.data&&typeof existing.data==="object"?existing.data:{};
  cleaned.order_parameters=normalizeOrderParameters(p.order_parameters??old.order_parameters);
  cleaned={...old,...cleaned,frame:{...(old.frame||{}),...(cleaned.frame||{})},lens:{...(old.lens||{}),...(cleaned.lens||{})},pricing:cleaned.pricing};
  cleaned.mode=existing.sheet_type==="eyewear_quote"?"quote":"job";cleaned.sheetType=existing.sheet_type;cleaned.documentType=existing.document_type||(cleaned.mode==="quote"?"Preventivo":"Busta");cleaned.reference_code=existing.reference_code||old.reference_code||"";cleaned.client_id=clientId;cleaned.savedAt=new Date().toISOString();
  const {data:client,error:cErr}=await db.from("optyker_clients").select("id,name,surname,reference_no").eq("id",clientId).maybeSingle();if(cErr)throw cErr;if(!client)throw new Error("Cliente non trovato.");
  cleaned.client={id:client.id,name:client.name||"",surname:client.surname||"",reference_no:client.reference_no||""};
  const {data:updated,error:uErr}=await db.from("optyker_sheets").update({operator,data:cleaned,updated_at:new Date().toISOString()}).eq("id",id).eq("client_id",clientId).select("*").single();if(uErr)throw uErr;
  if(work){
    const summary="Montatura: "+[cleaned.frame?.brand,cleaned.frame?.model].filter(Boolean).join(" ")+" · DX: "+norm(cleaned.lens?.lens_type_od)+" · SX: "+norm(cleaned.lens?.lens_type_os);
    const payload={...(work.payload&&typeof work.payload==="object"?work.payload:{}),snapshot:updated.data,summary_text:summary,source_updated_at:updated.updated_at,edited_at:new Date().toISOString(),edited_by:operator};
    const {error:wu}=await db.from("optyker_work_orders").update({payload,updated_at:new Date().toISOString()}).eq("id",work.id);if(wu)throw wu;
  }
  return updated;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const operator=await auth(body),action=norm(body.action),p=body?.payload||{};
    if(action!=="update")return out({ok:false,error:"Azione non riconosciuta"},400);
    return out({ok:true,data:await updateSheet(p,operator)});
  }catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali|Troppi tentativi/.test(m)?401:400)}
});
