"""Deterministic source changes; staged on an isolated release branch, never user data."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
MARK='OPTYKER_SEPT11_PREPARED'
def one(s,old,new):
    if s.count(old)!=1:raise RuntimeError('Source contract missing/ambiguous: '+old[:110])
    return s.replace(old,new,1)
def edit(path,fn):
    p=ROOT/path;s=p.read_text()
    if MARK in s:return
    p.write_text('/* '+MARK+' */\n'+fn(s))
def warranty(s):
    s=one(s,'function warrantyMarkup(){','function warrantyMarkup(){\n  if(clientFrame())return \'<option value="Base">Base · inclusa</option>\';')
    s=one(s,"allowed=framePrice()>150?['Base','Gold']:['Base','Silver']","allowed=clientFrame()?['Base']:(framePrice()>150?['Base','Gold']:['Base','Silver'])")
    return one(s,"var wanted=framePrice()>150?", "var wanted=clientFrame()?'Montatura del cliente: garanzia Base, solo cambio lenti. Sconto 50% nel primo anno e 25% nel secondo, massimo due ricambi complessivi dalla consegna.':framePrice()>150?")
edit('eyewear-ui-fix-v11.js',warranty)
def eye(s):
    s=one(s,"function warrantyInfo(){var w=txt(val('eyWarranty')||'Base')", "function warrantyInfo(){var w=isClient(val('eyFrameType'))?'Base':txt(val('eyWarranty')||'Base')")
    line=next(x for x in s.splitlines() if x.startswith('function printSheet()'))
    new=line.replace('w.document.write(','w.document.write(window.optykerQuotePrint.decorate(',1)
    new=one(new,"</body></html>');w.document.close();", "</body></html>',d.mode==='quote'?'Preventivo occhiali':'Busta occhiali',[txt(val('eyReference')),E('eyClient')&&E('eyClient').selectedOptions[0]&&E('eyClient').selectedOptions[0].textContent].filter(Boolean).join(' · ')));w.document.close();")
    new=one(new,"setTimeout(function(){try{w.focus();w.print()}catch(e){}},250)","window.optykerQuotePrint.finish(w)")
    new=one(new,"<h2>Montatura</h2>","'+(d.frame.type==='Del cliente'?'<p>'+esc(window.OPTYKER_SEPT11.ownText)+'</p>':'')+'<h2>Montatura</h2>")
    return one(s,line,new)
edit('eyewear-flow-v9.js',eye)
def warehouse(s):
    s=one(s,'<button id="whCompaniesBtn" class="whBtn" type="button">Ditte / fornitori</button>','')
    s=one(s,";E('whCompaniesBtn').onclick=openCompanies",'')
    a=s.index('function installSettingsCompanyCard(){');b=s.index('function outsideClick',a)
    return s[:a]+'''function installSettingsCompanyCard(){
  var p=E('optykerSettingsPanel');if(!p)return;
  document.querySelectorAll('#whSettingsCompanies').forEach(function(n){if(n.parentNode!==p)n.remove()});
  if(p.querySelector('#whSettingsCompanies'))return;
  var d=document.createElement('div');d.id='whSettingsCompanies';d.className='whSettingsCompanyCard';
  d.innerHTML='<h3>Ditte e fornitori</h3><p>Gestisci le ditte utilizzate nel magazzino, nei DDT e nei lotti.</p><button class="whBtn" type="button">Gestisci ditte e fornitori</button>';
  d.querySelector('button').onclick=openCompanies;p.appendChild(d);
}
'''+s[b:]
edit('warehouse.js',warehouse)
def quotes(s):
    s=one(s,"loading:false,lastLoad:0", "loading:false,loadSeq:0,error:'',lastLoad:0")
    s=one(s,"var rows=state.rows||[];","var rows=state.clientId===String(window.clientCurrentId||'')?(state.rows||[]):[];")
    a=s.index('  function load(force){');b=s.index('  window.refreshClientQuotes',a)
    s=s[:a]+'''  function load(force){
    var cid=String(window.clientCurrentId||'');
    if(!cid){state.loadSeq++;state.clientId='';state.rows=[];state.loading=false;ensureSection();return Promise.resolve([])}
    if(cid!==state.clientId){state.clientId=cid;state.rows=[];state.loading=false;state.lastLoad=0;state.error='';state.loadSeq++;if(E('optykerQuoteModal'))E('optykerQuoteModal').remove()}
    if(state.loading)return state.promise||Promise.resolve([]);
    if(!force&&Date.now()-state.lastLoad<15000){render();return Promise.resolve(state.rows)}
    var seq=++state.loadSeq;state.loading=true;state.error='';render();
    state.promise=call('list',{client_id:cid}).then(function(x){if(seq===state.loadSeq&&cid===String(window.clientCurrentId||''))state.rows=Array.isArray(x.data)?x.data:[];return state.rows})
      .catch(function(e){if(seq===state.loadSeq){state.rows=[];state.error=e.message||'Caricamento non riuscito'}return []})
      .finally(function(){if(seq===state.loadSeq){state.loading=false;state.lastLoad=Date.now();render()}});
    return state.promise;
  }
'''+s[b:]
    s=one(s,"Nessun preventivo aperto per questo cliente.</div>","'+esc(state.error||'Nessun preventivo aperto per questo cliente.')+'</div>")
    s=one(s,'    document.body.appendChild(m);','''    document.body.appendChild(m);
    var print=document.createElement('button');print.type='button';print.textContent='Stampa preventivo';print.className='optykerQuoteOpen';
    m.querySelector('.optykerQuoteActions').prepend(print);
    print.onclick=function(){
      var w=window.open('','_blank');if(!w){alert('Consenti i popup per stampare il preventivo.');return}
      var extra=d.frame&&String(d.frame.type).toLowerCase()==='del cliente'?'<p>'+esc(window.OPTYKER_SEPT11.ownText)+'</p>':'';
      var html='<html><head><style>body{font-family:Segoe UI,Arial,sans-serif}.optykerQuoteDetail{padding:9px 0;border-bottom:1px solid #ddd;display:flex;gap:16px}.optykerQuoteDetail b{min-width:120px}.optykerQuoteDetail span{white-space:pre-wrap}</style></head><body><h1>Preventivo</h1>'+extra+m.querySelector('.optykerQuoteDetails').innerHTML+'</body></html>';
      w.document.write(window.optykerQuotePrint.decorate(html,'Preventivo '+kind(q),ref(q)+' · '+(E('clientWorkspaceName')&&E('clientWorkspaceName').textContent||'')));w.document.close();window.optykerQuotePrint.finish(w);
    };
''')
    return s
edit('quotes.js',quotes)
def operations(s):
    s=one(s,"$('ovcCardTariffs').onclick=openTariffs;","$('ovcCardTariffs').onclick=()=>window.optykerOpenOvcClientTariffs(C.id,currentName());")
    a=s.index(' let tariffsSeq=');b=s.index(' function orderStatus',a)
    s=s[:a]+" function openTariffs(){return window.OPTYKER_SEPT11.openTariffs();}\n window.optykerOpenOvcTariffs=openTariffs;\n"+s[b:]
    s=one(s,"head.prepend(b);}}","head.prepend(b);}if($('whOvcTariffs'))$('whOvcTariffs').hidden=$('whCategory')?.value!=='services';}")
    return s
edit('optyker-operations.js',operations)
def cash(s):
    old="return {card,services:(items.data||[]).map(i=>({...i,ovc_price:map.get(i.id)||null}))};"
    new="""let personal=new Map();
  if(clientId){
    const r=await db.from('optyker_ovc_client_service_prices').select('item_id,card_price,revision').eq('client_id',clientId).limit(2000);
    if(r.error)throw r.error;personal=new Map((r.data||[]).map(p=>[p.item_id,p]));
  }
  return {card,services:(items.data||[]).map(i=>{
    const inherited=map.get(i.id)||null,override=personal.get(i.id)||null;
    return {...i,ovc_price:override?.card_price!=null?override:inherited,ovc_price_source:override?.card_price!=null?'client':'warehouse',ovc_default_revision:inherited?.revision||0,ovc_client_revision:override?.revision||0};
  })};"""
    s=one(s,old,new)
    s=one(s,"ovc_card_revision:card?.revision??null,", "ovc_price_source:applied?(item.ovc_price_source||'warehouse'):'standard',ovc_client_revision:item.ovc_client_revision||0,ovc_default_revision:item.ovc_default_revision||0,ovc_card_revision:card?.revision??null,")
    return one(s,"pricing_label:applied?'Tariffa OVC CARD applicata':'Tariffa standard'","pricing_label:applied?(item.ovc_price_source==='client'?'Tariffa OVC CARD personalizzata':'Tariffa OVC CARD applicata'):'Tariffa standard'")
edit('supabase/functions/optyker-cash-register-api/ovc.mjs',cash)
def composer(s):
    s=one(s,'source_id:formState&&formState.source_id,','client_id:formState&&formState.client_id,pos_source_id:formState&&formState.pos_source_id,source_id:formState&&formState.source_id,')
    s=one(s,'return {draft_id:d.id,source_id:d.source_id,','return {client_id:d.client_id,pos_source_id:d.pos_source_id,draft_id:d.id,source_id:d.source_id,')
    s=one(s,"  var f=E('ficForm');","  var f=E('ficForm');if(b.pos_source_id){var note=document.createElement('p');note.className='ficHint';note.textContent='Fattura collegata a un pagamento in cassa. Compila le voci e verifica le aliquote: il totale deve coincidere con il pagamento'+(b.pos_total!=null?' di '+Number(b.pos_total).toFixed(2)+' EUR':'')+'. Nessuna aliquota viene scelta automaticamente.';f.prepend(note);}")
    return s
edit('billing-compose.js',composer)
def issuance(s):
    s=one(s,"return {id:d.id,series:d.series,", "return {id:d.id,client_id:d.client_id||null,pos_source_id:d.pos_source_id||null,series:d.series,")
    s=one(s,"async function mirror(db:any,company:string,d:any){", "async function mirror(db:any,company:string,d:any,clientId:string|null=null,posSourceId:string|null=null){")
    s=one(s,"const row={provider_invoice_id:`fic:${company}:${d.id}`", "const row={...(clientId?{client_id:clientId}:{}),provider_invoice_id:`fic:${company}:${d.id}`")
    s=one(s,"const old=await db.from('optyker_billing_invoices').select('id').eq('direction','outgoing').eq('provider_invoice_id',row.provider_invoice_id).maybeSingle();", "const old=posSourceId?await db.from('optyker_billing_invoices').select('id,provider_invoice_id,client_id').eq('id',posSourceId).maybeSingle():await db.from('optyker_billing_invoices').select('id').eq('direction','outgoing').eq('provider_invoice_id',row.provider_invoice_id).maybeSingle();if(posSourceId&&(!old.data||old.data.client_id!==clientId||(old.data.provider_invoice_id&&old.data.provider_invoice_id!==row.provider_invoice_id)))throw new Error('Richiesta cassa non disponibile o già collegata a un’altra fattura');")
    s=one(s,"if(action==='fic_preview'){", """if(action==='fic_preview'){
   const clientId=b.client_id||null,posSourceId=b.pos_source_id||null;let posSource:any=null;
   if(clientId){
    if(typeof clientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)||b.series==='foreign')throw new Error('Collegamento cliente non valido per questa fattura');
    const c=await db.from('optyker_clients').select('id').eq('id',clientId).maybeSingle();if(c.error||!c.data)throw new Error('Cliente non disponibile');
   }
   if(posSourceId){
    if(!clientId||typeof posSourceId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(posSourceId))throw new Error('Richiesta cassa non valida');
    const p=await db.from('optyker_billing_invoices').select('id,client_id,total,currency,direction,sdi_status,provider_invoice_id,provider_payload').eq('id',posSourceId).maybeSingle();
    if(p.error||!p.data||p.data.client_id!==clientId||p.data.direction!=='outgoing'||p.data.currency!=='EUR'||p.data.sdi_status!=='draft'||p.data.provider_invoice_id||p.data.provider_payload?.source!=='optyker_pos')throw new Error('Pagamento già fatturato o non disponibile per questo cliente');posSource=p.data;
    const prior=await db.from('optyker_fic_drafts').select('id').eq('pos_source_id',posSourceId).maybeSingle();if(prior.error)throw prior.error;if(prior.data&&prior.data.id!==b.draft_id)throw new Error('Esiste già una bozza per questo pagamento: riaprila dall’elenco');
   }
""")
    s=one(s,"const old=await getDraft(db,b.draft_id);if(!['preview'", "const old=await getDraft(db,b.draft_id);if((old.client_id||null)!==clientId||(old.pos_source_id||null)!==posSourceId)throw new Error('Il cliente o pagamento collegato alla bozza non può cambiare');if(!['preview'")
    s=one(s,"const row={id,number:reservedNumber,", "if(posSource&&Math.round(Number(totals.data.amount_gross)*100)!==Math.round(Number(posSource.total)*100))throw new Error('Il totale della fattura deve coincidere con il pagamento in cassa: verifica importi e IVA');const row={id,client_id:clientId,pos_source_id:posSourceId,number:reservedNumber,")
    s=one(s,"await mirror(db,company,result.data);", "await mirror(db,company,result.data,d.client_id||null,d.pos_source_id||null);")
    s=one(s,"await mirror(db,company,current.data);", "await mirror(db,company,current.data,d.client_id||null,d.pos_source_id||null);")
    return s
edit('supabase/functions/optyker-billing-admin/issuance.ts',issuance)
def pos(s):
    a=s.index('async function createInvoiceDraft(');b=s.index('async function markOrderPaid',a);part=s[a:b]
    part=one(part,'provider:"FOCUS FE · Bludata",','provider:"Fatture in Cloud",')
    part=one(part,'provider_connection:"not_configured",','provider_connection:"pending_administrator_review",')
    part=one(part,'provider_status:"pending_focus_fe",','provider_status:"pending_fic_review",')
    return s[:a]+part+s[b:]
edit('supabase/functions/optyker-cash-register-api/index.ts',pos)
def cash_ui(s):
    s=s.replace('Crea fattura per questo pagamento','Prepara fattura Fatture in Cloud')
    s=s.replace('Verrà creata la fattura del solo importo pagato.','Richiesta Fatture in Cloud del solo importo pagato; revisione e conferma in Fatturazione cliente.')
    s=s.replace('fattura preparata','richiesta Fatture in Cloud preparata')
    return s
edit('cash-register.js',cash_ui)

build=ROOT/'scripts/vercel-build-v13.sh';s=build.read_text()
if 'apply_sept11_release.py' not in s:
    build.write_text(s+'''\n# Verified customer workflow changes, applied after existing versioned patches.\nnode --check optyker-sept11.js\npython scripts/apply_sept11_release.py\nnode --test tests/sept11-pricing.test.mjs\npython scripts/patch_public_asset_paths.py\npython scripts/finalize_sept11_manifest.py\nverify_desktop_aliases\n''')
print('September 11 source changes prepared; no customer data modified')

# Provider tests use local mocks only.
test=ROOT/'tests/fic-issuance.test.mjs'
if 'OPTYKER_SEPT11_CLIENT_BILLING_TESTS' not in test.read_text():
    test.write_text(test.read_text()+'\n'+(ROOT/'tests/sept11-fic-client-tests.txt').read_text())
