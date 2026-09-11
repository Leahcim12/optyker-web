"""Bind OVC default editing to real service rows/forms before R2 fingerprinting."""
from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parent.parent;site=root/'_site';p=site/'warehouse.js';s=p.read_text();mark='OPTYKER_WAREHOUSE_CARD_DEFAULTS_V1'
if mark not in s:
 start=s.index('function renderServices(box){');end=s.index('\nfunction render(){',start);part=s[start:end]
 old='<th>Nome servizio</th><th>Costo</th><th>IVA</th>';assert part.count(old)==1
 part=part.replace(old,'<th>Nome servizio</th><th>Prezzo standard</th><th>Prezzo OVC Card predefinito</th><th>IVA</th>')
 old="'<td><div class=\"whVatBadge\">'";assert part.count(old)==1
 part=part.replace(old,"'<td class=\"whOvcDefaultCell\" data-ovc-default-id=\"'+esc(r.id)+'\"></td>'+\n      "+old)
 old="box.innerHTML=h+'</tbody></table>';";assert part.count(old)==1
 part=part.replace(old,old+'\n  window.optykerWarehouseCardDefaults.mountTable(box,W.rows);')
 s=s[:start]+part+s[end:]
 start=s.index('function openServiceModal(r){');end=s.index('\nfunction saveServiceItem',start);part=s[start:end]
 part=part.replace('<label>Costo</label>','<label>Prezzo standard</label>')
 old="E('whsSave').onclick=function(){saveServiceItem(r,m)}";assert part.count(old)==1
 part=part.replace(old,old+';\n  window.optykerWarehouseCardDefaults.mountEditor(m,r);')
 s='/* '+mark+' */\n'+s[:start]+part+s[end:];p.write_text(s)
html=(site/'index.html').read_text()
assets={}
for name in ('warehouse-card-defaults.js','warehouse-card-defaults.css'):
 raw=(root/name).read_bytes();digest=hashlib.sha256(raw).hexdigest();fn=Path(name).stem+'.'+digest[:12]+Path(name).suffix;(site/fn).write_bytes(raw);assets[fn]=digest
 if name.endswith('.js'):tag='<script id="optykerWarehouseCardDefaultsJs" defer src="/'+fn+'"></script>'
 else:tag='<link id="optykerWarehouseCardDefaultsCss" rel="stylesheet" href="/'+fn+'">'
 if tag not in html:html=html.replace('</head>',tag+'</head>',1)
for name in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
 if (site/name).exists():(site/name).write_text(html)
m=json.loads((site/'sept11-version.json').read_text());m['service_card_prices_version']='20260911-card-defaults1';m['assets'].update(assets);(site/'sept11-version.json').write_text(json.dumps(m,indent=2)+'\n')
print('OVC default-price fields attached to warehouse service table and editor')
