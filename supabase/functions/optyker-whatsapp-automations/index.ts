import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Runs every minute from pg_cron. Sends due WhatsApp automations through 360dialog, once per job_key.
// Invii lenti e uno alla volta: al massimo MAX_PER_RUN per esecuzione, PAUSE_MS tra un invio e l'altro,
// un solo messaggio per numero a ogni esecuzione.
// Se 360dialog risponde "troppe richieste" (429, limite dell'endpoint) o con un errore temporaneo, il job viene
// liberato (nessuna riga di log) e l'esecuzione si ferma: verrà ritentato al minuto successivo.
// Il motivo dell'ultimo blocco è restituito in last_retry (visibile nelle risposte di pg_net).
const U=Deno.env.get('SUPABASE_URL')!,K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H={'Content-Type':'application/json',apikey:K,authorization:'Bearer '+K};
const MAX_PER_RUN=12,PAUSE_MS=2500;
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function rpc(name:string,p:unknown={}){const r=await fetch(U+'/rest/v1/rpc/'+name,{method:'POST',headers:H,body:JSON.stringify(p)});const x=await r.json().catch(()=>null);if(!r.ok)throw new Error(name+': '+JSON.stringify(x).slice(0,300));return x}
const digits=(v:any)=>String(v||'').replace(/\D/g,'');
function normalize(v:any,cc='39'){let d=digits(v);if(d.startsWith('00'))d=d.slice(2);if(!d)return'';if(d.startsWith(cc)&&d.length>9)return d;return cc+d}
const key=()=>String(Deno.env.get('D360_API_KEY')||'').trim();
class Retry extends Error{}
async function approved():Promise<Set<string>>{const r=await fetch('https://waba-v2.360dialog.io/v1/configs/templates',{signal:AbortSignal.timeout(20000),headers:{'D360-API-KEY':key()}});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error('templates HTTP '+r.status);return new Set((x.waba_templates||x.data||[]).filter((t:any)=>String(t.status).toLowerCase()==='approved'&&String(t.language).startsWith('it')).map((t:any)=>String(t.name)))}
async function send(to:string,template:string,params:string[]){
 if(!key())throw new Error('D360_API_KEY mancante');
 const components=params.length?[{type:'body',parameters:params.map(t=>({type:'text',text:String(t)}))}]:[];
 let r:Response;
 try{r=await fetch('https://waba-v2.360dialog.io/messages',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'D360-API-KEY':key(),'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'template',template:{name:template,language:{code:'it'},components}})})}
 catch(e){throw new Retry('rete: '+String((e as Error).message))}
 const x=await r.json().catch(()=>({}));
 const code=Number(x?.error?.code||0);
 const detail=String(x?.error?.error_data?.details||x?.error?.message||x?.meta?.developer_message||x?.errors?.[0]?.details||x?.errors?.[0]?.title||'').slice(0,200);
 const after=r.headers.get('retry-after');
 // 360dialog segnala il proprio limite dell'endpoint anche con HTTP 400 ("exceeded the endpoint rate limit").
 if(r.status===429||r.status>=500||[4,80007,130429,131048,131056].includes(code)||/rate.?limit|too many/i.test(detail))
  throw new Retry('HTTP '+r.status+(code?' codice '+code:'')+(after?' retry-after '+after:'')+(detail?' · '+detail:''));
 if(!r.ok)throw new Error(detail||('HTTP '+r.status));return x}
Deno.serve(async req=>{
 if(req.method!=='POST')return out({ok:false},405);
 const b=await req.json().catch(()=>({}));
 if(!(await rpc('optyker_wa_cron_ok',{p_token:String(b.token||'')}).catch(()=>false)))return out({ok:false},403);
 const due:any[]=await rpc('optyker_wa_due');const res={due:due.length,sent:0,failed:0,skipped:0,waiting_template:0,retry_later:0,last_retry:''};
 if(!due.length)return out({ok:true,...res});
 let ok:Set<string>;try{ok=await approved()}catch(e){return out({ok:false,error:String((e as Error).message),...res})}
 let attempts=0;const phones=new Set<string>();
 for(const j of due){
  if(!ok.has(String(j.template))){res.waiting_template++;continue}
  if(attempts>=MAX_PER_RUN){res.retry_later++;continue}
  const to=normalize(j.phone);
  // Un solo messaggio per numero a ogni esecuzione (stesso numero per più familiari): gli altri al minuto dopo.
  if(to.length>=11&&phones.has(to)){res.retry_later++;continue}
  const ins=await fetch(U+'/rest/v1/optyker_wa_automation_log',{method:'POST',headers:{...H,prefer:'return=representation,resolution=ignore-duplicates'},body:JSON.stringify({job_key:j.job_key,kind:j.kind,client_id:j.client_id,appointment_id:j.appointment_id,phone:to,status:to.length>=11?'sending':'skipped',error:to.length>=11?null:'Numero non valido'})});
  const claimed=await ins.json().catch(()=>[]);if(!Array.isArray(claimed)||!claimed.length||to.length<11){res.skipped++;continue}
  phones.add(to);
  const jk=encodeURIComponent(j.job_key);
  const patch=(x:any)=>fetch(U+'/rest/v1/optyker_wa_automation_log?job_key=eq.'+jk,{method:'PATCH',headers:{...H,prefer:'return=minimal'},body:JSON.stringify(x)});
  if(attempts>0)await sleep(PAUSE_MS);
  attempts++;
  try{
   const x=await send(to,j.template,Array.isArray(j.params)?j.params:[]);const wamid=x?.messages?.[0]?.id||null;
   await patch({status:'sent',wamid,sent_at:new Date().toISOString(),error:null});
   await fetch(U+'/rest/v1/optyker_whatsapp_messages',{method:'POST',headers:{...H,prefer:'return=minimal'},body:JSON.stringify({wamid,client_id:j.client_id,phone:to,direction:'outbound',sender_name:'Automazione',message:j.preview,status:'sent',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),raw:x})});
   res.sent++;
  }catch(e){
   if(e instanceof Retry){
    // Libera il job: verrà ripreso alla prossima esecuzione. Fermati qui per non insistere.
    await fetch(U+'/rest/v1/optyker_wa_automation_log?job_key=eq.'+jk+'&status=eq.sending',{method:'DELETE',headers:{...H,prefer:'return=minimal'}});
    res.last_retry=String((e as Error).message).slice(0,300);console.error('optyker-whatsapp-automations retry',res.last_retry);
    res.retry_later++;break;
   }
   await patch({status:'failed',error:String((e as Error).message).slice(0,500)});res.failed++;
  }
 }
 return out({ok:true,...res});
});
