import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Optyker <-> 360dialog (WhatsApp Cloud API, coexistence). The API key lives only in the D360_API_KEY secret.
const U=Deno.env.get('SUPABASE_URL')!,K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H={'Content-Type':'application/json',apikey:K,authorization:'Bearer '+K};
const D='https://waba-v2.360dialog.io';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'Content-Type':'application/json'}});
const admin=(u:string)=>['MICHAEL MOLOGNI','OTTICA VISUAL CARE'].includes(u.toUpperCase());
const key=()=>String(Deno.env.get('D360_API_KEY')||'').trim();
const sha=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function rpc(name:string,p:unknown){const r=await fetch(U+'/rest/v1/rpc/'+name,{method:'POST',headers:H,body:JSON.stringify(p)});return r.json().catch(()=>null)}
async function auth(b:any){if(!b.username||!b.password)throw new Error('Accedi a Optyker.');const x=await rpc('optyker_staff_login_internal',{p_username:String(b.username),p_password:String(b.password)});if(!x?.ok)throw new Error('Sessione non valida: accedi di nuovo a Optyker.');return String(x.username)}
async function d360(path:string,init:RequestInit={}){const k=key();if(!k)throw new Error('Chiave 360dialog non ancora salvata sul server (D360_API_KEY).');const r=await fetch(D+path,{...init,signal:AbortSignal.timeout(20000),headers:{'D360-API-KEY':k,'Content-Type':'application/json',...(init.headers||{})}});const t=await r.text();let x:any;try{x=JSON.parse(t)}catch{x={raw:t.slice(0,300)}}if(!r.ok){const m=x?.error?.error_user_msg||x?.error?.message||x?.meta?.developer_message||x?.errors?.[0]?.details||x?.raw||('HTTP '+r.status);const e=new Error('360dialog: '+m);(e as any).status=r.status;throw e}return x}
const digits=(v:any)=>String(v||'').replace(/\D/g,'');
// 9-10 cifre = numero nazionale (anche i cellulari che iniziano per 39, es. 392...): si aggiunge il prefisso.
// 11 cifre o più = già con prefisso internazionale (39... o estero).
function normalize(v:any,cc='39'){let d=digits(v);if(d.startsWith('00'))d=d.slice(2);if(!d)return'';if(d.length>=11)return d;return cc+d}
const webhookUrl=()=>U+'/functions/v1/optyker-whatsapp-webhook';
async function setupWebhook(u:string){const x=await d360('/v1/configs/webhook',{method:'POST',body:JSON.stringify({url:webhookUrl()})});await fetch(U+'/rest/v1/optyker_whatsapp_settings?id=eq.1',{method:'PATCH',headers:{...H,prefer:'return=minimal'},body:JSON.stringify({webhook_verified_at:new Date().toISOString(),updated_by:u,updated_at:new Date().toISOString()})});return x}
async function templates(){const x=await d360('/v1/configs/templates');return (x.waba_templates||x.data||[]).map((t:any)=>({name:t.name,language:t.language,status:t.status,category:t.category,rejected_reason:t.rejected_reason||''}))}
async function status(){if(!key())return {key_present:false};const health=await d360('/health_status').catch(e=>({error:String(e.message)}));const wh=await d360('/v1/configs/webhook').catch(e=>({error:String(e.message)}));const tpl=await templates().catch(e=>String(e.message));return {key_present:true,health,webhook:wh,templates:tpl}}
async function send(u:string,p:any,kind:'send_text'|'send_template'){
 const to=normalize(p.to);if(!to)throw new Error('Numero mancante.');
 const body:any={messaging_product:'whatsapp',recipient_type:'individual',to};
 if(kind==='send_text'){const m=String(p.message||'').trim();if(!m)throw new Error('Scrivi un messaggio.');body.type='text';body.text={body:m}}
 else{body.type='template';body.template={name:String(p.name||''),language:{code:String(p.language||'it')},components:p.components||[]}}
 const x=await d360('/messages',{method:'POST',body:JSON.stringify(body)});
 const wamid=x?.messages?.[0]?.id||null;
 let cid=p.client_id||null;if(!cid){cid=await rpc('optyker_find_client_by_phone',{p_phone:to}).catch(()=>null)||null}
 await fetch(U+'/rest/v1/optyker_whatsapp_messages',{method:'POST',headers:{...H,prefer:'return=minimal'},body:JSON.stringify({wamid,client_id:cid,phone:to,direction:'outbound',sender_name:u,message:kind==='send_text'?String(p.message):String(p.preview||('[Modello '+String(p.name)+']')),status:'sent',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),raw:x})});
 return {wamid};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return out({ok:false,error:'Metodo non consentito'},405);
 try{
  const b=await req.json().catch(()=>({}));const a=String(b.action||''),p=b.payload||{};
  if(a==='selfcheck'){
   // One-time server task started from the database; result is written to a private table, never returned.
   const h=await sha(String(b.token||''));
   const rows=await (await fetch(U+'/rest/v1/optyker_whatsapp_selfcheck?token_hash=eq.'+h+'&used_at=is.null&created_at=gt.'+encodeURIComponent(new Date(Date.now()-600000).toISOString())+'&select=id',{headers:H})).json();
   if(!rows?.[0])return out({ok:false},403);
   const r:any={};
   if(p.status)Object.assign(r,await status());
   if(p.setup_webhook)r.webhook_setup=await setupWebhook('SYSTEM').catch(e=>({error:String(e.message)}));
   if(Array.isArray(p.create_templates)){r.created=[];for(const t of p.create_templates)r.created.push({name:t.name,result:await d360('/v1/configs/templates',{method:'POST',body:JSON.stringify(t)}).catch(e=>({error:String(e.message)}))})}
   if(p.send_text)r.send=await send('OPTYKER',p.send_text,'send_text').catch(e=>({error:String(e.message)}));
   if(p.send_template)r.send=await send('OPTYKER',p.send_template,'send_template').catch(e=>({error:String(e.message)}));
   await fetch(U+'/rest/v1/optyker_whatsapp_selfcheck?id=eq.'+rows[0].id,{method:'PATCH',headers:{...H,prefer:'return=minimal'},body:JSON.stringify({result:r,used_at:new Date().toISOString()})});
   return out({ok:true});
  }
  const u=await auth(b);
  if(a==='status')return out({ok:true,data:await status()});
  if(a==='setup_webhook'){if(!admin(u))throw new Error('Solo l’amministrazione può configurare WhatsApp.');return out({ok:true,data:await setupWebhook(u)})}
  if(a==='templates')return out({ok:true,data:await templates()});
  if(a==='create_template'){if(!admin(u))throw new Error('Solo l’amministrazione.');const x=await d360('/v1/configs/templates',{method:'POST',body:JSON.stringify(p.template||{})});return out({ok:true,data:x})}
  if(a==='send_text'||a==='send_template')return out({ok:true,data:await send(u,p,a)});
  if(a==='eye_pref_get'||a==='eye_pref_set'){
   const cid=String(p.client_id||'');if(!/^[0-9a-f-]{36}$/i.test(cid))throw new Error('Cliente non valido.');
   if(a==='eye_pref_set'){
    const m=p.months==null||p.months===''?null:Number(p.months);if(m!==null&&!(Number.isInteger(m)&&m>=1&&m<=60))throw new Error('Intervallo non valido.');
    const r=m===null?await fetch(U+'/rest/v1/optyker_wa_client_prefs?client_id=eq.'+cid,{method:'DELETE',headers:{...H,prefer:'return=minimal'}})
     :await fetch(U+'/rest/v1/optyker_wa_client_prefs',{method:'POST',headers:{...H,prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({client_id:cid,eye_recall_months:m,updated_by:u,updated_at:new Date().toISOString()})});
    if(!r.ok)throw new Error('Impossibile salvare il richiamo.');
   }
   const info=await rpc('optyker_wa_eye_info',{p_client:cid});
   return out({ok:true,data:info});
  }
  return out({ok:false,error:'Azione non riconosciuta'},400);
 }catch(e){return out({ok:false,error:e instanceof Error?e.message:String(e)},400)}
});
