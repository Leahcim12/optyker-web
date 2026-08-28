from pathlib import Path

p = Path("_site/index.html")
s = p.read_text(encoding="utf-8")

MARK = "OPTYKER_VISUAL_TRAINING_DOCUMENTS_V1"

if MARK not in s:
    anchor = '''        <button class="primary" type="button" onclick="printIndicationsDocument()">Stampa documento</button>
      </div>
    </div>'''
    if anchor not in s:
        raise SystemExit("Box documenti manutenzione LAC non trovato")

    block = '''        <button class="primary" type="button" onclick="printIndicationsDocument()">Stampa documento</button>
      </div>
    </div>

    <!-- OPTYKER_VISUAL_TRAINING_DOCUMENTS_V1 -->
    <div class="iuDocsBox" id="iuVisualTrainingDocsBox">
      <div class="iuDocsTitle">DOCUMENTI DA STAMPARE VISUAL TRAINING</div>
      <div class="iuDocsHint">Seleziona il PDF di Visual Training che vuoi aprire e stampare.</div>
      <div class="iuDocsRow">
        <select id="iuVisualTrainingDocumentSelect">
          <option value="">— Seleziona documento —</option>
          <option value="visual-training/Tridimensionalita.pdf">Tridimensionalità</option>
          <option value="visual-training/Accomodazione.pdf">Accomodazione</option>
          <option value="visual-training/Convergenza.pdf">Convergenza</option>
          <option value="visual-training/Motorio.pdf">Motorio</option>
          <option value="visual-training/Sport.pdf">Sport</option>
        </select>
        <button class="primary" type="button" onclick="printVisualTrainingDocument()">Apri / stampa PDF</button>
      </div>
    </div>'''
    s = s.replace(anchor, block, 1)

    js_anchor = "function cleanFileNamePart(s){"
    if js_anchor not in s:
        raise SystemExit("Anchor JavaScript documenti non trovato")

    js = '''function printVisualTrainingDocument(){
  var sel=g('iuVisualTrainingDocumentSelect');
  var fileName=sel ? sel.value : '';
  if(!fileName){
    alert('Seleziona il documento Visual Training da stampare.');
    return;
  }
  var url=fileName;
  try{
    url=(new URL(fileName,window.location.href)).href;
  }catch(e){}
  var w=window.open(url,'_blank');
  if(!w){
    alert('Il browser ha bloccato l’apertura del PDF. Consenti i popup per Optyker e riprova.');
    return;
  }
  try{ w.focus(); }catch(e){}
}

'''
    s = s.replace(js_anchor, js + js_anchor, 1)
    p.write_text(s, encoding="utf-8")

check = p.read_text(encoding="utf-8")
required = [
    MARK,
    "DOCUMENTI DA STAMPARE VISUAL TRAINING",
    "visual-training/Tridimensionalita.pdf",
    "visual-training/Accomodazione.pdf",
    "visual-training/Convergenza.pdf",
    "visual-training/Motorio.pdf",
    "visual-training/Sport.pdf",
    "function printVisualTrainingDocument()"
]
missing = [x for x in required if x not in check]
if missing:
    raise SystemExit("Visual Training incompleto: " + ", ".join(missing))

print("Documenti Visual Training aggiunti")
