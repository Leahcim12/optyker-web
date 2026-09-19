/* Native-browser regression: no MutationObserver override or production credentials.
 * Local runs mock all service calls. LIVE_LOGIN=1 allows only public status reads;
 * it never submits a login, resets a password or reads client records.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const live=process.env.LIVE_LOGIN==='1';
const base=process.env.LOGIN_URL||'http://127.0.0.1:8766/';
const output=process.env.LOGIN_OUTPUT||'/tmp/login-check';
fs.mkdirSync(output,{recursive:true});
const watchdog=setTimeout(()=>{console.error('FAIL: login event loop did not finish');process.exit(1)},110000);
(async()=>{
  const browser=await chromium.launch({headless:true});
  const cases=live?[{name:'live-desktop',width:1440,height:1000}]:[
    {name:'desktop',width:1440,height:1000},
    {name:'remembered',width:1440,height:1000,remembered:true},
    {name:'mobile',width:390,height:844}
  ];
  const results=[];
  for(const c of cases){
    const context=await browser.newContext({viewport:{width:c.width,height:c.height},serviceWorkers:'block'});
    const page=await context.newPage();page.setDefaultTimeout(9000);
    const errors=[],posts=[];let statusReads=0;
    page.on('pageerror',e=>errors.push(String(e).slice(0,250)));
    await context.route('**/*',async route=>{
      const r=route.request(),u=new URL(r.url());
      if(r.method()==='POST'){
        let body={};try{body=r.postDataJSON()||{}}catch(_){}
        posts.push({endpoint:u.pathname,action:body.action||''});
        if(u.pathname.endsWith('/optyker-staff-auth')&&body.action==='status'){
          statusReads++;
          if(live)return route.continue();
          return route.fulfill({json:{ok:true,username:body.username,has_email:true,needs_password:false}});
        }
        return route.fulfill({status:401,json:{ok:false,error:'Password di prova non valida'}});
      }
      if(!live && !['127.0.0.1','localhost'].includes(u.hostname))return route.abort();
      return route.continue();
    });
    await page.addInitScript(({remembered})=>{
      if(remembered)localStorage.setItem('optyker_login_username','MICHAEL');
      window.__loginTest={ticks:0,mutations:0,caption:0};
      setInterval(()=>window.__loginTest.ticks++,100);
      new MutationObserver(ms=>{
        window.__loginTest.mutations+=ms.length;
        for(const m of ms){
          if(m.type==='childList'&&m.target.nodeName==='SPAN'&&m.target.parentElement?.querySelector('#optykerExtra-luogoDiNascita'))window.__loginTest.caption++;
        }
      }).observe(document,{subtree:true,childList:true});
    },{remembered:!!c.remembered});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:20000});
    if(!live){
      const html=await page.content();assert.ok(html.includes('20260919-profile-loop1'),'wrong profile adapter build');
    }
    await page.locator('#optykerLoginScreen').waitFor({state:'visible'});
    await page.waitForTimeout(1500);
    const select=page.locator('#optykerLoginOperator');
    if(await page.locator('#optykerChangeUser').isVisible())await page.locator('#optykerChangeUser').click();
    const options=await select.locator('option').evaluateAll(a=>a.map(o=>({value:o.value,text:o.textContent})).filter(o=>o.value&&!/admin|amministratore/i.test(o.value+' '+o.text)));
    assert.ok(options.length,'operator options missing');
    const preferred=options.find(o=>/michael/i.test(o.value))||options[0];
    await select.selectOption(preferred.value);
    const password=page.locator('#optykerAuthPassword');
    await password.waitFor({state:'visible'});
    await page.waitForTimeout(150);
    await password.click();await password.fill('LOGIN_UI_TEST_20260919');
    await page.waitForTimeout(2500);
    assert.equal(await password.inputValue(),'LOGIN_UI_TEST_20260919','typing erased by a render loop');
    const state=await page.evaluate(()=>({stats:window.__loginTest,active:document.activeElement?.id,authenticated:window.optykerAuthenticated===true,ready:document.readyState}));
    assert.equal(state.active,'optykerAuthPassword','focus stolen from password');
    assert.ok(state.stats.ticks>=20,'timers starved');assert.ok(state.stats.caption<8,'birthplace observer loops');
    assert.equal(state.authenticated,false,'test must not authenticate');
    await password.fill('');
    if(!live){
      await password.fill('LOGIN_UI_TEST_20260919');
      await page.locator('#optykerLoginScreen .optykerLoginButton').click();
      await page.waitForFunction(()=>/Password di prova non valida/.test(document.getElementById('optykerLoginError').textContent));
      assert.equal(await page.evaluate(()=>window.optykerAuthenticated===true),false,'rejected login must stay unauthenticated');
      await password.fill('');
    }
    assert.ok(statusReads>=1,'operator status was not requested');
    if(live)assert.ok(!posts.some(p=>p.action==='login'||p.action==='reset'||p.action==='forgot'),'live test submitted credentials');
    await page.screenshot({path:path.join(output,c.name+'.png')});
    const result={name:c.name,typing:true,focusRetained:true,userSelection:true,protected:!state.authenticated,nativeObserver:true,ticks:state.stats.ticks,captionMutations:state.stats.caption,totalMutations:state.stats.mutations,statusReads,errors};
    results.push(result);console.log('LOGIN_BROWSER_PASS',JSON.stringify(result));
    await context.close();
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  await browser.close();clearTimeout(watchdog);
})().catch(e=>{console.error(e);process.exit(1)});
