const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../cash-closure-entrypoints.js'),'utf8');
function fixture(options={}){
 const ids=new Map(),listeners=[],calls=[];
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.style={};this.value='';this.disabled=false;this.textContent=''}
  setAttribute(k,v){this[k]=v}
  appendChild(n){n.parentNode=this;this.children.push(n);if(n.id)ids.set(n.id,n);return n}
  insertBefore(n,b){n.parentNode=this;this.children.splice(this.children.indexOf(b),0,n);return n}
  querySelector(s){for(const n of this.children){if(s[0]==='.'&&n.className===s.slice(1))return n;const x=n.querySelector(s);if(x)return x}return null}
  closest(){if(['optykerCashDayCloseBtn','optykerCashClosureBtn','optykerCashDayOpenBtn'].includes(this.id))return this;return this.parentNode?this.parentNode.closest():null}
 }
 const doc={getElementById:id=>ids.get(id)||null,createElement:tag=>new Node(tag),addEventListener:(name,fn,capture)=>listeners.push({name,fn,capture})};
 const sessions={open(kind,date,admin){if(sessions.busy)return;calls.push({kind,date,admin});ids.delete('csBusinessDate');const modal=new Node('div');modal.id='optykerCashSessionsModal';const card=modal.appendChild(new Node('div'));const body=card.appendChild(new Node('div'));body.className='csBody';ids.set(modal.id,modal)}};
 const window={OPTYKER_CASH_SESSIONS:options.noSessions?undefined:sessions};
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-09-24T22:15:15Z']))}static now(){return new Date('2026-09-24T22:15:15Z').getTime()}}
 const context=vm.createContext({window,document:doc,Date:FixedDate,Intl,isNaN,fetch(){throw new Error('No network or fiscal operations allowed in entrypoint test')}});
 vm.runInContext(source,context);
 function click(id,opts={}){
  const button=new Node('button');button.id=id;button.disabled=!!opts.disabled;
  const child=button.appendChild(new Node('span'));const text={nodeType:3,parentElement:child};
  const target=opts.shadow?new Node('host'):child;let stopped=0;
  const e={target,preventDefault(){stopped++},stopPropagation(){stopped++},stopImmediatePropagation(){stopped++}};
  if(!opts.noPath)e.composedPath=()=>[opts.text?text:child,button,target,doc,window];
  listeners.find(x=>x.name==='click').fn(e);return stopped;
 }
 return {doc,window,sessions,calls,click,context,ids};
}
test('header and footer open the review for the Rome date after midnight; no network',()=>{
 for(const id of ['optykerCashDayCloseBtn','optykerCashClosureBtn']){const f=fixture();assert.equal(f.click(id),3);assert.deepEqual(f.calls,[{kind:'close',date:'2026-09-25',admin:false}]);assert.equal(f.doc.getElementById('csBusinessDate').value,'2026-09-25')}
});
test('date selector can open the previous business day but does not request a fiscal close',()=>{
 const f=fixture();f.click('optykerCashDayCloseBtn');const input=f.doc.getElementById('csBusinessDate');input.value='2026-09-24';input.onchange();assert.deepEqual(f.calls[1],{kind:'close',date:'2026-09-24',admin:false});const controls=f.doc.getElementById('optykerCashSessionsModal').querySelector('.csDateAccess');assert.match(controls.children[1].textContent,/non stampa una chiusura fiscale RCH/);
});
test('invalid, future and empty dates do not change the context',()=>{
 for(const value of ['2026-09-26','2026-02-30','','wrong']){const f=fixture();f.click('optykerCashDayCloseBtn');const input=f.doc.getElementById('csBusinessDate');input.value=value;input.onchange();assert.equal(f.calls.length,1);assert.equal(input.value,'2026-09-25')}
});
test('pending submission cannot be replaced by another date',()=>{
 const f=fixture();f.click('optykerCashDayCloseBtn');const modal=f.doc.getElementById('optykerCashSessionsModal');const input=f.doc.getElementById('csBusinessDate');f.sessions.busy=true;input.value='2026-09-24';input.onchange();assert.equal(f.calls.length,1);assert.equal(f.doc.getElementById('optykerCashSessionsModal'),modal);assert.equal(input.value,'2026-09-25');
});
test('opening and history paths remain unchanged, with no closing controls added',()=>{
 const f=fixture();f.click('optykerCashDayOpenBtn');assert.equal(f.calls[0].kind,'open');assert.equal(f.doc.getElementById('csBusinessDate'),null);f.sessions.open('history','2026-09-24',true);assert.equal(f.doc.getElementById('csBusinessDate'),null);
});
test('administrator context is preserved across date changes',()=>{
 const f=fixture();f.sessions.open('close','2026-09-25',true);const input=f.doc.getElementById('csBusinessDate');input.value='2026-09-24';input.onchange();assert.equal(f.calls[1].admin,true);
});
test('handles shadow-retargeted clicks, text nodes and no composedPath fallback',()=>{
 for(const opts of [{shadow:true},{text:true},{noPath:true}]){const f=fixture();assert.equal(f.click('optykerCashClosureBtn',opts),3);assert.equal(f.calls.length,1)}
});
test('unavailable module and disabled or unrelated buttons are not intercepted',()=>{
 for(const [options,id,clickOptions] of [[{noSessions:true},'optykerCashDayCloseBtn',{}],[{},'optykerCashDayCloseBtn',{disabled:true}],[{},'unrelated',{}]]){const f=fixture(options);assert.equal(f.click(id,clickOptions),0);assert.equal(f.calls.length,0)}
});
test('installation is idempotent',()=>{const f=fixture();vm.runInContext(source,f.context);f.click('optykerCashClosureBtn');assert.equal(f.calls.length,1);assert.equal(f.doc.getElementById('optykerCashSessionsModal').querySelector('.csBody').parentNode.children.length,2)});
