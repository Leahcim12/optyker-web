import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {createCancellationRunner} from './worker.mjs';
import {sha256} from '../optyker-ts-api/transport.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const run=createCancellationRunner(db);
Deno.serve(async req=>{
 const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(req.method!=='POST')return out({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 if(req.headers.get('origin'))return out({ok:false,code:'TS_UNAUTHORIZED'},403);
 const authorization=req.headers.get('authorization')||'';
 const action=new URL(req.url).searchParams.get('action')||'';
 if(!/^Bearer [a-f0-9]{64}$/.test(authorization)||!['cancel','reconcile'].includes(action))return out({ok:false,code:'TS_UNAUTHORIZED'},401);
 // Only a short-lived, single-use capability provisioned by an authenticated
 // project administrator can claim one specific cancellation. No request body
 // can choose a document, access credentials, or authorize another transmission.
 try{return out({ok:true,result:await run(sha256(authorization.slice(7)),action)});}
 catch(e){const code=e instanceof Error&&/^TS_[A-Z0-9_]+$/.test(e.message)?e.message:'TS_OPERATION_FAILED';return out({ok:false,code},code==='TS_UNAUTHORIZED'?401:503);}
});

