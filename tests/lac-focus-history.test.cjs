const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(require('node:path').join(__dirname,'../lac-focus-history.js'),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this._text='';this.hidden=false;}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}
 set innerHTML(v){throw Error('Unsafe HTML injection');}
 append(...nodes){this.children.push(...nodes);}
 prepend(...nodes){this.children.unshift(...nodes);}
 replaceChildren(...nodes){this._text='';this.children=nodes;}
}
function descendants(el){return [el,...el.children.flatMap(descendants)];}
function setup(){
 const body=new Element('body');for(const id of ['clientAnagraficaSection','clientLacPageExtras','lacPanel','lacDataView']){const el=new Element('section');el.id=id;body.append(el);}
 const document={readyState:'complete',createElement:t=>new Element(t),getElementById:id=>descendants(body).find(e=>e.id===id)};
 const pending=[],calls=[];let tick;
 const w={document,clientCurrentId:A,OPTYKER_CLOUD:{root:'https://example.invalid',username:'SYNTHETIC',password:'SYNTHETIC',key:'SYNTHETIC'},lacRestoreClientSheet(){},clientCreateNewLacSheet(){},lacResetAll(){}};
 const context={window:w,document,Intl,Number,String,Set,AbortController,setTimeout,clearTimeout,setInterval:f=>{tick=f;},fetch:(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 vm.runInNewContext(source,context);
 const reply=(index,id,products=[])=>pending[index].resolve({ok:true,json:async()=>({ok:true,data:{client_id:id,supplies:products,liquid_count:products.reduce((n,x)=>n+(x.liquids?.length||0),0),unassigned_liquids:[]}})});
 return {w,body,document,calls,pending,reply,tick:()=>tick(),card:()=>document.getElementById('lacFocusHistory-clientAnagraficaSection')};
}
const settle=()=>new Promise(r=>setImmediate(r));
const supply=(name,total='50')=>({id:name,raw:{data:'09/07/2023 00:00:00',prodottoDx:name,quantitaDx:'1',totaleLenteDx:'40',totaleLenteSx:'',totaleLiquidi:'10',totale:total},liquids:[{raw:{descrizione:'Liquido <img onerror=alert(1)>',quantita:'1',lotto:'00123',totale:'10'}}]});
test('source dates, net total, liquid detail and text escaping are preserved',async()=>{
 const x=setup();x.reply(0,A,[supply('Lente A')]);await settle();
 assert.match(x.card().textContent,/07\/09\/2023/);assert.match(x.card().textContent,/50,00/);assert.match(x.card().textContent,/Liquido <img onerror=alert\(1\)>/);assert.match(x.card().textContent,/00123/);assert.doesNotMatch(x.card().textContent,/60,00/);
 assert.equal(x.calls[0].body.p_action,'get_lac_history');assert.equal(x.calls[0].body.p_payload.client_id,A);
});
test('switching clients discards a late response from the previous client',async()=>{
 const x=setup();x.w.clientCurrentId=B;x.tick();x.reply(1,B,[supply('Lente B','0')]);await settle();x.reply(0,A,[supply('Lente A')]);await settle();
 assert.match(x.card().textContent,/Lente B/);assert.match(x.card().textContent,/0,00/);assert.doesNotMatch(x.card().textContent,/Lente A/);
});
test('logout clears records and does not issue another request',async()=>{
 const x=setup();x.reply(0,A,[supply('Lente A')]);await settle();x.w.OPTYKER_CLOUD.password='';x.tick();
 assert.equal(x.card().hidden,true);assert.equal(x.card().textContent,'');assert.equal(x.calls.length,1);
});
test('server errors remain visible and refresh retries the selected client',async()=>{
 const x=setup();x.pending[0].reject(Error('Errore di rete'));await settle();assert.match(x.card().textContent,/Errore di rete/);
 descendants(x.card()).find(el=>el.tagName==='button').onclick();x.reply(1,A,[supply('Ripristinata')]);await settle();assert.match(x.card().textContent,/Ripristinata/);assert.doesNotMatch(x.card().textContent,/Errore di rete/);
});
test('clinical source view separates contact powers from original prescription',async()=>{
 const x=setup();x.reply(0,A,[]);await settle();x.w.lacRestoreClientSheet({focusImport:{entity:'lac_clinical',record:{data:'09/07/2023',sferaDx:'-4',sferaLDx:'-3.75',prodottoDx:'Multifocale'}}});
 const card=x.document.getElementById('lacFocusClinical');assert.equal(card.hidden,false);assert.match(card.textContent,/Lenti a contatto/);assert.match(card.textContent,/Prescrizione originale/);assert.match(card.textContent,/-3.75/);
 x.w.lacRestoreClientSheet({});assert.equal(card.hidden,true);assert.equal(card.textContent,'');
});
