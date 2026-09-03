from pathlib import Path
import re

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260903-rxrules2"
tag=f'<script src="/form-automation.js?v={version}" id="optykerFormAutomationJs"></script>'

if 'id="optykerFormAutomationJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerFormAutomationJs"[^>]*></script>',tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+tag

path.write_text(text,encoding="utf-8")
print("Optyker form automation loader OK",version)
