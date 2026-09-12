import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url);
const {JSDOM}=require('jsdom');
const source=readFileSync(new URL('../ts-connection.js',import.meta.url),'utf8');
const initial={ok:true,config:{username:'FIXTURE1',owner_code:'000-000-000000',owner_fiscal_code:'AAAAAA00A00A000A',business_vat:'00000000000',revision:1,password_saved:false,pin_saved:true},files:[]};
async function setup({admin=true,fail=false}={}) {
  const dom=new JSDOM('<body><button id="launcher">Sistema TS</button></body>',{url:'https://www.optyker.it',runScripts:'outside-only'});
  const w=dom.window,calls=[];
  w.AbortController=AbortController;w.OPTYKER_BILLING_ADMIN=admin;
  w.sessionStorage.setItem('optyker_billing_admin_token','fixture-session');
  w.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,body,headers:options.headers});
    if(body.action==='save'&&fail) return {ok:false,json:async()=>({ok:false,error:'Errore di salvataggio'})};
    return {ok:true,json:async()=>body.action==='save'?{...initial,config:{...initial.config,revision:2,password_saved:true}}:structuredClone(initial)};
  };
  w.document.querySelector('#launcher').focus();w.eval(source);await w.OPTYKER_TS_CONNECTION.open();
  return {w,dom,calls};
}
for(const fail of [false,true]) test('secrets clear after '+(fail?'failed':'successful')+' save and never enter browser storage',async()=>{
  const {w,dom,calls}=await setup({fail});try{
    const form=w.document.querySelector('#otsForm');assert.equal(form.elements.otsPassword.type,'password');assert.equal(form.elements.otsPin.type,'password');
    form.elements.otsPassword.value='fixture-password';form.elements.otsPin.value='1234567890';
    await form.onsubmit({preventDefault(){}});
    assert.equal(calls[1].body.password,'fixture-password');assert.equal(calls[1].body.pin,'1234567890');
    assert.ok(calls.every(c=>c.url.startsWith('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-ts-api')));
    assert.equal(w.document.querySelector('#otsPassword').value,'');assert.equal(w.document.querySelector('#otsPin').value,'');
    assert.equal(w.sessionStorage.length,1);assert.equal(w.localStorage.length,0);
    assert.ok(!w.document.body.innerHTML.includes('fixture-password'));
    assert.match(w.document.body.textContent,/Invio TS da attivare/);
    w.document.querySelector('header button').click();assert.equal(w.document.activeElement.id,'launcher');
  }finally{dom.window.close();}
});
test('ordinary operator cannot call protected endpoint',async()=>{
  const {w,dom,calls}=await setup({admin:false});try{
    assert.equal(calls.length,0);assert.equal(w.document.querySelector('#otsForm'),null);assert.match(w.document.body.textContent,/Accedi come Amministrazione/);
  }finally{dom.window.close();}
});
test('saved credentials stay hidden and a blank password preserves the existing secret',async()=>{
  const {w,dom,calls}=await setup();try{
    const form=w.document.querySelector('#otsForm');assert.equal(form.elements.otsPin.value,'');
    await form.onsubmit({preventDefault(){}});assert.equal(calls[1].body.password,null);assert.equal(calls[1].body.pin,null);
  }finally{dom.window.close();}
});
