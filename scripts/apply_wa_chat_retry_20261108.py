"""WhatsApp 20261108: the chat "WhatsApp" button re-reads the connection before sending the operator to Settings.

The inline WhatsApp chat script reads the connection once when the page loads. If the page loads before the
operator logs in, that read fails and the first click on "WhatsApp" opens Settings instead of the conversation.
Now the click asks the server again first, and opens Settings only if WhatsApp is really not connected.
"""
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / '_site'
MARK = 'OPTYKER_WA_CHAT_RETRY_20261108'
OLD = "function setMode(where,ch){if(ch==='whatsapp'&&!cfg.enabled){window.optykerOpenWhatsAppSimple();"
NEW = ("/* " + MARK + " */function setMode(where,ch){"
       "if(ch==='whatsapp'&&!cfg.enabled&&!cfg.__retry){"
       "return api('settings_get',{}).then(function(x){cfg=x.data||{};cfg.__loaded=true;cfg.__retry=true;refreshBars();setMode(where,ch)})"
       ".catch(function(){cfg.__retry=true;setMode(where,ch)})}"
       "if(ch==='whatsapp'&&!cfg.enabled){cfg.__retry=false;window.optykerOpenWhatsAppSimple();")

for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    if MARK in html:
        continue
    if html.count(OLD) != 1:
        raise SystemExit('WhatsApp chat: setMode contract changed in ' + rel)
    path.write_text(html.replace(OLD, NEW, 1), encoding='utf-8')
print('WhatsApp: il pulsante della chat ricontrolla il collegamento prima di aprire le Impostazioni')
