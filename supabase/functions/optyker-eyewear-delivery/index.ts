import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import * as lib from 'npm:pdf-lib@1.17.1';
import pngjs from 'npm:pngjs@7.0.0';
import {service} from './service.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const run=service(db,lib,pngjs.PNG);
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'Metodo non consentito'}),{status:405,headers});
 try{const raw=await req.text();if(raw.length>700000)throw Error('Richiesta troppo grande');const x=await run(JSON.parse(raw));return new Response(JSON.stringify(x),{headers});}
 catch(e){const m=e instanceof Error?e.message:'Operazione non riuscita';const unauth=m==='AUTH_REQUIRED'||m==='Operatore non autorizzato';return new Response(JSON.stringify({ok:false,error:unauth?'Accedi con un operatore autorizzato.':m}),{status:unauth?401:400,headers});}
});
