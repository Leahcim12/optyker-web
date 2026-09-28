"""Expose the existing invoice editor to administrators and retain safe saves."""
from pathlib import Path
import re, json, hashlib, sys
ROOT=Path(__file__).resolve().parent.parent
SITE=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'_site'
VERSION='20260928-invoice-edit3'

def replace_one(text, old, new):
    if text.count(old)!=1:
        raise SystemExit('Invoice editor anchor mismatch: '+old[:90])
    return text.replace(old,new,1)

def patch_customer(text):
    if VERSION in text:return text
    text=text.replace('20260916-invoice-edit2',VERSION)
    start=text.index('function request(action,payload)')
    end=text.index('function address(c)',start)
    text=text[:start]+'''function request(action,payload){
 var c=creds(),token='';try{if(window.OPTYKER_BILLING_ADMIN)token=sessionStorage.getItem('optyker_billing_admin_token')||''}catch(e){}
 if(!token&&(!c.username||!c.password))return Promise.reject(new Error('Sessione non disponibile. Esci e accedi nuovamente.'));
 var headers={'Content-Type':'application/json'},body={action:action,payload:payload||{}};
 if(token)headers.Authorization='Bearer '+token;else {body.username=c.username;body.password=c.password}
 return fetch(API,{method:'POST',headers:headers,body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(x&&x.error||('HTTP '+r.status));return x.data||{}})
 }
'''+text[end:]
    text=replace_one(text,'var current=null;',"var current=null,editing=false,saving=false;\nwindow.addEventListener('beforeunload',function(ev){if(editing||saving){ev.preventDefault();ev.returnValue=''}});")
    text=replace_one(text,"b.onclick=function(){m.classList.remove('open')}","b.onclick=function(){if(saving)return;if(editing&&!window.confirm('Uscire senza salvare le modifiche alla fattura?'))return;editing=false;m.classList.remove('open')}")
    text=replace_one(text,'function show(d){current=d;','function show(d){editing=false;saving=false;current=d;')
    text=replace_one(text,"m.querySelector('[data-oip-print]').onclick=printCurrent;","m.querySelector('[data-oip-print]').disabled=false;m.querySelector('[data-oip-print]').onclick=printCurrent;")
    text=text.replace('Modifica righe / note','Modifica fattura')
    text=replace_one(text,"function vatOptions(v){var a=","function vatOptions(v){if(String(v)==='4')v='04';if(String(v)==='5')v='05';var a=")
    text=replace_one(text,"return '<tr><td><input class=\"desc\"", "return '<tr data-source-index=\"'+esc(x.source_index==null?'':x.source_index)+'\" data-original-qty=\"'+esc(x.quantity??'')+'\" data-original-price=\"'+esc(x.unit_price??'')+'\" data-original-total=\"'+esc(x.total??'')+'\"><td><input class=\"desc\"")
    text=replace_one(text,'data-remove-row>×</button>','data-remove-row aria-label="Rimuovi riga">Rimuovi</button>')
    start=text.index('function recalcEditor()');end=text.index('function wireRows()',start)
    text=text[:start]+'''function recalcEditor(){var box=E('oieRows'),cents=0;if(!box)return 0;box.querySelectorAll('tr').forEach(function(r){var q=Math.round(Number(r.querySelector('[data-k="quantity"]').value||0)*1000)/1000,p=Math.round((Number(r.querySelector('[data-k="unit_price"]').value||0)+Number.EPSILON)*100)/100,t=(isFinite(q)&&isFinite(p)?Math.round((q*p+Number.EPSILON)*100):0);if(r.getAttribute('data-original-total')!==''&&q===Number(r.getAttribute('data-original-qty'))&&p===Number(r.getAttribute('data-original-price')))t=Math.round(Number(r.getAttribute('data-original-total'))*100);cents+=t;var c=r.querySelector('[data-line-total]');if(c)c.textContent=money(t/100,'EUR')});var el=E('oieTotal');if(el)el.textContent=money(cents/100,'EUR');return cents/100}
'''+text[end:]
    text=replace_one(text,"out.push({description:r.querySelector", "out.push({source_index:r.getAttribute('data-source-index')===''?null:Number(r.getAttribute('data-source-index')),description:r.querySelector")
    text=replace_one(text,'function openEditor(d){var m=',"function openEditor(d){if(d.editable===false){alert(d.edit_block_reason||'Questa fattura non è modificabile.');return}editing=true;var m=")
    text=replace_one(text,"edit.style.display='none';var lock=", "edit.style.display='none';m.querySelector('[data-oip-print]').disabled=true;var lock=")
    text=replace_one(text,"SDI.</div>'+lock+'<div class=\"oieTableWrap\">","SDI.</div>'+lock+'<label>Oggetto / intestazione<input id=\"oieHeader\" maxlength=\"500\" value=\"'+esc(d.header||'Fattura')+'\" style=\"width:100%;padding:9px;border:1px solid #cddbe5;border-radius:8px;margin:5px 0 14px\"></label><div class=\"oieTableWrap\">")
    text=replace_one(text,"E('oieAdd').onclick=function(){E('oieRows').insertAdjacentHTML", "E('oieAdd').onclick=function(){if(E('oieRows').children.length>=40){alert('Puoi inserire fino a 40 righe.');return}E('oieRows').insertAdjacentHTML")
    text=replace_one(text,"Math.abs(total-Number(d.locked_total))>0.01", "Math.round(total*100)!==Math.round(Number(d.locked_total)*100)")
    text=replace_one(text,"btn.disabled=true;btn.textContent='Salvataggio…';request('invoice_update',{id:d.id,lines:collectRows(),notes:E('oieNotes').value})", "var payload={id:d.id,expected_updated_at:d.updated_at,header:E('oieHeader').value,lines:collectRows(),notes:E('oieNotes').value};saving=true;m.querySelectorAll('.oie input,.oie select,.oie textarea,.oie button').forEach(function(el){el.disabled=true});btn.textContent='Salvataggio…';request('invoice_update',payload)")
    text=replace_one(text,"alert('Impossibile salvare: '+e.message);btn.disabled=false;btn.textContent='Salva modifiche'", "saving=false;m.querySelectorAll('.oie input,.oie select,.oie textarea,.oie button').forEach(function(el){el.disabled=false});alert('Impossibile salvare: '+e.message);btn.textContent='Salva modifiche'")
    text=replace_one(text,'function open(id,button){','function open(id,button,editMode){')
    text=replace_one(text,"request('invoice_print',{id:id}).then(show)","return request('invoice_print',{id:id}).then(function(d){show(d);if(editMode)openEditor(d)})")
    text=replace_one(text,"open:open,print:function()", "open:open,openEditorById:function(id,button){return open(id,button,true)},print:function()")
    return text

ADMIN_BRIDGE='''
  // OPTYKER_INVOICE_EDIT_ACCESS_20260928
  function openCustomerInvoiceEditor(id,button,edit){
    function go(){window.OPTYKER_CUSTOMER_INVOICE_PRINT.open(id,button,edit)}
    if(window.OPTYKER_CUSTOMER_INVOICE_PRINT){go();return}
    if(button)button.disabled=true;
    var script=document.getElementById('optykerInvoiceEditorLoader');
    if(!script){script=document.createElement('script');script.id='optykerInvoiceEditorLoader';script.src=(location.hostname.endsWith('github.io')?'/optyker-web/':'/')+'customer-invoice-print.js?v=20260928-invoice-edit3'}
    script.addEventListener('load',function(){if(button)button.disabled=false;go()},{once:true});
    script.addEventListener('error',function(){if(button)button.disabled=false;script.remove();toast('Modulo fatture non caricato. Ricarica la pagina.','error')},{once:true});
    if(!script.isConnected)document.head.appendChild(script);
  }
  window.addEventListener('optyker:invoice-updated',function(){
    if(!window.OPTYKER_BILLING_ADMIN)return;
    var modal=E('optykerBillingModal');if(modal)modal.style.display='none';loadRows();
  });
'''

def patch_admin(text):
    if 'OPTYKER_INVOICE_EDIT_ACCESS_20260928' in text:return text
    text=replace_one(text,'    loadInvoiceNotes(id)\n  }', '''    if(r.direction==='outgoing'){
      var actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:16px 0';
      var view=document.createElement('button');view.type='button';view.className='optykerBillingBtn';view.textContent='Visualizza / Stampa';view.onclick=function(){openCustomerInvoiceEditor(id,view,false)};actions.appendChild(view);
      var edit=document.createElement('button');edit.type='button';edit.className='optykerBillingBtn primary';edit.textContent='Modifica fattura';edit.onclick=function(){openCustomerInvoiceEditor(id,edit,true)};actions.appendChild(edit);
      if(r.provider_invoice_id||r.sdi_protocol||!['draft','not_applicable'].includes(r.sdi_status)){edit.disabled=true;edit.title='Documento elettronico o già trasmesso: modifica diretta non consentita.'}
      var anchor=m.querySelector('.optykerBillingAnnotations');if(anchor)anchor.before(actions);else m.querySelector('.optykerBillingModalCard').appendChild(actions);
    }
    loadInvoiceNotes(id)
  }''')
    text=text.replace('Righe / note aggiunte','Annotazioni interne (non modificano la fattura)')
    text=replace_one(text,'  function detail(k,v,full){',ADMIN_BRIDGE+'\n  function detail(k,v,full){')
    return text

def main():
    customer=patch_customer((ROOT/'customer-invoice-print.js').read_text(encoding='utf-8'))
    (SITE/'customer-invoice-print.js').write_text(customer,encoding='utf-8')
    path=SITE/'billing-admin.js';path.write_text(patch_admin(path.read_text(encoding='utf-8')),encoding='utf-8')
    page=SITE/'index.html';html=page.read_text(encoding='utf-8')
    html=re.sub(r'(customer-invoice-print\.js)(\?[^\s"\'<>]*)?',r'\1?v='+VERSION,html)
    html=html.replace('20260916-adminnavlock1','20260928-admin-invoice-edit3')
    if 'customer-invoice-print.js' not in html:
        tag='<script defer src="customer-invoice-print.js?v='+VERSION+'"></script>'
        html=html.replace('</head>',tag+'\n</head>',1)
    for alias in ('','gestionale-v2','gestionale-v3'):
        dest=SITE/alias;dest.mkdir(parents=True,exist_ok=True)
        (dest/'index.html').write_text(html,encoding='utf-8')
        if alias:
            (dest/'customer-invoice-print.js').write_text(customer,encoding='utf-8')
            (dest/'billing-admin.js').write_text(path.read_text(encoding='utf-8'),encoding='utf-8')
    (SITE/'invoice-edit-version.json').write_text(json.dumps({'version':VERSION,'customer_js_sha256':hashlib.sha256(customer.encode()).hexdigest()}),encoding='utf-8')
    print('Invoice editor: administrator access, rows, notes, revision and payment checks installed')
if __name__=='__main__':main()
