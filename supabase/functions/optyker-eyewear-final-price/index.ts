import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const norm=(v:any)=>String(v??"").trim();
const money=(v:any)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1000000)throw new Error("Prezzo finale non valido");return Math.round(n*100)/100};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function auth(body:any){
  const username=norm(body?.username),password=String(body?.password||"");
  if(!username||password.length<8)throw new Error("AUTH_REQUIRED");
  const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:username,p_password:password});
  if(error||!data?.ok)throw new Error(data?.error||"Credenziali non valide");
  return String(data.username||username);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const operator=await auth(body),p=body?.payload||{},id=norm(p.sheet_id);
    if(!UUID.test(id))throw new Error("Scheda Occhiali non valida");
    const {data:sheet,error:e}=await db.from("optyker_sheets").select("*").eq("id",id).maybeSingle();
    if(e)throw e;if(!sheet)throw new Error("Scheda Occhiali non trovata");
    if(sheet.archived_at)throw new Error("Scheda annullata: il prezzo non può essere modificato");
    if(!["eyewear_quote","eyewear_job"].includes(String(sheet.sheet_type||"")))throw new Error("Il documento selezionato non è una Busta/Preventivo Occhiali");

    const data=sheet.data&&typeof sheet.data==="object"?structuredClone(sheet.data):{};
    data.pricing=data.pricing&&typeof data.pricing==="object"?structuredClone(data.pricing):{};
    const current=Number(data.pricing.total||0);
    const calculated=Number.isFinite(Number(data.pricing.calculated_total))?Number(data.pricing.calculated_total):current;
    const clear=p.clear===true;
    if(clear){
      delete data.pricing.manual_final_price;
      data.pricing.total=Math.round(calculated*100)/100;
      data.pricing.calculated_total=Math.round(calculated*100)/100;
      delete data.manual_final_price;
    }else{
      const finalPrice=money(p.amount);
      data.pricing.calculated_total=Math.round(calculated*100)/100;
      data.pricing.manual_final_price=finalPrice;
      data.pricing.total=finalPrice;
      data.manual_final_price=finalPrice;
    }
    data.savedAt=new Date().toISOString();
    const {data:updated,error:u}=await db.from("optyker_sheets").update({data,operator,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();
    if(u)throw u;
    return out({ok:true,data:updated});
  }catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali|Troppi tentativi/.test(m)?401:400)}
});
