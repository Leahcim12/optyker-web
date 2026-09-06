from pathlib import Path
import re

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260906-company-select1"
tag=f'<script src="/form-automation.js?v={version}" id="optykerFormAutomationJs"></script>'
frame_addon=Path("frame-form-addon.js").read_text(encoding="utf-8")
frame_tag='<script id="optykerWarehouseFrameFormJs">'+frame_addon+'</script>'
solution_addon=Path("lac-solution-form-addon.js").read_text(encoding="utf-8")
solution_tag='<script id="optykerWarehouseLacSolutionFormJs">'+solution_addon+'</script>'
supplement_addon=Path("supplement-form-addon.js").read_text(encoding="utf-8")
supplement_tag='<script id="optykerWarehouseSupplementFormJs">'+supplement_addon+'</script>'
company_addon=Path("company-select-addon.js").read_text(encoding="utf-8")
company_tag='<script id="optykerWarehouseCompanySelectJs">'+company_addon+'</script>'

if 'id="optykerFormAutomationJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerFormAutomationJs"[^>]*></script>',tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+tag

if 'id="optykerWarehouseFrameFormJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerWarehouseFrameFormJs"[^>]*>[\s\S]*?</script>',frame_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+frame_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+frame_tag

if 'id="optykerWarehouseLacSolutionFormJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerWarehouseLacSolutionFormJs"[^>]*>[\s\S]*?</script>',solution_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+solution_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+solution_tag

if 'id="optykerWarehouseSupplementFormJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerWarehouseSupplementFormJs"[^>]*>[\s\S]*?</script>',supplement_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+supplement_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+supplement_tag

if 'id="optykerWarehouseCompanySelectJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerWarehouseCompanySelectJs"[^>]*>[\s\S]*?</script>',company_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+company_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+company_tag

path.write_text(text,encoding="utf-8")
print("Optyker form automation loader OK",version,"frame + LAC solutions + supplements + company selector")
