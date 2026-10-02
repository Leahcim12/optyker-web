"""Patch the native search/agenda before execution, preserving existing wrappers."""
from pathlib import Path
import hashlib,json,re

ROOT=Path(__file__).resolve().parents[1]
VERSION='20261002-client-search-agenda1'
MARK='OPTYKER_CLIENT_SEARCH_AGENDA_20261002'

def once(text,old,new):
    if text.count(old)!=1:raise ValueError('Search/agenda anchor changed: '+old[:100])
    return text.replace(old,new,1)

def patch(text):
    if MARK in text:return text
    # Preserve other search fields while matching names in either order and formatted phones.
    for fn,end in [('clientRefreshList','function clientSelect'),('dashboardRenderClients','function dashboard')]:
        start=text.index('function '+fn+'(')
        finish=text.index(end,start+20)
        part=text[start:finish]
        part=once(part,'if(term && hay.indexOf(term)===-1) continue;','if(!window.optykerClientMatches(m,term)) continue;')
        text=text[:start]+part+text[finish:]
    text=once(text,'if(norm(all).indexOf(q)<0)continue;','if(!window.optykerClientMatches(c,q))continue;')
    # No entire-client select; keep its native ID as the submitted hidden field.
    text=once(text,'<label>Cliente già presente (facoltativo)</label><select id="oaClient"><option value="">Inserimento manuale</option></select>',
      '<label for="oaClientSearch">Cerca cliente (facoltativo)</label><input id="oaClient" type="hidden"><input id="oaClientSearch" type="search" autocomplete="off" placeholder="Nome, cognome o telefono" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="oaClientResults" aria-describedby="oaClientSearchStatus"><div id="oaClientSearchStatus" role="status" aria-live="polite"></div><div id="oaClientResults" role="listbox" aria-label="Clienti trovati"></div>')
    old="var c=window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients)?OPTYKER_CLOUD.clients:[];E('oaClient')._clients=c;E('oaClient').innerHTML='<option value=\"\">Inserimento manuale</option>'+c.map(function(x){return'<option value=\"'+X(x.id)+'\">'+X(((x.surname||'')+' '+(x.name||'')).trim())+(x.email?' · '+X(x.email):'')+'</option>'}).join('')"
    text=once(text,old,'oaLookupRender()')
    text=once(text,"modal('oaNewModal',true)","modal('oaNewModal',true);oaLookupReset()")
    text=once(text,'function oaService(){',(ROOT/'scripts/agenda_client_lookup.js').read_text()+'\nfunction oaService(){')
    # Empty operators are accepted only for server-validated forced candidates.
    old=re.search(r'function oaSetOperators\(rows,starts,forced\)\{[^\n]+\}',text)
    if not old:raise ValueError('Missing operator picker')
    new=old[0].replace("if(!names.length){","if(!names.length&&!forced){",1)
    new=once(new,"E('oaOperator').innerHTML='<option value=\"\">Scegli l’operatore</option>'+", "E('oaOperator').innerHTML='<option value=\"\">'+(forced?'Non assegnato · facoltativo':'Scegli l’operatore')+'</option>'+" )
    new=once(new,"if(!op){oaResetStudio('Seleziona prima un operatore');return}","if(!op&&!forced){oaResetStudio('Seleziona prima un operatore');return}")
    new=once(new,"oaSetStudios(selected,starts,forced)}}","oaSetStudios(selected,starts,forced);if(forced&&E('oaStudio').options.length>1){E('oaStudio').value='0';E('oaStudio').onchange()}};if(forced)E('oaOperator').onchange()}")
    text=once(text,old[0],new)
    text=once(text,"var r=clean[+this.value];if(!r)","var r=this.value===''?null:clean[+this.value];if(!r)")
    text=once(text,"Scegli prima l’orario, poi l’operatore e infine lo studio disponibile.","Scegli un orario e uno studio disponibile. Con la forzatura l’operatore è facoltativo.")
    text=once(text,'Le sovrapposizioni nello stesso studio restano bloccate.','Puoi lasciare l’operatore non assegnato. Le sovrapposizioni nello stesso studio restano bloccate.')
    # Ignore a late reply for a previous date/time/force toggle.
    anchor='function oaManualChanged(){'
    text=once(text,anchor,"var oaManualRequest=0;\n"+anchor+"var request=++oaManualRequest;var serviceId=E('oaService').value,dateValue=E('oaDate').value,timeValue=E('oaManualTime').value,forceValue=E('oaForceClosed').checked;function current(){return request===oaManualRequest&&E('oaNewModal').classList.contains('open')&&E('oaService').value===serviceId&&E('oaDate').value===dateValue&&E('oaManualTime').value===timeValue&&E('oaForceClosed').checked===forceValue}")
    start=text.index(anchor);end=text.index('\nfunction create()',start)
    part=text[start:end].replace('.then(function(x){','.then(function(x){if(!current())return;').replace('.catch(function(e){','.catch(function(e){if(!current())return;')
    text=text[:start]+part+text[end:]
    helper=(ROOT/'client-search-match.js').read_text()
    # Head executes before the app's first list render.
    text=text.replace('</head>','<script id="optykerClientSearchMatch">/* '+MARK+' */\n'+helper+'</script>\n<style>#oaClientResults{max-height:250px;overflow:auto;display:grid;gap:4px}#oaClientResults:empty{display:none}.oaClientResult{padding:10px;text-align:left;border:1px solid #d6dce4;border-radius:8px;background:white;display:grid;gap:3px;color:inherit;font:inherit}.oaClientResult:hover,.oaClientResult:focus{background:#f7edf0;outline:2px solid #8a2540}.oaClientResult span,#oaClientSearchStatus{font-size:13px;color:#64748b}#oaClientSearchStatus{margin:6px 0}#oaClientSearch{font-size:16px}</style>\n</head>',1)
    return text

def main(site=Path('_site')):
    updated=patch((site/'index.html').read_text())
    assert patch(updated)==updated
    for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):(site/rel).write_text(updated)
    digest=hashlib.sha256((''.join((ROOT/p).read_text() for p in ['scripts/apply_client_search_agenda.py','scripts/agenda_client_lookup.js','client-search-match.js'])).encode()).hexdigest()
    (site/'client-search-agenda-version.json').write_text(json.dumps({'version':VERSION,'sha256':digest})+'\n')
    print('Client search and agenda updated:',VERSION)

if __name__=='__main__':main()
