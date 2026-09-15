import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {normalizeOrderParameters} from '../../../eyewear-order-parameters.mjs';

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const norm=(v:any)=>String(v??"").trim();
const low=(v:any)=>norm(v).toLocaleLowerCase("it-IT");
const money=(v:any)=>{const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0};
const isClient=(v:any)=>low(v)==="del cliente";
const isMono=(v:any)=>/monofocal/.test(low(v));

function suppliedTypes(body:any){
  const lens=body?.payload?.lens||{};
  return [norm(lens.lens_type_od||lens.lens_type),norm(lens.lens_type_os||lens.lens_type)].filter(x=>x&&!isClient(x));
}
function isVicino(code:any){const c=norm(code).toUpperCase();return c==="VICINO"||c==="VICINOHARD"||c==="VICINOHMC"}
function hasSportive(body:any){const a=body?.payload?.lens?.treatments;return Array.isArray(a)&&a.map(norm).includes("Sportive")}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const action=norm(body?.action),types=suppliedTypes(body);
    const parameters=action==='save'?normalizeOrderParameters(body?.payload?.order_parameters):null;
    if(action==="save"&&isVicino(body?.payload?.promotion_code)){
      if(!types.length||!types.every(isMono))return out({ok:false,error:norm(body?.payload?.promotion_code)+" è disponibile solo con lenti monofocali."},400);
    }
    const upstream=await fetch(U+"/functions/v1/optyker-eyewear-api-v5",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await upstream.json().catch(()=>({ok:false,error:"Risposta backend non valida"}));
    if(!upstream.ok||!data?.ok)return out(data,upstream.status||400);

    if(action==="save"&&hasSportive(body)&&data?.data?.id){
      const qty=types.length,total=money(25*qty);
      const sheetData=data.data.data&&typeof data.data.data==="object"?structuredClone(data.data.data):{};
      sheetData.lens=sheetData.lens&&typeof sheetData.lens==="object"?sheetData.lens:{};
      const treatments=Array.isArray(sheetData.lens.treatments)?sheetData.lens.treatments.map(norm).filter(Boolean):[];
      if(!treatments.includes("Sportive"))treatments.push("Sportive");
      sheetData.lens.treatments=treatments;
      let lines=Array.isArray(sheetData.lens.treatment_pricing)?sheetData.lens.treatment_pricing.filter((x:any)=>norm(x?.name)!=="Sportive"):[];
      lines.push({name:"Sportive",unit_price:25,quantity:qty,total,free:false});
      sheetData.lens.treatment_pricing=lines;
      sheetData.lens.treatment_total=money(sheetData.lens.treatment_total)+total;
      sheetData.pricing=sheetData.pricing&&typeof sheetData.pricing==="object"?sheetData.pricing:{};
      sheetData.pricing.treatment_total=money(sheetData.pricing.treatment_total)+total;
      sheetData.pricing.total_before_promotion=money(sheetData.pricing.total_before_promotion)+total;
      sheetData.pricing.total=money(sheetData.pricing.total)+total;
      if(sheetData.promotion_pricing&&typeof sheetData.promotion_pricing==="object"){
        sheetData.promotion_pricing.regular_total=money(sheetData.promotion_pricing.regular_total)+total;
        sheetData.promotion_pricing.total=money(sheetData.promotion_pricing.total)+total;
      }
      const {error}=await db.from("optyker_sheets").update({data:sheetData}).eq("id",data.data.id);
      if(error)throw error;
      data.data.data=sheetData;
    }
    if(action==='save'&&data?.data?.id){
      const {data:updated,error}=await db.from('optyker_sheets').update({data:{...(data.data.data||{}),order_parameters:parameters},updated_at:new Date().toISOString()}).eq('id',data.data.id).select('*').single();
      if(error)throw error;data.data=updated;
    }
    if(action==='recent'&&Array.isArray(data.data)&&data.data.length){
      const {data:rows,error}=await db.from('optyker_sheets').select('id,archived_at,data,updated_at').in('id',data.data.map((row:any)=>row.id));if(error)throw error;
      const active=new Map((rows||[]).filter((row:any)=>!row.archived_at).map((row:any)=>[row.id,row]));
      data.data=data.data.filter((row:any)=>active.has(row.id)).map((row:any)=>({...row,...active.get(row.id)}));
    }
    return out(data,200);
  }catch(e){return out({ok:false,error:e instanceof Error?e.message:String(e)},400)}
});
