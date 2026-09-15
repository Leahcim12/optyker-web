from pathlib import Path

ROOT=Path('_site')
MARK='OPTYKER_EYEWEAR_SIMPLE_ORDER_20260915'

# External operations controller: Preventivo and Busta are both orderable.
p=ROOT/'optyker-operations.js'
s=p.read_text(encoding='utf-8')
if MARK not in s:
    old="if(context.mode!=='job')throw Error('Crea una Busta Occhiali: un preventivo non può essere ordinato.');"
    if old not in s: raise SystemExit('Quote-order blocker anchor missing')
    s=s.replace(old,'',1)
    s=s.replace("if(!context.client_id)throw Error('Seleziona il cliente prima di ordinare.');","if(!context.client_id)throw Error('Apri prima il cliente a cui vuoi collegare il documento Occhiali.');",1)
    old_confirm="if(!confirm('Inviare '+(row?.reference_code||'questa Busta Occhiali')+' al Laboratorio?\\n\\nL’ordine sarà collegato al cliente e inizierà dallo stato Da fare.'))return;"
    new_confirm="if(!confirm('Ordinare le lenti di '+(row?.reference_code||'questo documento Occhiali')+'?\\n\\nL’ordine andrà in Laboratorio e il totale sarà aggiunto automaticamente al carrello del cliente.'))return;"
    if old_confirm not in s: raise SystemExit('Eyewear confirm anchor missing')
    s=s.replace(old_confirm,new_confirm,1)
    s=s.replace("orderStatus('Salvataggio Busta e invio al laboratorio…');","orderStatus('Salvataggio documento e ordine lenti…');",1)
    s=s.replace("const job=$('eyModeJob')?.classList.contains('active');b.hidden=!job;b.disabled=orderBusy;","b.hidden=false;b.disabled=orderBusy;",1)
    s=s.replace("b.textContent=orderBusy?'Ordino…':'Ordina';","b.textContent=orderBusy?'Ordino…':'Ordina lenti';",1)
    s=s.replace("b.textContent='Ordina';actions.append(b);","b.textContent='Ordina lenti';actions.append(b);",1)
    s=s.replace("r.sheet_type!=='eyewear_job'","!['eyewear_job','eyewear_quote'].includes(r.sheet_type)",1)
    s=s.replace("b.textContent='Ordina';b.onclick=()=>sendOrder(r);","b.textContent='Ordina lenti';b.onclick=()=>sendOrder(r);",1)
    s=s.replace("orderStatus('Busta salvata. Premi Ordina prodotto per inviarla al Laboratorio.');","orderStatus('Documento Occhiali salvato. Premi Ordina lenti per inviarlo al Laboratorio.');",1)
    s=s.replace("})();","window.OPTYKER_EYEWEAR_SIMPLE_ORDER_BUILD='20260915-simple-order1';/* "+MARK+" */\n})();",1)
p.write_text(s,encoding='utf-8')

# Inline eyewear flow: when a customer record is open, it is authoritative.
main=ROOT/'index.html'
h=main.read_text(encoding='utf-8')
if MARK not in h:
    old="client_id:txt(val('eyClient'))"
    new="client_id:(function(){var cid=txt(window.clientCurrentId||'');var sel=E('eyClient');if(cid&&sel&&sel.value!==cid)sel.value=cid;return cid||txt(val('eyClient'))})()"
    if old not in h: raise SystemExit('Eyewear client binding anchor missing')
    h=h.replace(old,new,1)
    h=h.replace("<label>Cliente</label><select id=\"eyClient\">", "<label>Cliente collegato</label><select id=\"eyClient\">",1)
    body=h.rfind('</body>')
    if body<0: raise SystemExit('Closing body not found')
    h=h[:body]+'<!-- '+MARK+' -->\n'+h[body:]
main.write_text(h,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(h,encoding='utf-8')

checks=[
    (ROOT/'optyker-operations.js','Ordina lenti'),
    (ROOT/'optyker-operations.js',"['eyewear_job','eyewear_quote'].includes"),
    (ROOT/'optyker-operations.js',MARK),
    (ROOT/'index.html',"window.clientCurrentId||''"),
    (ROOT/'index.html',MARK),
]
for path,needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit('Missing simple eyewear order patch: '+str(path)+' -> '+needle)
if "un preventivo non può essere ordinato" in (ROOT/'optyker-operations.js').read_text(encoding='utf-8'):
    raise SystemExit('Quote order blocker still present')
if 'b.hidden=!job' in (ROOT/'optyker-operations.js').read_text(encoding='utf-8'):
    raise SystemExit('Order button is still hidden in Preventivo mode')
if (ROOT/'gestionale-v2/index.html').read_bytes()!=main.read_bytes() or (ROOT/'gestionale-v3/index.html').read_bytes()!=main.read_bytes():
    raise SystemExit('Desktop aliases differ after simple eyewear order patch')
print('Eyewear: current client + Preventivo/Busta Ordina lenti + persistent-cart handoff enabled')
