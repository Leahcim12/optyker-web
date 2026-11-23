/* Staff client history. Source values stay separate from live orders and prices. */
(function(){
'use strict';
if(window.OPTYKER_LAC_FOCUS_HISTORY)return;
window.OPTYKER_LAC_FOCUS_HISTORY='20260915-lac-history1';
const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const money=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)):'—';
const date=v=>/^\d{2}\/\d{2}\/\d{4}/.test(v||'')?v.slice(3,5)+'/'+v.slice(0,2)+'/'+v.slice(6,10):'—';
const selected=()=>String(window.clientCurrentId||'');
const owner=()=>{const c=window.OPTYKER_CLOUD||{};return [c.username||'',c.password||'',c.key||''].join('\n');};
let current='',session='',seq=0,data=null,status='',controller=null;
const hosts=['clientAnagraficaSection','clientLacPageExtras'];
function fieldList(parent,rows){const dl=make('dl',undefined,'lacFocusFields');for(const [label,value] of rows)if(value!==''&&value!=null){dl.append(make('dt',label),make('dd',String(value)));}parent.append(dl);}
function table(parent,head,rows){const wrap=make('div',undefined,'lacFocusTableWrap'),t=make('table'),thead=make('thead'),tr=make('tr');head.forEach(v=>tr.append(make('th',v)));thead.append(tr);t.append(thead);const body=make('tbody');rows.forEach(row=>{const tr=make('tr');row.forEach(v=>tr.append(make('td',v===''||v==null?'—':String(v))));body.append(tr);});t.append(body);wrap.append(t);parent.append(wrap);}
function supplyCard(s){
 const r=s.raw||{},d=make('details',undefined,'lacFocusSupply'),summary=make('summary');
 const products=[r.prodottoDx,r.prodottoSx].filter(Boolean),title=[...new Set(products)].join(' / ')||'Fornitura LAC';
 summary.append(make('span',date(r.data),'lacFocusDate'),make('strong',title),make('span',money(r.totale),'lacFocusAmount'));d.append(summary);
 const inner=make('div',undefined,'lacFocusSupplyBody');
 fieldList(inner,[['Riferimento',r.codiceFornitura||r.id],['Consegna',r.dataConsegna?date(r.dataConsegna):''],['Prossima fornitura',r.dataProssimaFornitura?date(r.dataProssimaFornitura):''],['Operatore',r.operatore]]);
 const eyes=[];for(const [eye,k] of [['OD','Dx'],['OS','Sx']])if(r['prodotto'+k]||r['descrizione'+k]||r['quantita'+k])eyes.push([eye,[r['marca'+k],r['prodotto'+k]].filter(Boolean).join(' · '),r['descrizione'+k],r['quantita'+k],r['lotto'+k],money(r['totaleLente'+k])]);
 if(eyes.length)table(inner,['Occhio','Prodotto','Parametri','Quantità','Lotto','Totale'],eyes);
 if(s.liquids?.length){inner.append(make('h4','Liquidi e accessori della fornitura'));table(inner,['Prodotto','Quantità','Lotto','Codice a barre','Totale'],s.liquids.map(l=>{const x=l.raw||{};return[x.descrizione,x.quantita,x.lotto,x.codiceABarre,money(x.totale)];}));}
 fieldList(inner,[['Totale lenti OD',r.totaleLenteDx!==''?money(r.totaleLenteDx):''],['Totale lenti OS',r.totaleLenteSx!==''?money(r.totaleLenteSx):''],['Totale liquidi',r.totaleLiquidi!==''?money(r.totaleLiquidi):''],['Totale fornitura',money(r.totale)]]);
 if(s.liquids?.length)inner.append(make('p','I liquidi sono riportati all’interno della fornitura. Gli importi sono quelli registrati in Focus.','lacFocusHint'));
 d.append(inner);return d;
}
function render(){
 for(const host of hosts){const root=$(host);if(!root)continue;let card=$('lacFocusHistory-'+host);if(!card){card=make('section',undefined,'lacFocusHistory');card.id='lacFocusHistory-'+host;root.append(card);}card.replaceChildren();
  if(!current||(!status&&(!data||!data.supplies?.length&&!data.unassigned_liquids?.length))){card.hidden=true;continue;}card.hidden=false;
  const header=make('div',undefined,'lacFocusHeader');header.append(make('h3','Storico venduto · LAC e liquidi'));const refresh=make('button','Aggiorna');refresh.type='button';refresh.onclick=()=>load(current);header.append(refresh);card.append(header);
  if(status){card.append(make('p',status));continue;}
  card.append(make('p',data.supplies.length+' forniture · '+data.liquid_count+' righe di liquidi e accessori','lacFocusHint'));
  for(const supply of data.supplies)card.append(supplyCard(supply));
  if(data.unassigned_liquids?.length){card.append(make('h4','Liquidi senza fornitura associata'));table(card,['Prodotto','Quantità','Lotto','Totale'],data.unassigned_liquids.map(l=>[l.raw.descrizione,l.raw.quantita,l.raw.lotto,money(l.raw.totale)]));}
 }
}
async function load(id){
 const c=window.OPTYKER_CLOUD||{},request=++seq,identity=owner();current=id;session=identity;data=null;status='Caricamento storico…';controller?.abort();render();
 if(!id||!c.username||!c.password||!c.key){status='';render();return;}
 const requestController=new AbortController();controller=requestController;const timer=setTimeout(()=>requestController.abort(),25000);
 try{const response=await fetch((c.root||'https://whgziwaegjzqsgcntesr.supabase.co')+'/rest/v1/rpc/optyker_client_details_api',{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:'get_lac_history',p_payload:{client_id:id}})});
  const result=await response.json();if(request!==seq||id!==selected()||identity!==owner())return;
  if(!response.ok||result.ok!==true||result.data?.client_id!==id)throw Error(result.error||'Impossibile caricare lo storico. Premi Aggiorna.');data=result.data;status='';render();
 }catch(e){if(request===seq&&id===selected()&&identity===owner()){status=e.name==='AbortError'?'Il caricamento ha impiegato troppo tempo. Premi Aggiorna.':e.message;render();}}finally{clearTimeout(timer);}
}
function clinical(snap){
 const panel=$('lacPanel');if(!panel)return;let card=$('lacFocusClinical');if(!card){card=make('section',undefined,'lacFocusHistory');card.id='lacFocusClinical';const target=$('lacDataView')||panel;target.prepend(card);}card.replaceChildren();
 const r=snap?.focusImport?.entity==='lac_clinical'?snap.focusImport.record:null;card.hidden=!r;if(!r)return;
 card.append(make('h3','Dati della scheda LAC importata'),make('p',date(r.data)+' · '+(r.codiceLentiContatto||r.id),'lacFocusHint'));
 card.append(make('h4','Lenti a contatto'));table(card,['Occhio','Marca e prodotto','Sfera','Cilindro','Asse','Addizione','Raggio','Diametro'],[['OD','Dx'],['OS','Sx']].map(([e,k])=>[e,[r['marca'+k],r['prodotto'+k]].filter(Boolean).join(' · '),r['sfera'+k],r['cilindro'+k],r['asse'+k],r['add'+k],r['rb1'+k],r['diametro'+k]]));
 card.append(make('h4','Prescrizione originale'));table(card,['Occhio','Sfera','Cilindro','Asse','Addizione','Prisma','Base'],[['OD','Dx'],['OS','Sx']].map(([e,k])=>[e,...['sfera','cilindro','asse','add','prisma','base'].map(f=>r[f+'L'+k])]));
 fieldList(card,[['Liquidi consigliati',r.liquidiConsigliati],['Prossimo controllo',r.prossimoControllo?date(r.prossimoControllo):''],['Controllato da',r.controllatoDa]]);
}
function hook(){
 const f=window.lacRestoreClientSheet;if(typeof f==='function'&&!f.lacFocusWrapped){const wrapped=function(s){const out=f.apply(this,arguments);clinical(s);return out;};wrapped.lacFocusWrapped=true;window.lacRestoreClientSheet=wrapped;}
 for(const name of ['clientCreateNewLacSheet','lacResetAll']){const old=window[name];if(typeof old==='function'&&!old.lacFocusWrapped){const wrapped=function(){const out=old.apply(this,arguments);clinical(null);return out;};wrapped.lacFocusWrapped=true;window[name]=wrapped;}}
}
function tick(){hook();const id=selected(),identity=owner(),c=window.OPTYKER_CLOUD||{};if(id!==current||identity!==session){clinical(null);load(id);return;}if(!c.username||!c.password||!c.key){data=null;status='';for(const host of hosts){const el=$('lacFocusHistory-'+host);if(el){el.replaceChildren();el.hidden=true;}}return;}for(const host of hosts)if($(host)&&!$('lacFocusHistory-'+host))render();}
setInterval(tick,650);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
})();
