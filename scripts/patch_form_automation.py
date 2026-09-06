from pathlib import Path
import re

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260906-lens-list1"
tag=f'<script src="/form-automation.js?v={version}" id="optykerFormAutomationJs"></script>'
frame_addon=Path("frame-form-addon.js").read_text(encoding="utf-8")
frame_tag='<script id="optykerWarehouseFrameFormJs">'+frame_addon+'</script>'
solution_addon=Path("lac-solution-form-addon.js").read_text(encoding="utf-8")
solution_tag='<script id="optykerWarehouseLacSolutionFormJs">'+solution_addon+'</script>'
supplement_addon=Path("supplement-form-addon.js").read_text(encoding="utf-8")
supplement_tag='<script id="optykerWarehouseSupplementFormJs">'+supplement_addon+'</script>'
company_addon=Path("company-select-addon.js").read_text(encoding="utf-8")
company_tag='<script id="optykerWarehouseCompanySelectJs">'+company_addon+'</script>'
eyewear_addon=Path("eyewear-rules-addon.js").read_text(encoding="utf-8")
eyewear_tag='<script id="optykerEyewearRulesRuntimeJs">'+eyewear_addon+'</script>'
eyewear_extra_addon=Path("eyewear-extra-treatments-addon.js").read_text(encoding="utf-8")
eyewear_extra_tag='<script id="optykerEyewearExtraTreatmentsJs">'+eyewear_extra_addon+'</script>'
catalog_types_addon=Path("eyewear-catalog-types-addon.js").read_text(encoding="utf-8")
catalog_types_tag='<script id="optykerEyewearCatalogTypesJs">'+catalog_types_addon+'</script>'

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

if 'id="optykerEyewearRulesRuntimeJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerEyewearRulesRuntimeJs"[^>]*>[\s\S]*?</script>',eyewear_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+eyewear_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+eyewear_tag

if 'id="optykerEyewearExtraTreatmentsJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerEyewearExtraTreatmentsJs"[^>]*>[\s\S]*?</script>',eyewear_extra_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+eyewear_extra_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+eyewear_extra_tag

if 'id="optykerEyewearCatalogTypesJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerEyewearCatalogTypesJs"[^>]*>[\s\S]*?</script>',catalog_types_tag,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+catalog_types_tag+"\n"+text[pos:]) if pos>=0 else text+"\n"+catalog_types_tag

path.write_text(text,encoding="utf-8")
print("Optyker form automation loader OK",version,"frame + LAC solutions + supplements + company selector + eyewear rules + extra treatments + lens catalog types")
