import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')||'';
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const BOOK=`${U}/functions/v1/optyker-appointments-booking?source=shopify`;
const cors={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'
};
const out=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:cors});
async function db(path:string,opt:any={}){
  const r=await fetch(`${U}/rest/v1/${path}`,{...opt,headers:{apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json',...(opt.headers||{})}});
  const x=await r.json().catch(()=>null);
  if(!r.ok) throw new Error(x?.message||x?.error||`Server ${r.status}`);
  return x;
}
async function rpc(name:string,body:any){
  return db(`rpc/${name}`,{method:'POST',body:JSON.stringify(body||{})});
}
async function operatorFor(token:string){
  const q=encodeURIComponent(token);
  const a=await db(`optyker_operator_profiles?select=username&shopify_staff_token=eq.${q}&limit=1`);
  return Array.isArray(a)&&a[0]?.username?String(a[0].username):'';
}
async function listAppointments(p:any){
  const from=encodeURIComponent(String(p?.from||''));
  const to=encodeURIComponent(String(p?.to||''));
  const rows=await db(`optyker_appointments?select=*,optyker_appointment_services(name,color,requires_studio),optyker_appointment_studios(name)&starts_at=gte.${from}&starts_at=lt.${to}&order=starts_at.asc`);
  return (Array.isArray(rows)?rows:[]).map((r:any)=>({
    ...r,
    service_name:r.optyker_appointment_services?.name||'',
    service_color:r.optyker_appointment_services?.color||'#1769aa',
    requires_studio:r.optyker_appointment_services?.requires_studio!==false,
    studio_name:r.optyker_appointment_studios?.name||'Nessuno studio',
    optyker_appointment_services:undefined,
    optyker_appointment_studios:undefined
  }));
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return out({ok:false,error:'Metodo non consentito'},405);
  try{
    const u=new URL(req.url),token=(u.searchParams.get('t')||'').trim();
    if(token.length<24) return out({ok:false,error:'Accesso non autorizzato'},403);
    const username=await operatorFor(token);
    if(!username) return out({ok:false,error:'Accesso non autorizzato'},403);

    const b=await req.json().catch(()=>({})),action=String(b.action||''),p=b.payload||{};
    if(action==='duration')return out(await rpc('optyker_appointment_set_duration',{p_username:username,p_appointment_id:p.id,p_minutes:p.duration_minutes,p_expected_updated_at:p.expected_updated_at||null}));
    if(action==='booking') return out({ok:true,url:BOOK});
    if(action==='bootstrap') return out(await rpc('optyker_appointment_public_config',{}));
    if(action==='list'){
      const data=await listAppointments(p);
      return out({ok:true,data});
    }
    if(action==='create'){
      return out(await rpc('optyker_book_appointment',{p_payload:{...p,source:'staff',created_by:username}}));
    }
    if(action==='status'){
      const id=String(p.id||''),status=String(p.status||'');
      if(!id||!['confirmed','completed','cancelled','no_show'].includes(status)) return out({ok:false,error:'Dati appuntamento non validi'},400);
      await db(`optyker_appointments?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
      return out({ok:true});
    }
    return out({ok:false,error:'Azione non consentita'},403);
  }catch(e){return out({ok:false,error:e instanceof Error?e.message:String(e)},500)}
});
