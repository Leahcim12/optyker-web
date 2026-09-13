"""Repair agenda routing/loading and replace the duplicated WhatsApp onboarding."""
from pathlib import Path
from shutil import copyfile
import re
from apply_ts_connection import DocumentClosings

root=Path('_site');page=root/'index.html';text=page.read_text()
MARK='OPTYKER_AGENDA_WHATSAPP_20260913'
def once(old,new):
    global text
    if text.count(old)!=1:raise SystemExit('Agenda/WhatsApp source anchor changed: '+old[:100])
    text=text.replace(old,new,1)

if MARK not in text:
    fragments=Path('scripts/agenda_loading_fragment.js').read_text()
    request,rest=fragments.split('// BOOT\n');boot,load=rest.split('// LOAD\n')
    request=request.replace('// REQUEST\n','',1)
    start=text.index('<script id="optykerAppointmentsJs">');end=text.index('</script>',start)
    original=text[start:end];script=original
    a=script.index('function api(a,p){');b=script.index('function slotsApi()',a)
    script=script[:a]+request+script[b:]
    a=script.index('function boot(force){');b=script.index('window.optykerAgendaBoot=',a)
    script=script[:a]+boot+script[b:]
    a=script.index('function load(){');b=script.index('function filtered()',a)
    script=script[:a]+load+script[b:]
    script=script.replace("return boot(false).then(load)}window.optykerAgendaDirectOpen", "return agendaRefresh(false)}window.optykerAgendaDirectOpen",1)
    script=script.replace("E('oaReload').onclick=function(){boot(true).then(load)}", "E('oaReload').onclick=function(){agendaRefresh(true)}",1)
    if 'return agendaRefresh(false)' not in script or "onclick=function(){agendaRefresh(true)}" not in script:raise SystemExit('Agenda open/retry anchor missing')
    text=text[:start]+script+text[end:]
    # Document capture stopped the newer navigation handler. Use the wrapped route.
    once("if(typeof window.optykerAgendaDirectOpen==='function')window.optykerAgendaDirectOpen();\n      else if(typeof window.optykerOpenAppointments==='function')window.optykerOpenAppointments();", "if(typeof window.optykerOpenAppointments==='function')window.optykerOpenAppointments();\n      else if(typeof window.optykerAgendaDirectOpen==='function')window.optykerAgendaDirectOpen();")
    once("else if(id==='navClients'&&typeof window.showModule==='function')window.showModule('clients');", "else if(id==='navWhatsAppConnect'&&typeof window.optykerOpenWhatsAppSimple==='function')window.optykerOpenWhatsAppSimple();\n    else if(id==='navClients'&&typeof window.showModule==='function')window.showModule('clients');")
    # Drop the three competing signup controllers; retain the existing protected fields.
    for ident in ('optykerWhatsappQrConnectJs','optykerWhatsappSimpleJs','optykerWhatsappMetaBlockHelpJs'):
        text,n=re.subn(r'<script[^>]*id="'+ident+r'"[^>]*>.*?</script>','',text,flags=re.S)
        if n!=1:raise SystemExit('Expected one WhatsApp controller: '+ident)
    once("function setMode(where,ch){if(ch==='whatsapp'&&!cfg.enabled){window.optykerOpenSettings();", "window.addEventListener('optyker:whatsapp-settings',function(ev){cfg=ev.detail||{};cfg.__loaded=true;refreshBars()});\nfunction setMode(where,ch){if(ch==='whatsapp'&&!cfg.enabled){window.optykerOpenWhatsAppSimple();")
    text=text.replace('id="oaStatus" class="oaStatus"','id="oaStatus" class="oaStatus" role="status" aria-live="polite"',1)
    closing=DocumentClosings(text).closings
    for tag in sorted(closing,key=closing.get,reverse=True):
        asset=('<link rel="stylesheet" id="optykerWhatsAppConnectCss" href="/whatsapp-connect.css?v=20260913-1">\n' if tag=='head' else
               '<script id="optykerWhatsAppConnectJs" src="/whatsapp-connect.js?v=20260913-1"></script>\n<!-- '+MARK+' -->\n')
        pos=closing[tag];text=text[:pos]+asset+text[pos:]
# Navigation was already cached under the previous release's URL.
text,n=re.subn(r'(<script[^>]*id="optykerSept11Js"[^>]*src="[^"?]+)\?[^"<>]*',r'\1?v=20260913-agenda1',text)
if n!=1:raise SystemExit('Expected one versioned navigation loader')
for filename in ('whatsapp-connect.js','whatsapp-connect.css'):copyfile(filename,root/filename)
page.write_text(text)
for alias in ('gestionale-v2','gestionale-v3'):(root/alias/'index.html').write_text(text)
print('Agenda routing, recoverable loading and simple WhatsApp access installed')
