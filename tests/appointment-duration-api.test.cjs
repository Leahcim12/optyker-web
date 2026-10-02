const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
async function invoke(name,body,options={}){
  let handler;const calls=[];
  const sandbox={Request,Response,URL,console,Deno:{env:{get:()=> 'synthetic'},serve:fn=>handler=fn},fetch:async(url,init)=>{
    const path=String(url);calls.push({path,body:init?.body?JSON.parse(init.body):null});
    if(path.includes('/auth/v1/user'))return Response.json(options.noAuth?{}:{id:'user',email:options.email||'staff@example.invalid',email_confirmed_at:options.unverified?null:'2026-01-01'}, {status:options.noAuth?401:200});
    if(path.includes('optyker_operator_profiles?'))return Response.json(options.unlinked?[]:[{username:'Verified Operator',email:'staff@example.invalid'}]);
    if(path.includes('optyker_clients?'))return Response.json([{id:'customer'}]);
    if(path.endsWith('optyker_staff_allowed'))return Response.json(!options.denied);
    if(path.endsWith('optyker_appointment_set_duration'))return Response.json({ok:true,data:{id:'appointment',ends_at:'2030-03-04T04:15:00Z'}});
    throw Error('Unexpected API call '+path);
  }};
  let code=fs.readFileSync('supabase/functions/'+name+'/index.ts','utf8').replace(/^import[^\n]+\n/,'');
  vm.runInNewContext(stripTypeScriptTypes(code),sandbox,{filename:name+'.ts'});
  const req=new Request('https://synthetic.invalid/function?t='+('a'.repeat(32)),{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify(body)});
  const response=await handler(req);return {status:response.status,data:await response.json(),writes:calls.filter(x=>x.path.endsWith('optyker_appointment_set_duration'))};
}
const payload={id:'appointment',duration_minutes:75,username:'Forged Operator',expected_updated_at:'2026-10-02T09:00:00Z'};
test('app accepts only a verified session with exactly linked staff email',async()=>{
  for(const options of [{noAuth:true},{unverified:true},{unlinked:true},{email:'st%ff@example.invalid'}]){
    const r=await invoke('optyker-mobile-appointments',{action:'duration',payload},options);
    assert.equal(r.data.ok,false);assert.equal(r.writes.length,0);
  }
  const r=await invoke('optyker-mobile-appointments',{action:'duration',payload});
  assert.equal(r.data.ok,true);assert.equal(r.writes.length,1);
  assert.equal(r.writes[0].body.p_username,'Verified Operator');assert.equal(r.writes[0].body.p_minutes,75);
});
test('desktop authenticates the operator before writing duration',async()=>{
  const b={username:'Verified Operator',password:'synthetic',action:'duration',payload};
  const bad=await invoke('optyker-appointments-staff',b,{denied:true});assert.equal(bad.status,403);assert.equal(bad.writes.length,0);
  const good=await invoke('optyker-appointments-staff',b);assert.equal(good.data.ok,true);assert.equal(good.writes[0].body.p_username,b.username);
});
test('staff website derives the actor from the private staff token',async()=>{
  const bad=await invoke('optyker-shopify-staff-appointments',{action:'duration',payload},{unlinked:true});assert.equal(bad.status,403);assert.equal(bad.writes.length,0);
  const good=await invoke('optyker-shopify-staff-appointments',{action:'duration',payload});assert.equal(good.data.ok,true);assert.equal(good.writes[0].body.p_username,'Verified Operator');
});
