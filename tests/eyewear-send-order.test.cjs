/* Run the real saved-sheet controllers against a DOM and synthetic RPC responses. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
function source(file) {
  if(process.env.OPTYKER_BUILT!=='1')return fs.readFileSync(path.join(root,file),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'_site/client-sheets-version.json'),'utf8'));
  const filename=Object.keys(manifest.assets).find(name=>name.startsWith(file.replace('.js','.'))&&name.endsWith('.js'));
  assert(filename,'Built asset missing: '+file);
  return fs.readFileSync(path.join(root,'_site',filename),'utf8');
}
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><section id="clientsPanel"><div id="clientAnagraficaSection"></div><nav id="clientPageNav"></nav></section></body></html>', {url:'https://optyker.test/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, calls = [], events = [], intervals = [];
  const stamp = '2026-09-15T10:00:00Z';
  const job = {id:'job-1',client_id:'client-1',sheet_type:'eyewear_job',document_type:'Busta',reference_code:'1B26',updated_at:stamp,created_at:stamp,data:{mode:'job',frame:{type:'Nuova',brand:'TEST',model:'MODELLO'},lens:{lens_type_od:'Monofocale',lens_type_os:'Monofocale',treatments:[]},pricing:{total:320}}};
  const quote = {...job,id:'quote-1',sheet_type:'eyewear_quote',document_type:'Preventivo',reference_code:'1P26',data:{...job.data,mode:'quote'}};
  let approve = true, response = {ok:true,data:{id:'order-1',reference_code:'1B26',status:'da_fare'}}, pending;
  let labOpened = 0;
  w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  w.HTMLDialogElement.prototype.close = function(){this.open=false;w.setTimeout(()=>this.dispatchEvent(new w.Event('close')),0);};
  w.setInterval = fn => {intervals.push(fn);return intervals.length;};
  w.confirm = () => approve;
  w.optykerAuthenticated = true;
  w.clientCurrentId = 'client-1';
  w.OPTYKER_CLOUD = {root:'https://api.test',username:'Operatore TEST',password:'synthetic-only',key:'synthetic-only',clients:[{id:'client-1',name:'Cliente',surname:'TEST'}],sheets:{'client-1':[job,quote]}};
  w.openLaboratory = () => {labOpened++;};
  w.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if(url.endsWith('/optyker_eyewear_order_api')) {
      calls.push(body);
      if(pending)await pending.promise;
      return {ok:true,json:async()=>response};
    }
    assert(url.endsWith('/optyker_client_sheet_actions'));
    assert.equal(body.p_action,'list');
    return {ok:true,json:async()=>({ok:true,data:body.p_payload.client_id==='client-1'?[job,quote]:[]})};
  };
  for(const name of ['optyker:sheet-order-created','optyker:client-cart-updated'])w.addEventListener(name,e=>events.push({name,detail:e.detail}));
  for(const file of ['client-sheet-actions.js','client-sheet-edit.js'])w.eval(source(file));
  const click = selector => {const el=d.querySelector(selector);assert(el,selector);el.click();return el;};
  return {w,d,calls,events,job,quote,click,intervals,
    approve(value){approve=value;},respond(value){response=value;},
    hold(){let release;const promise=new Promise(r=>release=r);pending={promise,release};return release;},
    labOpened:()=>labOpened,
    async open(detail=false){w.OPTYKER_CLIENT_SHEETS.open('eyewear');await flush();if(detail){click('[data-cs-id="job-1"] [data-cs-open]');intervals.forEach(fn=>fn());}}
  };
}

test('Busta list and detail expose Invia ordine; quotes retain their conversion flow', async t => {
  const h=setup(t);await h.open();
  assert.equal(h.d.querySelector('[data-cs-id="job-1"] [data-cs-send-order]').textContent,'Invia ordine');
  assert.equal(h.d.querySelector('[data-cs-id="quote-1"] [data-cs-send-order]'),null);
  assert(h.d.querySelector('[data-cs-id="quote-1"] [data-cs-convert]'));
  h.click('[data-cs-id="job-1"] [data-cs-open]');
  assert(h.d.querySelector('.csBottom [data-cs-send-order]'));
  assert.equal(h.calls.length,0);
});

test('cancel makes no request; confirmed double click sends the saved Busta once and locks editing', async t => {
  const h=setup(t);await h.open(true);h.approve(false);h.click('[data-cs-send-order]');assert.equal(h.calls.length,0);
  h.approve(true);const release=h.hold();const b=h.click('[data-cs-send-order]');b.click();h.intervals.forEach(fn=>fn());
  assert.equal(h.calls.length,1);assert(b.disabled);assert(h.d.querySelector('[data-cs-edit-existing]').disabled);
  assert.deepEqual(h.calls[0].p_payload,{client_id:'client-1',source_sheet_id:'job-1',updated_at:h.job.updated_at});
  assert.equal(h.calls[0].p_action,'submit');assert.equal(h.calls[0].p_username,'Operatore TEST');
  release();await flush();
  assert.match(h.d.querySelector('[data-cs-feedback]').textContent,/Ordine inviato al Laboratorio.*1B26/);
  assert.equal(h.d.querySelector('[data-cs-send-order]'),null);assert(h.d.querySelector('[data-cs-delete]').disabled);
  assert.equal(h.events.length,2);assert(h.events.every(e=>e.detail.client_id==='client-1'));
  h.click('[data-cs-lab]');assert.equal(h.labOpened(),1);assert.equal(h.calls.length,1);
});

test('sending directly from the list works without loading the eyewear editor', async t => {
  const h=setup(t);await h.open();h.click('[data-cs-id="job-1"] [data-cs-send-order]');await flush();
  assert.equal(h.calls.length,1);assert(h.d.querySelector('.csBottom [data-cs-lab]'));
  assert.equal(h.w.optykerEyewearOrderBridge,undefined);
});

test('already submitted Busta opens the existing laboratory order and reports its current state', async t => {
  const h=setup(t);h.respond({ok:true,already_sent:true,data:{id:'order-1',status:'pronto_consegna'}});await h.open(true);h.click('[data-cs-send-order]');await flush();
  assert.match(h.d.querySelector('[data-cs-feedback]').textContent,/già presente.*Pronto per la consegna/);
  h.click('[data-cs-back]');assert.equal(h.d.querySelector('[data-cs-id="job-1"] [data-cs-send-order]'),null);
  h.click('[data-cs-id="job-1"] [data-cs-lab]');assert.equal(h.calls.length,1);
});

test('server error retains the Busta and restores actions without claiming success', async t => {
  const h=setup(t);h.respond({ok:false,error:'La Busta è stata aggiornata: ricarica prima di inviarla'});await h.open(true);h.click('[data-cs-send-order]');await flush();
  assert.match(h.d.querySelector('[data-cs-feedback]').textContent,/ricarica/);
  assert.equal(h.d.querySelector('[data-cs-send-order]').disabled,false);
  assert.equal(h.d.querySelector('[data-cs-refresh]').disabled,false);
  assert.equal(h.job.laboratory_order,undefined);assert.equal(h.events.length,0);
});

test('an incomplete success response does not mark the Busta as sent', async t => {
  const h=setup(t);h.respond({ok:true,data:{}});await h.open(true);h.click('[data-cs-send-order]');await flush();
  assert.match(h.d.querySelector('[data-cs-feedback]').textContent,/Invio non confermato/);
  assert.equal(h.job.laboratory_order,undefined);assert.equal(h.events.length,0);
});

test('changing client while awaiting the server cannot update another customer view', async t => {
  const h=setup(t);await h.open(true);const release=h.hold();h.click('[data-cs-send-order]');
  h.w.clientCurrentId='client-2';h.intervals.forEach(fn=>fn());release();await flush();
  assert.equal(h.d.querySelector('#clientSheetDialog'),null);assert.equal(h.events.length,0);
  assert.equal(h.job.laboratory_order,undefined);
});
