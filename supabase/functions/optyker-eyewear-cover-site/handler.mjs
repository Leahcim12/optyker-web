// Uses the existing opaque Shopify customer portal credential, never a supplied email/id.
import {validateReport} from '../optyker-eyewear-cover/handler.mjs';
export function createSiteHandler({url,serviceKey,fetcher=fetch}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return out({ok:false,error:'Metodo non consentito'},405);
  try{
   const reader=req.body?.getReader(),decoder=new TextDecoder();let text='',size=0;
   if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4400000){await reader.cancel();return out({ok:false,error:'Richiesta troppo grande'},413);}text+=decoder.decode(value,{stream:true});}
   text+=decoder.decode();let body;try{body=JSON.parse(text);}catch{return out({ok:false,error:'Richiesta non valida'},400);}
   if(typeof body.token!=='string'||body.token.length<32||body.token.length>200)return out({ok:false,error:'Accedi nuovamente dal tuo account Shopify'},401);
   if(!['list','get','request','report','certificate'].includes(body.action))return out({ok:false,error:'Azione non consentita'},400);
   let p={};for(const k of ['sheet_id','request_id','reason','eye','evidence_message_id','confirm','attachment_data','attachment_name','attachment_type'])if(Object.hasOwn(body.payload||{},k))p[k]=body.payload[k];
   async function rpc(action,payload){
    const r=await fetcher(url+'/rest/v1/rpc/optyker_eyewear_cover_site',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_token:body.token,p_action:action,p_payload:payload}),signal:AbortSignal.timeout(20000)});
    const x=await r.json().catch(()=>({}));if(!r.ok)throw Error('Garanzia temporaneamente non disponibile');return x;
   }
   // Authenticate and establish sheet ownership before processing a report file.
   if(body.action==='report'){const auth=await rpc('get',{sheet_id:p.sheet_id});if(!auth.ok)return out(auth,403);p=validateReport(p);}
   const data=await rpc(body.action,p);return out(data,data.ok?200:403);
  }catch(e){return out({ok:false,error:e?.name==='TimeoutError'?'Risposta non ricevuta: verifica lo stato prima di riprovare.':String(e?.message||'Operazione non riuscita')},400);}
 };
}
