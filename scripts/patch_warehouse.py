from pathlib import Path

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
css='<link rel="stylesheet" href="/warehouse.css?v=20260903-services-vat1" id="optykerWarehouseCss">'
js='<script src="/warehouse.js?v=20260903-services-vat1" id="optykerWarehouseJs"></script>'

if 'id="optykerWarehouseCss"' in text:
    import re
    text=re.sub(r'<link[^>]*id="optykerWarehouseCss"[^>]*>',css,text,count=1)
else:
    pos=text.find("</head>")
    text=(text[:pos]+css+"\n"+text[pos:]) if pos>=0 else css+"\n"+text

if 'id="optykerWarehouseJs"' in text:
    import re
    text=re.sub(r'<script[^>]*id="optykerWarehouseJs"[^>]*></script>',js,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+js+"\n"+text[pos:]) if pos>=0 else text+"\n"+js

path.write_text(text,encoding="utf-8")
print("Optyker warehouse loader OK")
