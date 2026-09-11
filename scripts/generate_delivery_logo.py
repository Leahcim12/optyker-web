"""Embed the original prescription logo as PNG for the server PDF renderer."""
from pathlib import Path
from PIL import Image
import re,io,base64
root=Path(__file__).resolve().parent.parent
s=(root/'_site/index.html').read_text()
x=re.search(r"var OPTYKER_PRINT_LOGO_DATA='([^']+)'",s)[1]
assert x.startswith('data:image/'), 'Original print logo missing'
b=io.BytesIO();Image.open(io.BytesIO(base64.b64decode(x.split(',')[1]))).convert('RGBA').save(b,format='PNG')
p=root/'supabase/functions/optyker-eyewear-delivery/logo.mjs'
p.write_text("export const LOGO='data:image/png;base64,"+base64.b64encode(b.getvalue()).decode()+"';\n")
