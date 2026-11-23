// Cassa 20261123: stato del blocco stampa RCH (chiusura del giorno precedente o del periodo di chiusura).
// Solo lettura: autentica l'operatore e restituisce public.optyker_cash_print_gate. Nessun comando alla RCH.
import {createClient} from 'npm:@supabase/supabase-js@2.116.0';

const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 let body:any;
 try{
  const raw=await req.text();
  if(raw.length>4000)return out({ok:false,error:'Richiesta troppo grande'},413);
  body=JSON.parse(raw||'{}');
 }catch{return out({ok:false,error:'Richiesta non valida'},400);}
 const username=String(body?.username||'').trim(),password=String(body?.password||'');
 // Stesso controllo delle altre API cassa: nessun tentativo di accesso senza una password plausibile.
 if(!username||password.length<8)return out({ok:false,error:'Sessione operatore non disponibile'},401);
 try{
  const login=await db.rpc('optyker_staff_login_internal',{p_username:username,p_password:password});
  if(login.error||login.data?.ok!==true)return out({ok:false,error:'Sessione operatore non valida'},401);
  const gate=await db.rpc('optyker_cash_print_gate',{p_register_code:'main'});
  if(gate.error||!gate.data)return out({ok:false,error:'Stato della chiusura RCH non disponibile'},503);
  return out({ok:true,data:gate.data});
 }catch{return out({ok:false,error:'Stato della chiusura RCH non disponibile'},503);}
});
