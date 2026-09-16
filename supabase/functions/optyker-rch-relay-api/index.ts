import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const SERIAL="72IV6003831";
const ALLOWED=new Set(["https://optyker.it","https://www.optyker.it"]);
const CORS=(origin:string)=>({
  "Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://optyker.it",
  "Access-Control-Allow-Headers":"content-type, authorization",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Cache-Control":"no-store",
  "Vary":"Origin"
});
const out=(origin:string,x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS(origin),"Content-Type":"application/json; charset=utf-8"}});
const norm=(v:any)=>String(v??"").trim();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const secretRe=/^[a-f0-9]{64}$/;

async function sha(v:string){
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))]
    .map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function staff(body:any){
  const u=norm(body?.username),p=String(body?.password||"");
  if(!u||p.length<8)throw new Error("AUTH_REQUIRED");
  const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:u,p_password:p});
  if(error||!data?.ok)throw new Error("AUTH_REQUIRED");
  return String(data.username||u);
}

function safeStatus(v:any){
  const s=v&&typeof v==="object"?v:{};
  return {
    automaticVoidReference:s.automaticVoidReference===true,
    ok:s.ok===true,
    mode:norm(s.mode).slice(0,30),
    idleState:norm(s.idleState).slice(0,10),
    errorCode:Number.isFinite(Number(s.errorCode))?Number(s.errorCode):-1,
    printerError:Number.isFinite(Number(s.printerError))?Number(s.printerError):-1,
    paperEnd:Number.isFinite(Number(s.paperEnd))?Number(s.paperEnd):-1,
    coverOpen:Number.isFinite(Number(s.coverOpen))?Number(s.coverOpen):-1,
    busy:Number.isFinite(Number(s.busy))?Number(s.busy):-1,
    lastCmd:Number.isFinite(Number(s.lastCmd))?Number(s.lastCmd):-1,
    error:norm(s.error).slice(0,180)
  };
}

function isSafeZIdle(s:any){
  return s?.ok===true && norm(s.mode)==="Z" && norm(s.idleState)==="0" &&
    ["busy","errorCode","printerError","paperEnd","coverOpen"].every(k=>Number(s?.[k])===0);
}

async function machine(body:any){
  const p=body?.payload||{},mid=norm(p.machine_id),sec=norm(p.secret);
  if(!uuid.test(mid)||!secretRe.test(sec))throw new Error("MACHINE_AUTH_REQUIRED");
  const {data,error}=await db.from("optyker_rch_connectors").select("*").eq("machine_id",mid).eq("active",true).maybeSingle();
  if(error||!data||data.secret_hash!==await sha(sec))throw new Error("MACHINE_AUTH_REQUIRED");
  return data;
}

async function enroll(body:any,operator:string){
  const p=body?.payload||{},mid=norm(p.machine_id),sec=norm(p.secret),serial=norm(p.serial);
  if(!uuid.test(mid)||!secretRe.test(sec)||serial!==SERIAL)throw new Error("Dati PC cassa non validi");
  const row={machine_id:mid,serial,secret_hash:await sha(sec),enrolled_by:operator,active:true,connector_version:norm(p.connector_version).slice(0,80),last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {data,error}=await db.from("optyker_rch_connectors").upsert(row,{onConflict:"machine_id"}).select("id,machine_id,serial,connector_version,last_seen_at").single();
  if(error)throw error;
  return data;
}

async function queueFiscal(body:any,operator:string){
  const p=body?.payload||{},jobId=norm(p.job_id),tok=norm(p.token),op=norm(p.operation)==="void"?"void":"sale";
  if(!uuid.test(jobId)||!secretRe.test(tok))throw new Error("Autorizzazione fiscale non valida");
  const {data:j,error}=await db.from("optyker_fiscal_jobs").select("id,serial,state,claim_hash,claim_expires_at,operation").eq("id",jobId).maybeSingle();
  if(error||!j)throw new Error("Emissione non trovata");
  if(j.serial!==SERIAL||j.state!=="prepared"||String(j.operation||"sale")!==op)throw new Error("Emissione non accodabile");
  if(j.claim_hash!==await sha(tok)||!j.claim_expires_at||new Date(j.claim_expires_at).getTime()<=Date.now())throw new Error("Autorizzazione emissione scaduta");
  const kind=op==="void"?"fiscal_void":"fiscal_sale";
  const {data:old}=await db.from("optyker_rch_remote_commands").select("*").eq("fiscal_job_id",jobId).maybeSingle();
  const row={kind,fiscal_job_id:jobId,serial:SERIAL,claim_token:tok,state:"queued",requested_by:operator,requested_at:new Date().toISOString(),expires_at:j.claim_expires_at,claimed_by:null,claimed_at:null,completed_at:null,result:{},error:"",updated_at:new Date().toISOString()};
  let q;
  if(old){
    if(old.state==="claimed"&&old.claimed_at&&Date.now()-new Date(old.claimed_at).getTime()<90000)return {id:old.id,state:old.state};
    q=db.from("optyker_rch_remote_commands").update(row).eq("id",old.id).select("id,state,kind,requested_at,expires_at").single();
  }else{
    q=db.from("optyker_rch_remote_commands").insert(row).select("id,state,kind,requested_at,expires_at").single();
  }
  const {data,error:e}=await q;
  if(e)throw e;
  return data;
}

async function connectorStatus(){
  const {data,error}=await db.from("optyker_rch_connectors").select("machine_id,connector_version,last_seen_at,last_status").eq("serial",SERIAL).eq("active",true).order("last_seen_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  const online=!!data?.last_seen_at&&(Date.now()-new Date(data.last_seen_at).getTime()<25000);
  return {
    online,
    serial:SERIAL,
    connector_version:data?.connector_version||"",
    last_seen_at:data?.last_seen_at||null,
    status:data?.last_status||{},
    capabilities:{remoteFiscal:true,automaticReference:true,drawer:true,giftReceipt:true,manualReg:true}
  };
}

async function queueAux(body:any,operator:string){
  const p=body?.payload||{},kind=norm(p.kind);
  if(!["drawer","gift_receipt","restore_reg"].includes(kind))throw new Error("Comando non consentito");
  if(kind==="restore_reg"){
    const live=await connectorStatus();
    if(!live.online)throw new Error("PC cassa non collegato");
    if(!isSafeZIdle(live.status))throw new Error("Il ritorno manuale in REG e consentito solo con RCH in Z, inattiva e senza errori");
  }
  const {data,error}=await db.from("optyker_rch_remote_commands").insert({kind,serial:SERIAL,state:"queued",requested_by:operator,expires_at:new Date(Date.now()+120000).toISOString()}).select("id,state,kind,requested_at,expires_at").single();
  if(error)throw error;
  return data;
}

async function poll(body:any,c:any){
  const p=body?.payload||{};
  const patch:any={last_seen_at:new Date().toISOString(),connector_version:norm(p.connector_version).slice(0,80),updated_at:new Date().toISOString()};
  if(p.status&&typeof p.status==="object")patch.last_status=safeStatus(p.status);
  await db.from("optyker_rch_connectors").update(patch).eq("id",c.id);
  const {data,error}=await db.rpc("optyker_claim_rch_remote_command",{p_connector_id:c.id});
  if(error)throw error;
  if(!data)return {command:null};
  return {command:{id:data.id,kind:data.kind,job_id:data.fiscal_job_id||null,token:data.claim_token||"",expires_at:data.expires_at}};
}

async function complete(body:any,c:any){
  const p=body?.payload||{},id=norm(p.command_id);
  if(!uuid.test(id))throw new Error("Comando non valido");
  const result=p.result&&typeof p.result==="object"?p.result:{};
  const failed=result.ok===false&&norm(result.state)!=="uncertain";
  const {data,error}=await db.from("optyker_rch_remote_commands").update({state:failed?"failed":"completed",completed_at:new Date().toISOString(),result,error:norm(result.error).slice(0,250),updated_at:new Date().toISOString()}).eq("id",id).eq("claimed_by",c.id).eq("state","claimed").select("id,state").maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("Comando non assegnato a questo PC");
  return data;
}

async function commandStatus(body:any){
  const p=body?.payload||{},id=norm(p.command_id);
  if(!uuid.test(id))throw new Error("Comando non valido");
  const {data,error}=await db.from("optyker_rch_remote_commands").select("id,kind,state,requested_at,claimed_at,completed_at,result,error,expires_at").eq("id",id).maybeSingle();
  if(error||!data)throw new Error("Comando non trovato");
  return data;
}

Deno.serve(async req=>{
  const origin=req.headers.get("origin")||"";
  if(origin&&!ALLOWED.has(origin))return out(origin,{ok:false,error:"Origin non consentita"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS(origin)});
  if(req.method!=="POST")return out(origin,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({})),a=norm(body.action);
    if(a==="poll"){const c=await machine(body);return out(origin,{ok:true,data:await poll(body,c)});}
    if(a==="complete"){const c=await machine(body);return out(origin,{ok:true,data:await complete(body,c)});}
    const operator=await staff(body);
    if(a==="enroll")return out(origin,{ok:true,data:await enroll(body,operator)});
    if(a==="queue_fiscal")return out(origin,{ok:true,data:await queueFiscal(body,operator)});
    if(a==="queue_aux")return out(origin,{ok:true,data:await queueAux(body,operator)});
    if(a==="status")return out(origin,{ok:true,data:await connectorStatus()});
    if(a==="command_status")return out(origin,{ok:true,data:await commandStatus(body)});
    throw new Error("Azione non riconosciuta");
  }catch(e){
    const m=e instanceof Error?e.message:String(e);
    return out(origin,{ok:false,error:m},/AUTH_REQUIRED|MACHINE_AUTH_REQUIRED/.test(m)?401:400);
  }
});
