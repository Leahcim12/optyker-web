from pathlib import Path
import re,shutil,json
from apply_ts_connection import DocumentClosings
VERSION='20260922-unified-rch1'
ACCESS='20260925-close-access1'
ROOT=Path(__file__).resolve().parent.parent

def change(s,a,b):
 if b in s:return s
 if s.count(a)!=1:raise ValueError('Session patch anchor missing/ambiguous: '+a[:100])
 return s.replace(a,b,1)

def patch(site):
 p=site/'cash-day-control.js';s=p.read_text() if p.exists() else (ROOT/'cash-day-control.js').read_text()
 s=change(s,'ob.disabled=opened||closed||state.loading;cb.disabled=!opened||closed||state.loading;',"ob.disabled=(opened&&!closed)||state.loading;cb.disabled=!opened||state.loading;ob.textContent=closed?'Riapri cassa':'Apertura cassa';cb.textContent=closed?'Nuova chiusura':'Chiusura cassa';")
 s=change(s,"cb.textContent=closed?'Nuova chiusura':'Chiusura cassa';","cb.textContent=closed?'Nuova chiusura':'Chiusura cassa';/* OPTYKER_CASH_CLOSURE_ACCESS_20260925: only open the review; confirmation is validated on the server. */if(window.OPTYKER_CASH_SESSIONS){ob.disabled=false;cb.disabled=false;}")
 s=change(s,'function openOpening(){',"function openOpening(){\n  if(window.OPTYKER_CASH_SESSIONS)return window.OPTYKER_CASH_SESSIONS.open('open',todayRome(),false);")
 s=change(s,'function openClosure(){',"function openClosure(){\n  if(window.OPTYKER_CASH_SESSIONS)return window.OPTYKER_CASH_SESSIONS.open('close',todayRome(),false);")
 s=change(s,'function install(){',"window.addEventListener('optyker:cash-session-changed',function(){state.last=0;refresh(true).catch(function(){})});\nfunction install(){")
 p.write_text(s)
 p=site/'admin-cash-today-controls.js';s=p.read_text();s=change(s,"var openDisabled=m.opened||m.closed?' disabled':'';","var openDisabled=m.opened&&!m.closed?' disabled':'';")
 s=change(s,"var closeDisabled=!m.opened||m.closed?' disabled':'';","var closeDisabled=!m.opened?' disabled':'';")
 s=change(s,'function route(kind){',"window.addEventListener('optyker:cash-session-changed',function(){scheduleRefresh(30)});\nfunction route(kind){\n if(window.OPTYKER_CASH_SESSIONS)return window.OPTYKER_CASH_SESSIONS.open(kind==='view'?'history':kind,today(),true);")
 s=change(s,"var ob=E('optykerAdminCashOpenToday'),cb=E('optykerAdminCashCloseToday'),vb=E('optykerAdminCashViewToday');","var ob=E('optykerAdminCashOpenToday'),cb=E('optykerAdminCashCloseToday'),vb=E('optykerAdminCashViewToday');if(m.closed){ob.textContent='RIAPRI CASSA';cb.textContent='NUOVA CHIUSURA'}")
 p.write_text(s)
 p=site/'admin-cash-closure.js';s=p.read_text();s=change(s,"function metric(m,k){return m&&m.closed&&m.closure&&m.closure[k]!=null?m.closure[k]:(m&&m[k]!=null?m[k]:0)}","function metric(m,k){return m&&m[k]!=null?m[k]:0}")
 for kind,fun in [('open','openDay'),('close','openClose'),('history','viewClose')]:s=change(s,'function '+fun+'(date){',"function "+fun+"(date){if(window.OPTYKER_CASH_SESSIONS)return window.OPTYKER_CASH_SESSIONS.open('"+kind+"',date,true);")
 s=change(s,"act=closed?'<button class=\"optykerAdminCashMini\" data-view=\"'+esc(r.date)+'\">Vedi</button>'", "act=closed?'<button class=\"optykerAdminCashMini\" data-open=\"'+esc(r.date)+'\">Riapri</button><button class=\"optykerAdminCashMini primary\" data-close=\"'+esc(r.date)+'\">Nuova chiusura</button><button class=\"optykerAdminCashMini\" data-view=\"'+esc(r.date)+'\">Storico</button>'")
 s=change(s,'  function ensure(){',"  window.addEventListener('optyker:cash-session-changed',function(){S.busy=false;loadOverview()});\n  function ensure(){")
 p.write_text(s)
 (site/'cash-sessions.js').write_text((ROOT/'cash-sessions.js').read_text()+'\n'+(ROOT/'cash-closure-entrypoints.js').read_text())
 p=site/'index.html';s=p.read_text()
 for name in ('cash-day-control.js','admin-cash-closure.js','admin-cash-today-controls.js'):
  s=re.sub(re.escape(name)+r'(?:\?[^\s\"\'<>]*)?',lambda m:re.sub(r'&(sessions|access)=[^&\s\"\'<>]*','',m[0])+('&' if '?' in m[0] else '?')+'sessions='+VERSION+('&access='+ACCESS if name=='cash-day-control.js' else ''),s)
 tag='<script id="optykerCashSessionsJs" src="/cash-sessions.js?v='+VERSION+'&access='+ACCESS+'"></script>\n'
 if 'id="optykerCashSessionsJs"' not in s:
  pos=DocumentClosings(s).closings['body'];s=s[:pos]+tag+s[pos:]
 else:s=re.sub(r'<script\b[^>]*id="optykerCashSessionsJs"[^>]*>\s*</script>',tag.strip(),s)
 if 'id="optykerCashDaySessionsJs"' not in s and 'cash-day-control.js' not in s:
  pos=DocumentClosings(s).closings['body'];s=s[:pos]+'<script id="optykerCashDaySessionsJs" src="/cash-day-control.js?sessions='+VERSION+'&access='+ACCESS+'"></script>\n'+s[pos:]
 p.write_text(s)
 for alias in ('gestionale-v2','gestionale-v3'):
  d=site/alias;d.mkdir(exist_ok=True);(d/'index.html').write_bytes(p.read_bytes())
  for name in ('cash-day-control.js','admin-cash-closure.js','admin-cash-today-controls.js','cash-sessions.js'):shutil.copyfile(site/name,d/name)
 (site/'cash-sessions-version.json').write_text(json.dumps({'version':VERSION,'access_version':ACCESS,'features':['reopen_same_day','repeat_close','immutable_history','idempotent_confirmation','staff_unified_rch_close','fiscal_default_on','confirmed_fiscal_outcome','unified_header_footer_buttons','closure_date_selection','read_only_entrypoint_always_available']})+'\n')
if __name__=='__main__':patch(ROOT/'_site')
