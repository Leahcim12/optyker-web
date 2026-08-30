from pathlib import Path

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
css='<link rel="stylesheet" href="/warehouse.css?v=20260830-3" id="optykerWarehouseCss">'
js='<script src="/warehouse.js?v=20260830-3" id="optykerWarehouseJs"></script>'

if 'id="optykerWarehouseCss"' not in text:
    pos=text.find("</head>")
    text=(text[:pos]+css+"\n"+text[pos:]) if pos>=0 else css+"\n"+text

if 'id="optykerWarehouseJs"' not in text:
    pos=text.rfind("</body>")
    text=(text[:pos]+js+"\n"+text[pos:]) if pos>=0 else text+"\n"+js

path.write_text(text,encoding="utf-8")
print("Optyker warehouse loader OK")
