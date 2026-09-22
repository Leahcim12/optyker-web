import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {sessionAction} from '../optyker-cash-sessions/actions.ts';
const U=Deno.env.get('SUPABASE_URL')||'',S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{...CORS,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 try{
  const raw=await req.text();if(raw.length>18000)throw new Error('Richiesta troppo grande');const b=JSON.parse(raw),a=String(b.action||'');
  if(a.startsWith('session_')||a==='status'||a==='preview'){
   const username=String(b.username||'').trim(),password=String(b.password||'');if(!username||password.length<8)return out({ok:false,error:'Sessione operatore non disponibile'},401);
   const {data,error}=await db.rpc('optyker_staff_login_internal',{p_username:username,p_password:password});if(error||data?.ok!==true)return out({ok:false,error:'Sessione operatore non valida'},401);
   return out({ok:true,data:await sessionAction(db,a==='status'||a==='preview'?'session_status':a,b.payload||{},String(data.username||username),false)});
  }
  const response=await fetch(U+'/functions/v1/optyker-cash-closure-api',{method:'POST',headers:{'Content-Type':'application/json'},body:raw});
  return new Response(await response.text(),{status:response.status,headers:{...CORS,'Content-Type':'application/json'}});
 }catch(e){return out({ok:false,error:e instanceof Error?e.message:'Operazione non disponibile'},400)}
});
