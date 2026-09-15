from pathlib import Path

MARK='OPTYKER_AGENDA_AUTO_STUDIO_20260915'
FILES=[Path('_site/index.html'),Path('_site/gestionale-v2/index.html'),Path('_site/gestionale-v3/index.html')]

OLD="var studio=E('oaStudio');if(studio){studio.value='';var f=studio.closest('.oaF');if(f)f.classList.add('oaUnifiedStudioHidden')}"
NEW="""var studio=E('oaStudio');if(studio){var f=studio.closest('.oaF');if(f)f.classList.add('oaUnifiedStudioHidden');if(!studio.disabled&&!studio.value&&studio.options&&studio.options.length>1){var autoStudio='';for(var asi=0;asi<studio.options.length;asi++){if(String(studio.options[asi].value||'')!==''){autoStudio=studio.options[asi].value;break}}if(autoStudio!==''){studio.value=autoStudio;try{studio.dispatchEvent(new Event('change',{bubbles:true}))}catch(autoErr){if(typeof studio.onchange==='function')studio.onchange()}}}}"""

OPEN_OLD="modal('oaNewModal',true)})}function oaRomeIso"
OPEN_NEW="modal('oaNewModal',true)}).catch(function(e){var m=agendaError(e);status('oaStatus',m,true);alert('Impossibile aprire nuovo appuntamento: '+m)})}function oaRomeIso"

for path in FILES:
    text=path.read_text(encoding='utf-8')
    if MARK in text:
        continue
    if OLD not in text:
        raise SystemExit(f'Legacy agenda studio reset not found in {path}')
    if text.count(OLD)!=1:
        raise SystemExit(f'Unexpected agenda studio reset count in {path}: {text.count(OLD)}')
    text=text.replace(OLD,NEW,1)
    if OPEN_OLD in text:
        text=text.replace(OPEN_OLD,OPEN_NEW,1)
    body=text.rfind('</body>')
    if body<0:
        raise SystemExit(f'Closing body not found in {path}')
    text=text[:body]+f'<!-- {MARK} -->\n'+text[body:]
    path.write_text(text,encoding='utf-8')

main=FILES[0].read_text(encoding='utf-8')
required=[MARK,"autoStudio", "dispatchEvent(new Event('change',{bubbles:true}))", "E('oaCreate').onclick=create", "E('oaNew').onclick=openNew"]
for item in required:
    if item not in main:
        raise SystemExit('Agenda auto-studio repair incomplete: '+item)
if OLD in main:
    raise SystemExit('Legacy studio reset is still present')
if FILES[1].read_bytes()!=FILES[0].read_bytes() or FILES[2].read_bytes()!=FILES[0].read_bytes():
    raise SystemExit('Desktop aliases differ after agenda auto-studio repair')
print('Agenda appointment creation repaired: hidden studio auto-assigned and no longer reset')
