import {sessionAction} from '../optyker-cash-sessions/actions.ts';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const ADMIN_USER="OTTICA VISUAL CARE";
const SERIAL="72IV6003831";
const REQUIRED_WORKER="2.2-daily-closure";
const ALLOWED=new Set(["https://optyker.it","https://www.optyker.it","https://optyker-web.vercel.app","https://leahcim12.github.io"]);
function cors(req:Request){const origin=req.headers.get("origin")||"";const allow=ALLOWED.has(origin)?origin:(origin?"https://www.optyker.it":"*");return {"Access-Control-Allow-Origin":allow,"Vary":"Origin","Access-Control-Allow-Headers":"content-type, authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"}}
function out(req:Request,x:any,status=200){return new Response(JSON.stringify(x),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8"}})}
function normUser(v:any){return String(v||"").trim().replace(/\s+/g," ").toUpperCase()}
function b64uDecodeText(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const raw=atob(s);return new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))}
async function signingKey(){return crypto.subtle.importKey("raw",new TextEncoder().encode(S),{name:"HMAC",hash:"SHA-256"},false,["verify"])}
async function verifyToken(req:Request){const h=req.headers.get("authorization")||"";const token=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";const [payload,sigText]=token.split(".");if(!payload||!sigText)return null;try{let s=sigText.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const raw=atob(s),sig=Uint8Array.from(raw,c=>c.charCodeAt(0));const ok=await crypto.subtle.verify("HMAC",await signingKey(),sig,new TextEncoder().encode(payload));if(!ok)return null;const p=JSON.parse(b64uDecodeText(payload));if(p.scope!=="billing_admin"||normUser(p.sub)!==ADMIN_USER||Number(p.exp||0)<Date.now()/1000)return null;return p}catch{return null}}
function day(v:any){const x=String(v||"").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(x))throw new Error("Data non valida");return x}
function money(v:any){if(v===null||v===undefined||v==="")return 0;const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error("Importo non valido");return Math.round(n*100)/100}
async function rpc(name:string,args:any){const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function romeDay(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const v:any={};for(const x of p)v[x.type]=x.value;return `${v.year}-${v.month}-${v.day}`}
function safeRegIdle(s:any){return s?.ok===true&&/^REG(?:\s*\(OP\s*\d+\))?$/.test(String(s.mode||""))&&String(s.idleState)==="0"&&["busy","errorCode","printerError","paperEnd","coverOpen"].every(k=>Number(s?.[k])===0)}
async function rchConnector(){const {data,error}=await db.from("optyker_rch_connectors").select("machine_id,connector_version,last_seen_at,last_status").eq("serial",SERIAL).eq("active",true).order("last_seen_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;const online=!!data?.last_seen_at&&(Date.now()-new Date(data.last_seen_at).getTime()<25000);return {online,connector_version:String(data?.connector_version||""),status:data?.last_status||{},last_seen_at:data?.last_seen_at||null}}
async function existingDailyClosure(date:string){const {data,error}=await db.from("optyker_rch_remote_commands").select("id,state,result,error,requested_at,claimed_at,completed_at,expires_at,payload").eq("kind","daily_closure").eq("serial",SERIAL).eq("payload->>business_date",date).order("requested_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data}
function inspectDailyResult(row:any){const r=row?.result||{};if(row?.state==="completed"&&r.dailyClosureExecuted===true&&r.state==="completed")return {ok:true,row};if(row?.state==="completed"&&r.state==="uncertain")throw new Error("La chiusura RCH potrebbe essere stata eseguita ma l'esito non è confermato. Verifica la stampa sulla RCH prima di ripetere la chiusura.");if(row?.state==="failed"||row?.state==="expired")throw new Error(row?.error||r.error||"La RCH non ha eseguito la chiusura giornaliera.");return null}
async function waitDailyClosure(id:string){const until=Date.now()+90000;while(Date.now()<until){const {data,error}=await db.from("optyker_rch_remote_commands").select("id,state,result,error,requested_at,claimed_at,completed_at,expires_at,payload").eq("id",id).maybeSingle();if(error)throw error;if(!data)throw new Error("Comando di chiusura RCH non trovato");const done=inspectDailyResult(data);if(done)return done;await wait(750)}throw new Error("La chiusura RCH è ancora in corso. Non ripetere il comando: verifica la stampante e poi riapri Chiusure cassa.")}
async function ensureRchDailyClosure(date:string){if(date!==romeDay())throw new Error("La chiusura RCH automatica è consentita solo per la giornata corrente. Per una data precedente verifica prima la chiusura direttamente sul registratore.");const old=await existingDailyClosure(date);if(old){const done=inspectDailyResult(old);if(done)return {...done,reused:true};if(old.state==="queued"||old.state==="claimed")return {...await waitDailyClosure(old.id),reused:true}}
 const live=await rchConnector();if(!live.online)throw new Error("PC cassa RCH non collegato. Accendi il PC cassa e verifica il Cloud Relay prima di chiudere.");if(live.connector_version!==REQUIRED_WORKER)throw new Error("Aggiorna una sola volta il collegamento RCH sul PC cassa alla versione 2.2, poi ripeti Chiudi cassa.");if(!safeRegIdle(live.status))throw new Error("Chiusura RCH bloccata: il registratore deve essere in REG, inattivo e senza errori. Se è in Z, riportalo manualmente in REG e riprova.");
 const {data,error}=await db.from("optyker_rch_remote_commands").insert({kind:"daily_closure",serial:SERIAL,state:"queued",requested_by:"Ottica Visual Care",requested_at:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString(),payload:{business_date:date,source:"admin_cash_close"}}).select("id,state,result,error,requested_at,expires_at,payload").single();if(error)throw error;return await waitDailyClosure(data.id)}
async function requireExistingCashClosure(date:string){const {data,error}=await db.from("optyker_cash_closures").select("id,business_date,closed_at,operator_username").eq("register_code","main").eq("business_date",date).maybeSingle();if(error)throw error;if(!data)throw new Error("La chiusura Optyker di questa giornata non risulta registrata.");return data}
function closePayload(b:any){const x={business_date:day(b.business_date),cash_counted:money(b.cash_counted),checks_counted:money(b.checks_counted),bank_deposit_cash:money(b.bank_deposit_cash),bank_deposit_checks:money(b.bank_deposit_checks),safe_deposit_cash:money(b.safe_deposit_cash),safe_deposit_checks:money(b.safe_deposit_checks),notes:String(b.notes||"").slice(0,2000)};if(x.bank_deposit_cash+x.safe_deposit_cash>x.cash_counted+0.005)throw new Error("I prelievi di contanti superano il contante contato");if(x.bank_deposit_checks+x.safe_deposit_checks>x.checks_counted+0.005)throw new Error("I prelievi di assegni superano gli assegni contati");return x}
async function preflightClose(x:any){const m=await rpc("optyker_cash_day_metrics",{p_business_date:x.business_date});if(m?.closed)throw new Error("La cassa di questa giornata è già stata chiusa");if(!m?.opened)throw new Error("Prima di chiudere devi registrare l'apertura giornaliera");return m}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return out(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
  const session=await verifyToken(req);if(!session)return out(req,{ok:false,error:"Sessione amministrativa non valida o scaduta"},401);
  const b=await req.json().catch(()=>({}));const action=String(b.action||"");
  if(action.startsWith('session_'))return out(req,{ok:true,data:await sessionAction(db,action,b,'Ottica Visual Care',true)});
  if(action==="overview"){const now=new Date(),year=Math.trunc(Number(b.year||now.getUTCFullYear())),month=Math.trunc(Number(b.month||now.getUTCMonth()+1));if(year<2020||year>2100||month<1||month>12)throw new Error("Mese non valido");return out(req,{ok:true,data:await rpc("optyker_cash_session_month",{p_year:year,p_month:month})})}
  if(action==="day")return out(req,{ok:true,data:await rpc("optyker_cash_session_state",{p_business_date:day(b.business_date)})});
  if(action==="open_day")return out(req,{ok:true,data:await rpc("optyker_cash_admin_open_day",{p_business_date:day(b.business_date),p_operator:"Ottica Visual Care",p_opening_cash:money(b.opening_cash),p_opening_checks:money(b.opening_checks),p_notes:String(b.notes||"").slice(0,2000)})});
  if(action==="complete_rch_closure"){
   const date=day(b.business_date);await requireExistingCashClosure(date);const rch=await ensureRchDailyClosure(date);
   return out(req,{ok:true,data:{business_date:date,rch_closure:{confirmed:true,command_id:rch.row?.id||null,reused:!!rch.reused}}});
  }
  if(action==="close_day"){
   const x=closePayload(b);await preflightClose(x);const rch=await ensureRchDailyClosure(x.business_date);
   const data=await rpc("optyker_cash_admin_close_day",{p_business_date:x.business_date,p_operator:"Ottica Visual Care",p_cash_counted:x.cash_counted,p_checks_counted:x.checks_counted,p_bank_deposit_cash:x.bank_deposit_cash,p_bank_deposit_checks:x.bank_deposit_checks,p_safe_deposit_cash:x.safe_deposit_cash,p_safe_deposit_checks:x.safe_deposit_checks,p_notes:x.notes});
   return out(req,{ok:true,data:{...data,rch_closure:{confirmed:true,command_id:rch.row?.id||null,reused:!!rch.reused}}});
  }
  return out(req,{ok:false,error:"Azione non riconosciuta"},400)
 }catch(e){return out(req,{ok:false,error:e instanceof Error?e.message:String(e)},400)}
});
