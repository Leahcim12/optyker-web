/* Production HTML/controls, synthetic API responses only; no real appointments. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const matches=require('../client-search-match.js');
const clients=[{id:'11111111-1111-4111-8111-111111111111',name:'José',surname:'D’Angelo Rossi',phone:'+39 333 123-4567',home_phone:'035 123 456',email:'test@example.invalid'},
 {id:'22222222-2222-4222-8222-222222222222',name:'Anna',surname:'Bianchi',phone:'3339999999',email:'other@example.invalid'}];
for(const q of ['Jose','ROSSI','Jose Rossi','Rossi Jose','d angelo','3331234567','333 123 4567','+393331234567','00393331234567','035123456','Rossi 1234567'])assert(matches(clients[0],q),q);
assert(!matches(clients[0],'Bianchi'));assert(!matches(clients[0],'12349999'));
(async()=>{
 const extra=process.env.CHROMIUM_MODULE?require(process.env.CHROMIUM_MODULE):null;
 const browser=await chromium.launch(extra?{executablePath:process.env.CHROME_EXECUTABLE_PATH||await extra.executablePath(),args:extra.args,headless:true}:{headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:950},serviceWorkers:'block'});
 const page=await context.newPage(),writes=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
 const service={id:'service-test',name:'Controllo TEST',duration_minutes:30,requires_studio:true,active:true};
 const studio={id:'studio-test',name:'Studio TEST',active:true};
 let forceDelay=0,manageDelay=0;
 const edits=[],durations=[];
 let appointment={id:'synthetic-edit',service_id:service.id,studio_id:studio.id,studio_name:studio.name,
   operator_username:'Michael Mologni',first_name:'Anna',last_name:'Bianchi',email:'test@example.invalid',phone:'',
   starts_at:'2030-03-04T02:00:00.000Z',ends_at:'2030-03-04T02:30:00.000Z',status:'confirmed',source:'web',
   service_name:service.name,updated_at:'2026-10-02T09:00:00.000Z',created_at:'2026-10-02T09:00:00.000Z'};
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());let b={};try{b=req.postDataJSON()||{}}catch{}
   if(req.method()!=='GET'||url.pathname.includes('/rest/v1/')||url.pathname.includes('/functions/v1/')){
     let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],messages:[]};
     if(url.pathname.includes('optyker-staff-auth'))data={ok:true,username:b.username||'Michael Mologni',needs_password:false,has_email:true};
     if(url.pathname.endsWith('/optyker_api')&&b.p_action==='list_clients')data={ok:true,data:clients};
     if(url.pathname.endsWith('/optyker_appointments_api')){
       if(b.p_action==='bootstrap')data={ok:true,can_force_appointment:true,services:[service],studios:[studio],operators:[{username:'Michael Mologni'}],rules:[],settings_services:[service],settings_studios:[studio]};
       if(b.p_action==='force_studios'){
         if(forceDelay)await new Promise(r=>setTimeout(r,forceDelay));
         data={ok:true,data:[{studio_id:studio.id,studio_name:studio.name,operator_username:null,starts_at:b.p_payload.starts_at,forced:true}]};
       }
       if(b.p_action==='appointment_create'){writes.push(b.p_payload);data={ok:true,data:{id:'synthetic-appointment'}}}
     }
     if(url.pathname.endsWith('/optyker_appointment_slots'))data={ok:true,data:[]};
     if(url.pathname.endsWith('/optyker-appointments-staff')){
       if(b.action==='get')data={ok:true,data:appointment};
       if(b.action==='force_overlap_slots'){
         if(manageDelay)await new Promise(r=>setTimeout(r,manageDelay));
         data={ok:true,data:[{studio_id:studio.id,studio_name:studio.name,operator_username:null,starts_at:b.payload.starts_at,forced_overlap:true}]};
       }
       if(b.action==='reschedule'){edits.push(b.payload);appointment={...appointment,...b.payload,staff_forced_overlap:b.payload.force_overlap};data={ok:true,data:appointment}}
       if(b.action==='duration'){durations.push(b.payload);appointment={...appointment,ends_at:new Date(new Date(appointment.starts_at).getTime()+b.payload.duration_minutes*60000).toISOString()};data={ok:true,data:appointment}}
     }
     if(url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/rpc/'))data=[];
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(['www.optyker.it','optyker.it'].includes(url.hostname)){
     let rel=url.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve('_site',rel);
     if(file.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'),body:fs.readFileSync(file)});
   }
   return route.fulfill({status:204,body:''});
 });
 try{
   await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});
   const op=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.find(x=>/michael/i.test(x.value))?.value);
   await page.selectOption('#optykerLoginOperator',op);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD');await page.click('.optykerLoginButton');
   await page.waitForFunction(()=>window.optykerAuthenticated&&OPTYKER_CLOUD.clients.length===2);errors.length=0;
   for(const q of ['Jose','Rossi','Jose Rossi','Rossi Jose','3331234567','035123456']){
     await page.fill('#optykerGlobalSearchInput',q);
     await page.waitForFunction(()=>document.getElementById('optykerGlobalSearchResults').textContent.includes('D’Angelo Rossi'));
     const texts=await page.evaluate(q=>{document.getElementById('clientArchiveSearch').value=q;clientRefreshList();document.getElementById('dashboardClientSearch').value=q;dashboardRenderClients();return ['clientArchiveList','dashboardClientResults'].map(id=>document.getElementById(id).textContent)},q);
     texts.forEach(t=>assert(t.includes('D’Angelo Rossi'),q+': '+JSON.stringify(texts)));
   }
   await page.fill('#optykerGlobalSearchInput','');
   await page.evaluate(()=>optykerOpenAppointments());await page.click('#oaNew');await page.waitForSelector('#oaNewModal.open');
   assert.equal(await page.locator('select#oaClient').count(),0);assert.equal(await page.locator('#oaClientResults button').count(),0);
   await page.fill('#oaClientSearch','3331234567');await page.waitForSelector('#oaClientResults button');
   await page.locator('#oaClientSearch').press('ArrowDown');await page.keyboard.press('Enter');
   assert.equal(await page.inputValue('#oaClient'),clients[0].id);assert.equal(await page.inputValue('#oaFirst'),'José');assert.equal(await page.inputValue('#oaPhone'),clients[0].phone);
   await page.fill('#oaClientSearch','Bianchi');await page.waitForFunction(()=>document.getElementById('oaClientResults').textContent.includes('Bianchi'));
   assert.equal(await page.inputValue('#oaClient'),'');assert.equal(await page.inputValue('#oaFirst'),'');
   await page.locator('#oaClientResults button').click();assert.equal(await page.inputValue('#oaClient'),clients[1].id);
   await page.selectOption('#oaService',service.id);await page.fill('#oaManualTime','03:00');await page.locator('#oaManualTime').dispatchEvent('change');
   await page.check('#oaForceClosed');await page.waitForFunction(()=>!document.getElementById('oaCreate').disabled);
   assert.equal(await page.inputValue('#oaOperator'),'');assert((await page.locator('#oaOperator').textContent()).includes('Non assegnato'));
   await page.click('#oaCreate');await page.waitForFunction(()=>!document.getElementById('oaNewModal').classList.contains('open'));
   assert.equal(writes.length,1);assert.equal(writes[0].operator_username,null);assert.equal(writes[0].force_time,true);assert.equal(writes[0].studio_id,studio.id);assert.equal(writes[0].client_id,clients[1].id);
   await page.click('#oaNew');assert.equal(await page.inputValue('#oaClientSearch'),'');assert.equal(await page.inputValue('#oaClient'),'');assert.equal(await page.locator('#oaClientResults button').count(),0);
   await page.selectOption('#oaService',service.id);await page.fill('#oaManualTime','03:00');await page.locator('#oaManualTime').dispatchEvent('change');
   forceDelay=300;await page.check('#oaForceClosed');await page.uncheck('#oaForceClosed');await page.waitForTimeout(600);
   assert(await page.locator('#oaCreate').isDisabled(),'late forced response must not enable ordinary booking');
   assert.equal(writes.length,1);assert.deepEqual(errors,[]);
   await page.click('[data-oac="new"]');
   await page.evaluate(()=>optykerOpenAppointmentById('synthetic-edit'));await page.waitForSelector('#oaManageModal.open');
   await page.check('#oaV10ForceOccupied');
   await page.waitForFunction(()=>document.getElementById('oaV10ForceChoice').value==='0');
   assert((await page.locator('#oaV10ForceChoice').textContent()).includes('Non assegnato'));
   await page.click('#oaV10Save');await page.waitForFunction(()=>!document.getElementById('oaManageModal').classList.contains('open'));
   assert.equal(edits.length,1);assert.equal(edits[0].operator_username,null);assert.equal(edits[0].force_overlap,true);
   await page.evaluate(()=>optykerOpenAppointmentById('synthetic-edit'));await page.waitForSelector('#oaManageModal.open');
   await page.click('#oaV10Duration');await page.fill('#optykerDurationMinutes','75');
   assert((await page.locator('#optykerDurationDialog [data-end]').textContent()).includes('04:15'));
   await page.click('#optykerDurationDialog [type=submit]');await page.waitForSelector('#optykerDurationDialog',{state:'detached'});
   assert.equal(durations.length,1);assert.equal(durations[0].duration_minutes,75);
   assert((await page.locator('#oaV10Details').textContent()).includes('75 minuti'));
   manageDelay=300;await page.fill('#oaV10ForceTime','04:00');await page.locator('#oaV10ForceTime').dispatchEvent('change');
   await page.uncheck('#oaV10ForceOccupied');await page.waitForTimeout(600);
   assert(!(await page.locator('#oaV10Status').textContent()).includes('Forzatura pronta'),'late reply must not restore a forced selection');
   assert.deepEqual(errors,[]);
   await page.screenshot({path:process.env.AGENDA_TEST_SCREENSHOT||'/tmp/agenda-search-verified.png'});
   console.log(JSON.stringify({ok:true,checks:['name/surname/either order/accent/phone search on all three native surfaces','agenda search with keyboard selection and field reset','forced appointment submitted without operator','forced rescheduling without operator','duration saved with new end time','ordinary booking and late-response guards preserved'],synthetic_writes:writes.length+edits.length+durations.length,page_errors:errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
