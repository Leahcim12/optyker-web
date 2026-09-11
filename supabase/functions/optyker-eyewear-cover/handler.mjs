/* Authorization derives the user from Supabase Auth, never from browser-provided client IDs. */
export function validateReport(p){
 const d=p.attachment_data;
 if(typeof d!=='string'||d.length>4200000)throw Error('Allega un PDF o una foto della denuncia, massimo 3 MB.');
 const m=/^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(d);
 if(!m)throw Error('Formato denuncia non supportato. Usa PDF, JPEG, PNG o WebP.');
 let b;try{b=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));}catch{throw Error('Allegato non leggibile');}
 const ascii=(a,n)=>String.fromCharCode(...b.slice(a,a+n));
 const ok=m[1]==='application/pdf'?ascii(0,5)==='%PDF-':m[1]==='image/png'?b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':m[1]==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP';
 if(!ok||b.length<30||b.length>3*1024*1024)throw Error('Il file non corrisponde al formato dichiarato o supera 3 MB.');
 return {...p,attachment_type:m[1],attachment_name:String(p.attachment_name||'Denuncia').replace(/[\r\n\x00-\x1f]/g,'').slice(0,180)};
}
export function createHandler({url,anonKey,serviceKey,fetcher=fetch}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
 const out=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return out({ok:false,error:'Metodo non consentito'},405);
  try{
   const auth=req.headers.get('authorization')||'';
   if(!/^Bearer\s+\S+$/i.test(auth))return out({ok:false,error:'Accedi nuovamente all’app'},401);
   const u=await fetcher(url+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:auth},cache:'no-store',signal:AbortSignal.timeout(15000)});
   const user=await u.json().catch(()=>({}));
   if(!u.ok||!user.id||!user.email_confirmed_at)return out({ok:false,error:'Sessione scaduta o email non confermata'},401);
   if(Number(req.headers.get('content-length')||0)>4400000)return out({ok:false,error:'Richiesta troppo grande'},413);
   // Read with a byte limit as well: chunked requests need the same protection.
   const reader=req.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
   if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4400000){await reader.cancel();return out({ok:false,error:'Richiesta troppo grande'},413);}text+=decoder.decode(value,{stream:true});}
   text+=decoder.decode();let b;try{b=JSON.parse(text);}catch{return out({ok:false,error:'Richiesta non valida'},400);}
   if(!['get','request','report','certificate'].includes(b.action))return out({ok:false,error:'Azione non consentita'},400);
   let p={};for(const k of ['sheet_id','request_id','reason','eye','evidence_message_id','confirm','attachment_data','attachment_name','attachment_type'])if(Object.hasOwn(b.payload||{},k))p[k]=b.payload[k];
   if(b.action==='report')p=validateReport(p);
   const r=await fetcher(url+'/rest/v1/rpc/optyker_eyewear_cover_customer',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:user.id,p_action:b.action,p_payload:p}),signal:AbortSignal.timeout(20000)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)return out({ok:false,error:'Garanzia temporaneamente non disponibile. Riprova o contatta l’ottica.'},503);
   return out(data,data.ok===true?200:400);
  }catch(e){return out({ok:false,error:e?.name==='TimeoutError'?'Risposta non ricevuta: aggiorna lo stato prima di riprovare.':String(e?.message||'Operazione non riuscita')},400);}
 };
}
