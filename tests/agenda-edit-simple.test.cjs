const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('_site/index.html','utf8'),start=html.indexOf('<div id="oaManageModal"'),end=html.indexOf('<script id="optykerAppointmentsV10ManageJs">',start),script=html.slice(end).match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
for(const forced of [false,true])test('prefilled agenda saves existing information, forced='+forced,async()=>{
 const dom=new JSDOM(html.slice(start,end),{runScripts:'outside-only',url:'https://optyker.test'}),w=dom.window,calls=[];
 try{
 const item={created_at:'2026-10-02T08:00:00Z',updated_at:'2026-10-02T08:00:00Z',id:'a',service_id:'svc',studio_id:'studio',studio_name:'Studio 1',operator_username:forced?null:'Operatore TEST',starts_at:'2030-01-04T10:00:00Z',ends_at:'2030-01-04T11:15:00Z',first_name:'Anna',last_name:'TEST',email:'test@example.invalid',phone:'',status:'confirmed',notes:'Note già inserite',private_notes:'Private',staff_forced_overlap:forced};
 w.OPTYKER_CLOUD={root:'https://api.test',key:'synthetic',username:'staff',password:'synthetic'};
 w.alert=msg=>{throw Error(msg)};w.fetch=async(url,init)=>{const b=JSON.parse(init.body);calls.push(b);return {ok:true,json:async()=>b.action==='get'?{ok:true,data:item}:b.p_action==='bootstrap'?{ok:true,services:[{id:'svc',name:'Controllo'}],studios:[]}:{ok:true,data:[]}}};
 w.eval(script);w.optykerOpenAppointmentById('a');await new Promise(r=>w.setTimeout(r,0));
 const e=id=>w.document.getElementById(id);
 assert.equal(e('oaV10ScheduleOptions').hidden,true);assert.equal(e('oaV10Details').hidden,true);assert.equal(e('oaV10Notes').value,item.notes);assert.equal(e('oaV10First').value,'Anna');assert(e('oaV10CurrentSchedule').textContent.includes('75 minuti'));
 assert.equal(calls.filter(b=>['slots','force_overlap_slots'].includes(b.action)).length,0);
 e('oaV10Notes').value='Note modificate';e('oaV10Save').click();await new Promise(r=>w.setTimeout(r,0));
 const payload=calls.find(b=>b.action==='reschedule').payload;assert.equal(payload.starts_at,item.starts_at);assert.equal(payload.operator_username,item.operator_username);assert.equal(payload.studio_id,item.studio_id);assert.equal(payload.force_overlap,forced);assert.equal(payload.notes,'Note modificate');
 e('oaV10ChangeSchedule').click();await new Promise(r=>w.setTimeout(r,0));assert.equal(e('oaV10ScheduleOptions').hidden,false);assert(calls.some(b=>b.action===(forced?'force_overlap_slots':'slots')));
 }finally{w.close()}
});
