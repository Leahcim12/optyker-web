import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const ADMIN_USER="OTTICA VISUAL CARE";
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
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return out(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const session=await verifyToken(req);if(!session)return out(req,{ok:false,error:"Sessione amministrativa non valida o scaduta"},401);
    const b=await req.json().catch(()=>({}));const action=String(b.action||"");
    if(action==="overview"){const now=new Date(),year=Math.trunc(Number(b.year||now.getUTCFullYear())),month=Math.trunc(Number(b.month||now.getUTCMonth()+1));if(year<2020||year>2100||month<1||month>12)throw new Error("Mese non valido");return out(req,{ok:true,data:await rpc("optyker_cash_month_overview",{p_year:year,p_month:month})})}
    if(action==="day")return out(req,{ok:true,data:await rpc("optyker_cash_day_metrics",{p_business_date:day(b.business_date)})});
    if(action==="open_day")return out(req,{ok:true,data:await rpc("optyker_cash_admin_open_day",{p_business_date:day(b.business_date),p_operator:"Ottica Visual Care",p_opening_cash:money(b.opening_cash),p_opening_checks:money(b.opening_checks),p_notes:String(b.notes||"").slice(0,2000)})});
    if(action==="close_day")return out(req,{ok:true,data:await rpc("optyker_cash_admin_close_day",{p_business_date:day(b.business_date),p_operator:"Ottica Visual Care",p_cash_counted:money(b.cash_counted),p_checks_counted:money(b.checks_counted),p_bank_deposit_cash:money(b.bank_deposit_cash),p_bank_deposit_checks:money(b.bank_deposit_checks),p_safe_deposit_cash:money(b.safe_deposit_cash),p_safe_deposit_checks:money(b.safe_deposit_checks),p_notes:String(b.notes||"").slice(0,2000)})});
    return out(req,{ok:false,error:"Azione non riconosciuta"},400)
  }catch(e){return out(req,{ok:false,error:e instanceof Error?e.message:String(e)},400)}
});
