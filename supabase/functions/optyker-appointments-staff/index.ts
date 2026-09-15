import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get('SUPABASE_URL')||'',S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const H={'Content-Type':'application/json','apikey':S,'Authorization':'Bearer '+S};
const C={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:C});
const q=(v:any)=>encodeURIComponent(String(v??''));
async function rest(path:string,opt:any={}){const r=await fetch(`${U}/rest/v1/${path}`,{...opt,headers:{...H,...(opt.headers||{})}});const x=await r.json().catch(()=>null);if(!r.ok)throw Error(x?.message||x?.error||`Server ${r.status}`);return x}
async function rpc(name:string,body:any){return rest(`rpc/${name}`,{method:'POST',body:JSON.stringify(body||{})})}
async function getAppointment(id:string){
  const a=await rest(`optyker_appointments?select=*&id=eq.${q(id)}&limit=1`);
  if(!Array.isArray(a)||!a[0])throw Error('Appuntamento non trovato');
  const row=a[0];
  const [sv,st]=await Promise.all([
    rest(`optyker_appointment_services?select=id,name,color,requires_studio&id=eq.${q(row.service_id)}&limit=1`),
    row.studio_id?rest(`optyker_appointment_studios?select=id,name&id=eq.${q(row.studio_id)}&limit=1`):Promise.resolve([])
  ]);
  const service=Array.isArray(sv)?sv[0]:null,studio=Array.isArray(st)?st[0]:null;
  return {...row,service_name:service?.name||'',service_color:service?.color||'',requires_studio:service?.requires_studio!==false,studio_name:studio?.name||'Nessuno studio'};
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return out({ok:true});
  if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  try{
    const b=await req.json().catch(()=>({})),username=String(b.username||'').trim(),password=String(b.password||''),action=String(b.action||''),p=b.payload||{};
    if(!username)return out({ok:false,error:'Operatore mancante'},400);
    const allowed=await rpc('optyker_staff_allowed',{p_username:username,p_password:password});
    if(allowed!==true)return out({ok:false,error:'Operatore non autorizzato'},403);
    if(action==='get')return out({ok:true,data:await getAppointment(String(p.id||''))});
    if(action==='search')return out(await rpc('optyker_appointment_search_staff',{p_username:username,p_password:password,p_query:String(p.query||''),p_limit:Number(p.limit||30)}));
    if(action==='slots')return out(await rpc('optyker_appointment_slots',{
      p_service_id:p.service_id,p_date:p.date,p_operator:null,p_studio_id:p.studio_id||null,p_ignore_appointment_id:p.ignore_appointment_id||null
    }));
    if(action==='force_overlap_slots')return out(await rpc('optyker_force_overlap_candidates',{
      p_service_id:p.service_id,p_starts:p.starts_at,p_operator:p.operator_username||null,p_studio_id:p.studio_id||null
    }));
    if(action==='reschedule')return out(await rpc('optyker_appointment_reschedule_internal',{p_appointment_id:p.id,p_payload:{...p,forced_by:username}}));
    if(action==='status')return out(await rpc('optyker_appointments_api',{p_username:username,p_password:password,p_action:'appointment_status',p_payload:p}));
    return out({ok:false,error:'Azione non riconosciuta'},400);
  }catch(e){return out({ok:false,error:e instanceof Error?e.message:String(e)},500)}
});
