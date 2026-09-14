/* OPTYKER_CASH_DAY_API_V1 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")||"";
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const ALLOWED=new Set(["https://optyker.it","https://www.optyker.it","https://optyker-web.vercel.app","https://leahcim12.github.io"]);

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const allow=ALLOWED.has(origin)?origin:(origin?"https://www.optyker.it":"*");
  return {"Access-Control-Allow-Origin":allow,"Vary":"Origin","Access-Control-Allow-Headers":"content-type, authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
}
function out(req:Request,x:any,status=200){return new Response(JSON.stringify(x),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8"}})}
function norm(v:any){return String(v??"").trim()}
function day(v:any){const x=norm(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(x))throw new Error("Data non valida");return x}
function money(v:any,label="Importo"){
  if(v===null||v===undefined||v==="")return 0;
  const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(label+" non valido");return Math.round(n*100)/100;
}
async function auth(body:any){
  const username=norm(body?.username),password=String(body?.password||"");
  if(!username||password.length<8)throw new Error("AUTH_REQUIRED");
  const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:username,p_password:password});
  if(error||!data?.ok)throw new Error(data?.error||"Credenziali non valide");
  return String(data.username||username);
}
async function rpc(name:string,args:any){const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
async function metrics(date:string){return await rpc("optyker_cash_day_metrics",{p_business_date:date})}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return out(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const b=await req.json().catch(()=>({}));
    const operator=await auth(b);
    const action=norm(b.action),p=b.payload||{},date=day(p.date);

    if(action==="status")return out(req,{ok:true,data:await metrics(date)});

    if(action==="open"){
      const current=await metrics(date);
      if(current?.closed)throw new Error("La cassa di oggi è già chiusa");
      if(current?.opened)throw new Error("La cassa di oggi è già aperta");
      await rpc("optyker_cash_admin_open_day",{
        p_business_date:date,
        p_operator:operator,
        p_opening_cash:money(p.opening_cash,"Fondo cassa"),
        p_opening_checks:0,
        p_notes:String(p.notes||"").slice(0,500)
      });
      return out(req,{ok:true,data:await metrics(date)});
    }

    if(action==="close"){
      const current=await metrics(date);
      if(current?.closed)throw new Error("La cassa di oggi è già chiusa");
      if(!current?.opened)throw new Error("Prima devi registrare l’apertura cassa");
      const counted=money(p.cash_counted,"Contante contato");
      const nextFund=money(p.next_opening_cash,"Fondo prossima apertura");
      if(nextFund>counted+0.005)throw new Error("Il fondo per la prossima apertura non può superare il contante contato");
      const openingChecks=money(current?.opening?.opening_checks||0,"Assegni apertura");
      await rpc("optyker_cash_admin_close_day",{
        p_business_date:date,
        p_operator:operator,
        p_cash_counted:counted,
        p_checks_counted:openingChecks,
        p_bank_deposit_cash:0,
        p_bank_deposit_checks:0,
        p_safe_deposit_cash:Math.round((counted-nextFund)*100)/100,
        p_safe_deposit_checks:0,
        p_notes:String(p.notes||"").slice(0,500)
      });
      return out(req,{ok:true,data:await metrics(date)});
    }

    return out(req,{ok:false,error:"Azione non riconosciuta"},400);
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    const authError=message==="AUTH_REQUIRED"||/Credenziali non valide/i.test(message);
    return out(req,{ok:false,error:message==="AUTH_REQUIRED"?"Sessione operatore non disponibile":message},authError?401:400);
  }
});
