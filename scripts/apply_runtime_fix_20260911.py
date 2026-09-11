"""Fix conflicts observed in the real assembled application, not isolated fixtures."""
from pathlib import Path
import hashlib,json,re
site=Path('_site');entry=site/'index.html';s=entry.read_text()
MARK='OPTYKER_RUNTIME_FIX_20260911_R2'
own='Montatura del cliente: garanzia Base, solo cambio lenti. Sconto 50% nel primo anno e 25% nel secondo, massimo due ricambi complessivi dalla consegna.'
if MARK not in s:
    old="if(hint)hint.textContent=frame>150?'Base inclusa. Gold disponibile per montature oltre € 150.':'Base inclusa. Silver disponibile per montature fino a € 150.'"
    new="if(hint)hint.textContent=isClientLens(E('eyFrameType')&&E('eyFrameType').value)?"+json.dumps(own,ensure_ascii=False)+":frame>150?'Base inclusa. Gold disponibile per montature oltre € 150.':'Base inclusa. Silver disponibile per montature fino a € 150.'"
    count=s.count(old)
    if count!=2:raise SystemExit('Expected two legacy warranty writers, got '+str(count))
    s=s.replace(old,new)
    old="var allowed=frame>150?['Base','Gold']:['Base','Silver'];"
    if s.count(old)!=2:raise SystemExit('Legacy warranty options changed')
    s=s.replace(old,"var allowed=isClientLens(E('eyFrameType')&&E('eyFrameType').value)?['Base']:(frame>150?['Base','Gold']:['Base','Silver']);")
    badge='''<script id="optykerRuntimeReleaseBadge">/* OPTYKER_RUNTIME_FIX_20260911_R2 */
(function(){function ready(){
 window.OPTYKER_RUNTIME_REVISION='20260911-r2';
 var ok=!!window.OPTYKER_SEPT11,targets=[document.querySelector('.topbarTitleBlock'),document.querySelector('.optykerLoginFoot')];
 targets.forEach(function(t,i){if(!t||document.getElementById('optykerReleaseBadge'+i))return;var x=document.createElement('div');x.id='optykerReleaseBadge'+i;x.className='optykerRuntimeRelease';x.textContent=ok?'Aggiornamento 11/09/2026 · R2':'Aggiornamento R2 · modulo non caricato';x.title=ok?'Correzione visualizzazione preventivi e garanzia montatura del cliente':'Riapri Optyker per completare il caricamento';t.appendChild(x);});
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();})();
</script>'''
    pos=s.lower().rfind('</body>');assert pos>=0
    s=s[:pos]+badge+s[pos:]
css=site/'optyker-sept11.css';t=css.read_text()
if MARK not in t:
 t+='''\n/* OPTYKER_RUNTIME_FIX_20260911_R2: higher specificity than the existing OVC theme. */
@media screen{
html[data-ovc-ui] #mainApp #eyewearPanel .eyHead #eyModeQuote.active{background:#b42332!important;border-color:#b42332!important;color:#fff!important;box-shadow:none!important}
html[data-ovc-ui] #mainApp #eyewearPanel .eyHead #eyModeQuote.active :is(b,small,span){color:#fff!important}
html[data-ovc-ui] #mainApp #eyewearPanel[data-ovc-quote] .eyHead{background:linear-gradient(110deg,#621d2f,#97263c)!important}
html[data-ovc-ui] #mainApp #eyewearPanel[data-ovc-quote] #eyReference{color:#b42332!important;border-color:#e2aab4!important}
html[data-ovc-ui] #mainApp #eyewearPanel #eyRecentList .eyRecentRow[data-ovc-quote]{border-left:4px solid #b42332!important;background:#fff7f8!important}
html[data-ovc-ui] #mainApp #eyewearPanel #eyRecentList .eyRecentRow[data-ovc-quote] .eyRecentRef{color:#b42332!important}
html[data-ovc-ui] #mainApp #clientsPanel .optykerQuoteCard{border-color:#edbec4!important;background:#fff7f8!important}
html[data-ovc-ui] #mainApp #clientsPanel :is(.optykerQuoteBadge,.optykerQuoteTitle,.optykerQuoteAmount,.optykerQuotesCount),html[data-ovc-ui] #mainApp #clientsPanel .optykerQuotesHead h3{color:#b42332!important}
#optykerReleaseBadge0,#optykerReleaseBadge1{display:block!important;font:500 10px/1.5 "Segoe UI",Arial,sans-serif!important;color:#6b5960!important;margin-top:3px!important;letter-spacing:0!important}
}
@media print{.optykerRuntimeRelease{display:none!important}}
'''
 css.write_text(t)
# The old warehouse URL was retained across releases. A content-addressed filename
# prevents any cached September 6 module from being mixed with this assembled page.
for filename in ('warehouse.js','optyker-sept11.css'):
 p=site/filename;digest=hashlib.sha256(p.read_bytes()).hexdigest()[:12];newname=p.stem+'.'+digest+p.suffix
 (site/newname).write_bytes(p.read_bytes())
 pattern=re.compile(r'(?P<base>/'+re.escape(filename)+r')(?:\?[^"\'<>\s]*)?')
 s,n=pattern.subn('/'+newname+'?v=20260911-r2',s)
 if n!=1 and MARK not in entry.read_text():raise SystemExit('Expected one reference for '+filename+', got '+str(n))
entry.write_text(s)
for name in ('gestionale-v2','gestionale-v3'):
 p=site/name/'index.html'
 if p.exists():p.write_text(s)
meta=site/'sept11-version.json';m=json.loads(meta.read_text());m['runtime_revision']='20260911-r2'
for name in list(m['assets']):m['assets'][name]=hashlib.sha256((site/name).read_bytes()).hexdigest()
for name in ('warehouse.js',):m['assets'][name]=hashlib.sha256((site/name).read_bytes()).hexdigest()
meta.write_text(json.dumps(m,indent=2)+'\n')
print('Real-page warranty writers, red quote theme and cache identity corrected')
