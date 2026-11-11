/* Agenda 20261111: «Forza appuntamento» with busy studio/operator.
   Built production HTML, synthetic API responses only; no real appointments are read or written. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:950},serviceWorkers:'block'});
 const page=await context.newPage(),writes=[],forceCalls=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
 const studio1={id:'studio-1-test',name:'Studio 1',active:true},studio2={id:'studio-2-test',name:'Studio 2',active:true};
 const exam={id:'service-exam-test',name:'Analisi TEST',duration_minutes:90,requires_studio:true,active:true};
 const pickup={id:'service-pickup-test',name:'Ritiro TEST',duration_minutes:30,requires_studio:false,active:true};
 const op='MICHAEL MOLOGNI';
 // Rows as returned by optyker_force_booking_candidates for each scenario.
 const row=(s,o,studioBusy,operatorBusy,starts)=>({studio_id:s?s.id:null,studio_name:s?s.name:'Nessuno studio',operator_username:o,
   starts_at:starts,forced:true,studio_busy:studioBusy,operator_busy:operatorBusy,overlap:studioBusy||operatorBusy});
 let scenario='busy';
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());let b={};try{b=req.postDataJSON()||{}}catch{}
   if(req.method()!=='GET'||url.pathname.includes('/rest/v1/')||url.pathname.includes('/functions/v1/')){
     let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],messages:[]};
     if(url.pathname.includes('optyker-staff-auth'))data={ok:true,username:b.username||op,needs_password:false,has_email:true};
     if(url.pathname.endsWith('/optyker_appointments_api')){
       if(b.p_action==='bootstrap')data={ok:true,can_force_appointment:true,services:[exam,pickup],studios:[studio1,studio2],
         operators:[{username:op}],rules:[],settings_services:[exam,pickup],settings_studios:[studio1,studio2]};
       if(b.p_action==='force_studios'){
         const s=b.p_payload.starts_at;forceCalls.push(b.p_payload);
         if(b.p_payload.service_id===pickup.id)data={ok:true,data:[row(null,null,false,false,s),row(null,op,false,true,s)]};
         else if(scenario==='busy')data={ok:true,data:[row(studio1,null,true,false,s),row(studio1,op,true,true,s)]};
         else data={ok:true,data:[row(studio2,null,false,false,s),row(studio1,null,true,false,s)]};
       }
       if(b.p_action==='appointment_create'){writes.push(b.p_payload);data={ok:true,data:{id:'synthetic-'+writes.length,forced:true}}}
     }
     if(url.pathname.endsWith('/optyker_appointment_slots'))data={ok:true,data:[]};
     if(url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/rpc/'))data=[];
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(['www.optyker.it','optyker.it'].includes(url.hostname)){
     let rel=url.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve('_site',rel);
     if(file.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,
       contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'),
       body:fs.readFileSync(file)});
   }
   return route.fulfill({status:204,body:''});
 });
 const status=()=>page.locator('#oaNewStatus');
 async function openForced(service,time){
   await page.click('#oaNew');await page.waitForSelector('#oaNewModal.open');
   await page.selectOption('#oaService',service.id);
   await page.fill('#oaManualTime',time);await page.locator('#oaManualTime').dispatchEvent('change');
   await page.check('#oaForceClosed');await page.waitForFunction(()=>!document.getElementById('oaCreate').disabled);
 }
 async function confirm(last){
   await page.fill('#oaFirst','Synthetic');await page.fill('#oaLast',last);await page.fill('#oaPhone','3330000000');
   await page.click('#oaCreate');await page.waitForFunction(()=>!document.getElementById('oaNewModal').classList.contains('open'));
 }
 try{
   await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});
   const opts=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(o=>o.value).filter(Boolean));
   await page.selectOption('#optykerLoginOperator',opts.find(v=>/michael/i.test(v))||opts[0]);
   await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD');await page.click('.optykerLoginButton');
   await page.waitForFunction(()=>window.optykerAuthenticated===true);errors.length=0;
   await page.evaluate(()=>optykerOpenAppointments());

   // 1. Only studio for the service is busy: booking enabled, warning shown, overlap submitted.
   await openForced(exam,'03:00');
   const box=await page.locator('#oaForceBox').textContent();
   assert(box.includes('con studio occupato'),box);assert(box.includes('già occupati'),box);
   assert(!box.includes('restano bloccate'),box);
   await page.waitForFunction(()=>document.getElementById('oaNewStatus').textContent.includes('Studio 1 è già occupato'));
   assert(await status().evaluate(e=>e.classList.contains('warn')&&!e.classList.contains('bad')));
   assert.equal(await page.inputValue('#oaOperator'),'');
   await page.screenshot({path:process.env.AGENDA_FORCE_SCREENSHOT||'/tmp/agenda-force-occupied.png'});
   await page.selectOption('#oaOperator',op);
   await page.waitForFunction(()=>/Studio 1 è già occupato e MICHAEL MOLOGNI ha già un appuntamento/.test(document.getElementById('oaNewStatus').textContent));
   assert(!(await page.locator('#oaCreate').isDisabled()));
   await confirm('Studio occupato');
   assert.equal(writes.length,1);
   assert.equal(writes[0].force_time,true);assert.equal(writes[0].studio_id,studio1.id);assert.equal(writes[0].operator_username,op);

   // 2. A free studio exists: it is chosen first and no warning appears.
   scenario='free';
   await openForced(exam,'03:30');
   assert.equal((await status().textContent()).trim(),'');
   await confirm('Studio libero');
   assert.equal(writes.length,2);assert.equal(writes[1].studio_id,studio2.id);assert.equal(writes[1].operator_username,null);

   // 3. Service without studio: busy operator warned, unassigned booking clean.
   await openForced(pickup,'04:00');
   assert.equal((await status().textContent()).trim(),'');
   await page.selectOption('#oaOperator',op);
   await page.waitForFunction(()=>document.getElementById('oaNewStatus').textContent.includes('MICHAEL MOLOGNI ha già un appuntamento'));
   await page.selectOption('#oaOperator','');
   await page.waitForFunction(()=>document.getElementById('oaNewStatus').textContent.trim()==='');
   await confirm('Senza studio');
   assert.equal(writes.length,3);assert.equal(writes[2].studio_id,null);assert.equal(writes[2].force_time,true);

   // 4. Unchecking the force clears the warning and disables ordinary booking outside hours.
   scenario='busy';
   await openForced(exam,'05:00');
   await page.waitForFunction(()=>document.getElementById('oaNewStatus').classList.contains('warn'));
   await page.uncheck('#oaForceClosed');
   await page.waitForFunction(()=>!document.getElementById('oaNewStatus').classList.contains('warn'));
   assert(await page.locator('#oaCreate').isDisabled());
   await page.click('[data-oac="new"]');
   assert.equal(writes.length,3);assert(forceCalls.length>=4);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({ok:true,checks:['busy studio bookable with warning','busy operator named in warning','free studio preferred without warning',
     'service without studio','force texts updated','unchecking force restores ordinary rules'],synthetic_writes:writes.length,page_errors:errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
