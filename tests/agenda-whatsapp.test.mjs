import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const {JSDOM,VirtualConsole}=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url)('jsdom');
const site=resolve(process.env.OPTYKER_TEST_SITE||'_site');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f){for(let i=0;i<120;i++){if(f())return;await pause(10)}assert.fail('Expected state not reached')}
async function fixture({metaReady=false}={}){
 const dom=new JSDOM(readFileSync(resolve(site,'index.html'),'utf8'),{url:'https://www.optyker.it',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window,$=id=>w.document.getElementById(id);
 const calls=[],state={bootFailure:false,listFailure:false,delay:null,waConnected:false},login=[];
 Object.assign(w,{AbortController,scrollTo:()=>{},requestAnimationFrame:f=>w.setTimeout(f,0),optykerAuthenticated:true,OPTYKER_CLOUD:{root:'https://example.invalid',key:'PUBLIC_TEST',username:'SYNTHETIC',password:'SYNTHETIC',clients:[{id:'client1',phone:'+39 333 1234567'}]},clientCurrentId:'client1'});
 w.showDashboard=()=>{$('dashboardPanel').style.display='block'};
 w.FB={init:()=>{},login:(cb,options)=>login.push({cb,options})};
 w.fetch=async(url,opts)=>{
  const p=JSON.parse(opts.body),action=p.p_action||p.action;calls.push(action);
  if(action==='bootstrap'){
   if(state.bootFailure)return Response.json({ok:false,error:'Server temporaneamente non disponibile'}, {status:503});
   return Response.json({ok:true,operators:[{username:'SYNTHETIC'}],services:[{id:'svc',name:'Visita',duration_minutes:30}],studios:[{id:'studio',name:'Studio 1'}],rules:[]});
  }
  if(action==='list'){
   if(state.delay)await state.delay;
   if(state.listFailure)throw Error('Connessione interrotta');
   const date=new Date(p.p_payload.from);date.setDate(date.getDate()+1);date.setHours(10);
   return Response.json({ok:true,data:[{id:'appt',starts_at:date.toISOString(),ends_at:new Date(+date+1800000).toISOString(),service_name:'Visita',service_color:'#1769aa',first_name:'Prova',last_name:'Agenda',operator_username:'SYNTHETIC',studio_id:'studio',studio_name:'Studio 1'}]});
  }
  if(action==='settings_get')return Response.json({ok:true,data:{connected:state.waConnected,enabled:state.waConnected,meta_app_id:'12345',meta_config_id:'67890',oauth_exchange_ready:metaReady,token_configured:state.waConnected}});
  if(action==='embedded_finish'){assert.ok(p.payload.code);state.waConnected=true;return Response.json({ok:true,data:{enabled:true}})}
  if(action==='test_connection')return Response.json({ok:true,data:{display_phone_number:'+39 TEST'}});
  if(action==='store_hours_list')return Response.json({ok:true,data:[]});
  throw Error('Unexpected request: '+action);
 };
 // Real assembled legacy routing, settings hub and calendar, including document capture.
 for(const id of ['optykerAppointmentsJs','optykerAppointmentsV2Js','optykerSidebarClicksJs','optykerSidebarPointerNavJs']){
  const s=$(id);assert.ok(s,id);w.eval(s.textContent);
 }
 w.eval(readFileSync(resolve(site,'whatsapp-connect.js'),'utf8'));
 w.eval(readFileSync(resolve(site,'optyker-sept11.js'),'utf8'));
 if(w.document.readyState==='loading')await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
 await pause(20);w.optykerShowOnlyRootPanel('dashboardPanel');
 return {dom,w,$,calls,state,login,async close(){await pause(5);w.close()}};
}
test('sidebar Agenda displays the calendar and appointments after Dashboard',async()=>{
 const x=await fixture();try{
  x.$('navAppointments').click();await until(()=>x.$('oaCalendar').textContent.includes('Agenda'));
  assert.equal(x.$('optykerAppointmentsPanel').hasAttribute('data-optyker-route-excluded'),false);
  assert.equal(x.$('optykerAppointmentsPanel').style.display,'block');assert.equal(x.$('dashboardPanel').style.display,'none');
  assert.equal(x.calls.filter(x=>x==='bootstrap').length,1);assert.equal(x.calls.filter(x=>x==='list').length,1);
  x.$('oaNext').click();await until(()=>x.calls.filter(x=>x==='list').length===2);
 }finally{await x.close()}
});
test('bootstrap failure is visible, stops busy state and Riprova loads again',async()=>{
 const x=await fixture();try{
  x.state.bootFailure=true;x.$('navAppointments').click();await until(()=>x.$('oaReload').textContent==='Riprova');
  assert.match(x.$('oaStatus').textContent,/Server/);assert.equal(x.$('optykerAppointmentsPanel').getAttribute('aria-busy'),'false');
  x.state.bootFailure=false;x.$('oaReload').click();await until(()=>x.$('oaCalendar').textContent.includes('Agenda'));
  assert.equal(x.$('oaReload').textContent,'Aggiorna');
 }finally{await x.close()}
});
test('list error removes stale dates; late data cannot reopen agenda over another module',async()=>{
 const x=await fixture();try{
  await x.w.optykerOpenAppointments();x.state.listFailure=true;x.$('oaNext').click();await until(()=>x.$('oaReload').textContent==='Riprova');
  assert.equal(x.$('oaCalendar').textContent,'');assert.match(x.$('oaStatus').textContent,/Connessione/);
  x.state.listFailure=false;let release;x.state.delay=new Promise(r=>release=r);
  const waiting=x.w.optykerOpenAppointments();await pause(10);x.w.showDashboard();release();await waiting;
  assert.equal(x.$('optykerAppointmentsPanel').style.display,'none');assert.equal(x.$('dashboardPanel').style.display,'block');
 }finally{await x.close()}
});
test('expired sessions show a useful error without making unauthenticated agenda requests',async()=>{
 const x=await fixture();try{
  x.w.OPTYKER_CLOUD.password='';await x.w.optykerOpenAppointments();
  assert.match(x.$('oaStatus').textContent,/Sessione scaduta/);assert.equal(x.calls.length,0);
 }finally{await x.close()}
});
test('WhatsApp shortcut opens a simple QR guide, no technical fields or fake connected state',async()=>{
 const x=await fixture();try{
  x.$('navWhatsAppConnect').click();await until(()=>x.calls.includes('settings_get'));await pause(120);
  assert.equal(x.$('optykerSettingsPanel').hasAttribute('data-optyker-route-excluded'),false);
  assert.equal(x.$('optykerSettingsWhatsAppPane').classList.contains('open'),true);
  assert.equal(x.$('waTechnicalDetails').open,false);assert.equal(x.$('waBusinessDetails').open,false);
  assert.equal(x.$('waBusinessConnect').hidden,true);assert.match(x.$('waBusinessState').textContent,/non attivo/);
  const a=x.$('waQuickConnect').querySelector('a');assert.equal(a.href,'https://web.whatsapp.com/');assert.equal(a.target,'_blank');
  assert.match(x.$('waQuickConnect').textContent,/non attiva gli invii automatici/);
  const link=x.$('waClientWeb');link.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(link.href,'https://wa.me/393331234567');
  assert.ok(!x.calls.includes('send'));assert.ok(!x.calls.includes('settings_save'));
 }finally{await x.close()}
});
test('Meta completion waits for OAuth and FINISH in either order and ignores duplicate events',async()=>{
 for(const first of ['finish','auth']){
  const x=await fixture({metaReady:true});try{
   x.w.optykerOpenWhatsAppSimple();await until(()=>x.$('waBusinessConnect').textContent==='Collega con Meta');
   x.$('waBusinessConnect').click();assert.equal(x.login.length,1,'login is invoked synchronously by click');
   const event=origin=>x.w.dispatchEvent(new x.w.MessageEvent('message',{origin,data:{type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{waba_id:'WABA',phone_number_id:'PHONE'}}}));
   event('https://attacker.invalid');assert.ok(!x.calls.includes('embedded_finish'));
   const auth=()=>x.login[0].cb({authResponse:{code:'SYNTHETIC_CODE'}});
   if(first==='finish')event('https://www.facebook.com');else auth();
   await pause(5);assert.ok(!x.calls.includes('embedded_finish'));
   if(first==='finish')auth();else event('https://www.facebook.com');
   event('https://www.facebook.com');await until(()=>x.$('waBusinessState').classList.contains('ok'));
   assert.equal(x.calls.filter(x=>x==='embedded_finish').length,1);assert.ok(x.calls.includes('test_connection'));
   assert.equal(x.$('waConnectStatus').textContent,'WhatsApp Business collegato.');
  }finally{await x.close()}
 }
});
