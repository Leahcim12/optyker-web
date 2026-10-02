const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const shared=fs.readFileSync('appointment-duration.js','utf8');
(async()=>{
  const extra=process.env.CHROMIUM_MODULE?require(process.env.CHROMIUM_MODULE):null;
  const browser=await chromium.launch(extra?{executablePath:process.env.CHROME_EXECUTABLE_PATH||await extra.executablePath(),args:extra.args,headless:true}:{headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Europe/Rome'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    const source=fs.readFileSync('_site/iphone-app-v13/index.html','utf8');
    const render=source.slice(source.indexOf('function staffAgendaMarkup(){'),source.indexOf('function staffShiftMarkup(){'));
    await page.setContent('<main id="content"></main>');
    await page.addScriptTag({content:`
      var state={me:{role:'staff'},staffAgendaStart:'2030-03-04',staffAgenda:[{id:'a',starts_at:'2030-03-04T09:00:00Z',ends_at:'2030-03-04T09:30:00Z',first_name:'Anna',last_name:'TEST',status:'confirmed',service_name:'Controllo',updated_at:'2026-10-02T09:00:00Z'}]};
      var APPT='synthetic',writes=[],fail=false;
      var esc=s=>String(s||''),fmtTime=s=>new Date(s).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      function staffMonday(d){return d}function staffPlus(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
      function staffDateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
      async function call(endpoint,action,p){if(fail)throw Error('Sovrapposizione');writes.push({endpoint,action,p});state.staffAgenda[0].ends_at=new Date(new Date(state.staffAgenda[0].starts_at).getTime()+p.duration_minutes*60000).toISOString();return {ok:true,data:state.staffAgenda[0]}}
      function loadStaffAgenda(){document.getElementById('content').innerHTML=staffAgendaMarkup()}
      ${render}\n${shared}\n${fs.readFileSync('iphone-app-v13/appointment-duration.js','utf8')}
      loadStaffAgenda();`});
    await page.click('[data-appointment-duration="a"]');await page.fill('#optykerDurationMinutes','75');
    await page.evaluate(()=>fail=true);await page.click('#optykerDurationDialog [type=submit]');
    await page.waitForFunction(()=>document.querySelector('[data-status]').textContent==='Sovrapposizione');
    assert.equal(await page.inputValue('#optykerDurationMinutes'),'75');
    await page.evaluate(()=>fail=false);await page.click('#optykerDurationDialog [type=submit]');
    await page.waitForSelector('#optykerDurationDialog',{state:'detached'});
    assert.deepEqual(await page.evaluate(()=>writes.map(w=>[w.action,w.p.duration_minutes])),[['duration',75]]);
    assert((await page.locator('.staffApptTime').textContent()).includes('11:15'));
    await page.screenshot({path:'/tmp/appointment-duration-app.png'});
    await page.evaluate(()=>{state.me.role='customer';loadStaffAgenda()});
    assert.equal(await page.locator('[data-appointment-duration]').count(),0);

    // Execute the actual published staff website agenda, with synthetic API data.
    const staff=fs.readFileSync('_site/staff-embed/index.html','utf8');
    const script=staff.match(/<script id="staffAppointmentsJs">([\s\S]*?)<\/script>/)[1];
    await page.goto('about:blank');await page.setContent('<nav class="nav"><button id="tabAgenda">Agenda</button></nav><section id="panelAgenda" class="panel"><div id="saRange"></div><div id="saStatus"></div><div id="saCalendar"></div><div id="saBookWrap"><iframe id="saBookFrame"></iframe></div></section>'+['saPrev','saNext','saToday','saNew','saBookClose'].map(id=>'<button id="'+id+'">'+id+'</button>').join(''));
    await page.addScriptTag({content:`
      var writes=[];var start=new Date();start.setMinutes(start.getMinutes()+60);
      var a={id:'site-a',starts_at:start.toISOString(),ends_at:new Date(start.getTime()+30*60000).toISOString(),status:'confirmed',first_name:'Anna',last_name:'TEST'};
      window.fetch=async function(url,init){var b=JSON.parse(init.body);if(b.action==='duration'){writes.push(b);a.ends_at=new Date(start.getTime()+b.payload.duration_minutes*60000).toISOString();return Response.json({ok:true,data:a})}return Response.json({ok:true,data:[a]})};
      ${shared}\n${script}`});
    await page.click('#tabAgenda');await page.click('[data-appointment-duration="site-a"]');
    await page.fill('#optykerDurationMinutes','45');await page.click('#optykerDurationDialog [type=submit]');
    await page.waitForSelector('#optykerDurationDialog',{state:'detached'});
    assert.deepEqual(await page.evaluate(()=>writes.map(w=>[w.action,w.payload.duration_minutes])),[['duration',45]]);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({ok:true,checks:['app edits and refreshes real agenda markup','failed save retains duration for retry','customer role has no duration action','staff website submits duration and reloads shared agenda'],page_errors:errors}));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
