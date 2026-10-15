from pathlib import Path
import re

ROOT = Path('_site')
MARK = 'OPTYKER_DDT_VIEW_20261015'
for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = ROOT / rel
    text = path.read_text()
    if MARK in text:
        continue
    def replace_once(old, new):
        global text
        if text.count(old) != 1:
            raise SystemExit(f'DDT contract changed in {rel}: {old[:70]}')
        text = text.replace(old, new, 1)
    replace_once('<th>Causale</th><th>Stato</th></tr></thead><tbody>', '<th>Causale</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>')
    replace_once("esc(r.status||'bozza')+'</span></td></tr>'});", "esc(r.status||'bozza')+'</span></td><td><button type=\"button\" class=\"optykerDocsRefresh\" data-ddt-view>Visualizza / Stampa</button></td></tr>'});")
    replace_once("box.innerHTML=h+'</tbody></table>'", """box.innerHTML=h+'</tbody></table>';
      // OPTYKER_DDT_VIEW_20261015: bind each rendered row to its own document.
      var documents=S.rows.slice();
      box.querySelectorAll('tbody tr').forEach(function(row,index){
        function open(){window.optykerViewDdt(documents[index])}
        row.querySelector('[data-ddt-view]').onclick=open;
        var number=row.cells[1].querySelector('.optykerDocsMain');
        var link=document.createElement('button');link.type='button';link.textContent=number.textContent;
        link.style.cssText='border:0;background:none;padding:0;color:inherit;font:inherit;text-decoration:underline;cursor:pointer;text-align:left';
        link.setAttribute('aria-label','Visualizza DDT '+number.textContent);link.onclick=open;
        number.textContent='';number.appendChild(link);
      })""")
    replace_once('function printDdt(r){', 'function printDdt(r,preview){')
    # Reuse the existing full document renderer; preview opens synchronously on click.
    replace_once("<script>window.onload=function(){setTimeout(function(){window.print()},180)}", "<script>window.onload=function(){if(!document.querySelector(\".ddtPreviewToolbar\"))setTimeout(function(){window.print()},180)}")
    replace_once("w.document.open();w.document.write(html);w.document.close()}", """if(preview){html=html.replace('</style>','.ddtPreviewToolbar{margin-bottom:16px;display:flex;gap:10px}.ddtPreviewToolbar button{padding:10px 16px;cursor:pointer}@media print{.ddtPreviewToolbar{display:none!important}}'+'</style>').replace('<body>','<body><div class="ddtPreviewToolbar"><button type="button" onclick="window.print()">Stampa / Salva PDF</button><button type="button" onclick="window.close()">Chiudi</button></div>')}w.document.open();w.document.write(html);w.document.close()}
  window.optykerViewDdt=function(r){printDdt(r,true)};""")
    path.write_text(text)
print('DDT: apertura e anteprima di stampa disponibili nei tre accessi desktop')
