from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_RULES_V3'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_EYEWEAR_SHEET_V2' not in s:
    raise SystemExit('Scheda occhiali base non trovata')

def rep(old,new,name):
    global s
    if old not in s:
        raise SystemExit('Eyewear v3: pattern non trovato: '+name)
    s=s.replace(old,new,1)

# API con regole prezzo lato server.
rep("var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-api';",
    "var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-api-v3';",'api v3')

# Montatura: esempio richiesto + tipo montatura con opzione Del cliente.
rep("'<div class=\"eyField\"><label class=\"eyRequired\">Marca montatura</label><input id=\"eyFrameBrand\" placeholder=\"Es. Ray-Ban\"></div>'+",
    "'<div class=\"eyField\"><label class=\"eyRequired\">Marca montatura</label><input id=\"eyFrameBrand\" placeholder=\"Es. Michael Optyker\"></div>'+\n          '<div class=\"eyField\"><label>Tipo montatura</label><select id=\"eyFrameType\"><option value=\"\">Seleziona…</option><option>Cerchiata</option><option>Nylor</option><option>Glasant</option><option>Del cliente</option><option>Altro</option></select></div>'+",
    'marca e tipo montatura')

# Tipo lenti separato DX / SX, con Supporto accomodativo e Del cliente.
old_lens="'<div class=\"eyField\"><label class=\"eyRequired\">Tipo di lente</label><select id=\"eyLensType\"><option value=\"\">Seleziona…</option><option>Monofocale</option><option>Progressiva</option><option>Office / Indoor</option><option>Degradativa</option><option>Bifocale</option><option>Neutra / Sole</option><option>Altro</option></select></div>'+"
new_lens="'<div class=\"eyField\"><label class=\"eyRequired\">Tipo lente DX</label><select id=\"eyLensType\"><option value=\"\">Seleziona…</option><option>Monofocale</option><option>Progressiva</option><option>Supporto accomodativo</option><option>Office / Indoor</option><option>Degradativa</option><option>Bifocale</option><option>Neutra / Sole</option><option>Del cliente</option><option>Altro</option></select></div>'+\n          '<div class=\"eyField\"><label class=\"eyRequired\">Tipo lente SX</label><select id=\"eyLensTypeOS\"><option value=\"\">Seleziona…</option><option>Monofocale</option><option>Progressiva</option><option>Supporto accomodativo</option><option>Office / Indoor</option><option>Degradativa</option><option>Bifocale</option><option>Neutra / Sole</option><option>Del cliente</option><option>Altro</option></select></div>'+"
rep(old_lens,new_lens,'tipi lente DX SX')

# Trattamenti: prezzi richiesti, rimuove antigraffio e idrofobico/oleofobico.
for old,new,name in [
    ('<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Indurente">Indurente</label>', '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Indurente"><span>Indurente<small>€ 10 / lente</small></span></label>', 'indurente'),
    ('<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antiriflesso">Antiriflesso</label>', '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antiriflesso"><span>Antiriflesso<small>€ 15 / lente</small></span></label>', 'antiriflesso'),
    ('<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antiriflesso premium">Antiriflesso premium</label>', '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antiriflesso premium"><span>Antiriflesso premium<small>Solo ricetta · € 25 progressiva / € 20 altre</small></span></label>', 'antiriflesso premium'),
    ('<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Filtro luce blu">Filtro luce blu</label>', '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Filtro luce blu"><span>Luce blu<small>€ 25 / lente</small></span></label>', 'luce blu'),
    ('<label class="eyCheck"><input type="checkbox" data-ey-treatment value="UV">Protezione UV</label>', '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="UV"><span>Protezione U.V.<small>€ 5 / lente</small></span></label>', 'uv'),
    ('<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Polarizzato">Polarizzato</label>', '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Polarizzato"><span>Polarizzato<small>Solo lenti di ricetta · € 20 / lente</small></span></label>', 'polarizzato')
]:
    rep(old,new,name)
s=s.replace("          '<label class=\"eyCheck\"><input type=\"checkbox\" data-ey-treatment value=\"Idrofobico / oleofobico\">Idrofobico / oleofobico</label>'+\n",'',1)
s=s.replace("          '<label class=\"eyCheck\"><input type=\"checkbox\" data-ey-treatment value=\"Antigraffio\">Antigraffio</label>'+\n",'',1)
if 'Idrofobico / oleofobico' in s or 'data-ey-treatment value="Antigraffio"' in s:
    raise SystemExit('Eyewear v3: trattamenti da eliminare ancora presenti')

# Montaggio dopo i trattamenti.
rep("          '<label class=\"eyCheck\"><input type=\"checkbox\" data-ey-treatment value=\"Polarizzato\"><span>Polarizzato<small>Solo lenti di ricetta · € 20 / lente</small></span></label>'+\n        '</div><div class=\"eyStageActions\"><button class=\"eyBtn\" data-ey-prev=\"2\" type=\"button\">← Tipo lenti</button>',",
    "          '<label class=\"eyCheck\"><input type=\"checkbox\" data-ey-treatment value=\"Polarizzato\"><span>Polarizzato<small>Solo lenti di ricetta · € 20 / lente</small></span></label>'+\n        '</div><div class=\"eyMountingBox\"><div class=\"eyField\"><label>Montaggio</label><select id=\"eyMounting\"><option value=\"\">Nessun montaggio</option><option value=\"traditional\">Montaggio tradizionale</option><option value=\"special\">Montaggio speciale · € 25</option></select></div><div id=\"eyMountingHint\" class=\"eyRuleNote\">Tradizionale: € 25 con progressive/supporto accomodativo, € 15 con tutte le altre.</div></div><div class=\"eyStageActions\"><button class=\"eyBtn\" data-ey-prev=\"2\" type=\"button\">← Tipo lenti</button>',",
    'montaggio')

# Numero lenti calcolato automaticamente dalle scelte DX/SX (Del cliente non viene conteggiata come lente venduta).
rep("'<div class=\"eyField\"><label>Numero lenti</label><select id=\"eyLensQty\"><option value=\"2\" selected>2 lenti</option><option value=\"1\">1 lente</option></select></div>'+",
    "'<div class=\"eyField\"><label>Numero lenti da fornire</label><input id=\"eyLensQty\" value=\"0\" readonly></div>'+",
    'numero lenti automatico')

# Validazione DX/SX.
rep("    if(n>=3&&!String(E('eyLensType').value||'').trim()){toast('Seleziona il tipo di lente.','error');goStep(2);return false}",
    "    if(n>=3&&(!String(E('eyLensType').value||'').trim()||!String(E('eyLensTypeOS').value||'').trim())){toast('Seleziona il tipo di lente DX e SX.','error');goStep(2);return false}",
    'validazione dx sx')

# Sostituisce la logica prezzi con supplementi automatici.
start=s.find("  function colorMode(){")
end=s.find("  function frameOptionText(r){",start)
if start<0 or end<0:
    raise SystemExit('Eyewear v3: blocco prezzi non trovato')
new_price=r'''  function colorMode(){var x=document.querySelector('[data-ey-color].active');return x?x.getAttribute('data-ey-color'):'clear'}
  function treatments(){return Array.prototype.slice.call(document.querySelectorAll('[data-ey-treatment]:checked')).map(function(x){return x.value})}
  function num(id){var n=Number(E(id)&&E(id).value||0);return isFinite(n)?Math.round(n*100)/100:0}
  function lensTypes(){return [String(E('eyLensType')&&E('eyLensType').value||''),String(E('eyLensTypeOS')&&E('eyLensTypeOS').value||'')]}
  function isClientLens(t){return String(t||'').trim().toLowerCase()==='del cliente'}
  function isPrescriptionLens(t){var x=String(t||'').trim().toLowerCase();return !!x&&x!=='del cliente'&&!/neutra|sole/.test(x)}
  function isProgressiveSupport(t){return /progressiv|supporto\s+accomod/.test(String(t||'').toLowerCase())}
  function soldLensTypes(){return lensTypes().filter(function(t){return String(t||'').trim()&&!isClientLens(t)})}
  function prescriptionLensTypes(){return soldLensTypes().filter(isPrescriptionLens)}
  function treatmentDetails(){
    var sold=soldLensTypes(),rx=prescriptionLensTypes(),out=[];
    treatments().forEach(function(tr){var amount=0,unit=0,count=0;
      if(tr==='Indurente'){unit=10;count=sold.length;amount=unit*count}
      else if(tr==='Antiriflesso'){unit=15;count=sold.length;amount=unit*count}
      else if(tr==='Filtro luce blu'){unit=25;count=sold.length;amount=unit*count}
      else if(tr==='UV'){unit=5;count=sold.length;amount=unit*count}
      else if(tr==='Polarizzato'){unit=20;count=rx.length;amount=unit*count}
      else if(tr==='Antiriflesso premium'){count=rx.length;amount=rx.reduce(function(sum,t){return sum+(isProgressiveSupport(t)?25:20)},0)}
      amount=Math.round(amount*100)/100;out.push({name:tr,unit:tr==='Antiriflesso premium'?null:unit,count:count,total:amount})
    });return out
  }
  function mountingInfo(){var m=String(E('eyMounting')&&E('eyMounting').value||''),price=0,label='';if(m==='special'){price=25;label='Montaggio speciale'}else if(m==='traditional'){price=lensTypes().some(isProgressiveSupport)?25:15;label='Montaggio tradizionale'}return {mode:m,label:label,price:price}}
  function refreshEyRules(){
    var qty=soldLensTypes().length;if(E('eyLensQty'))E('eyLensQty').value=String(qty);
    var hasRx=prescriptionLensTypes().length>0;
    ['Antiriflesso premium','Polarizzato'].forEach(function(v){var x=document.querySelector('[data-ey-treatment][value="'+v+'"]');if(!x)return;x.disabled=!hasRx;if(!hasRx)x.checked=false;var lab=x.closest('label');if(lab)lab.classList.toggle('disabled',!hasRx)});
    var mi=mountingInfo(),hint=E('eyMountingHint');if(hint)hint.textContent=mi.mode==='traditional'?('Montaggio tradizionale: '+euro(mi.price)+'. Progressive/supporto accomodativo € 25; tutte le altre € 15.'):(mi.mode==='special'?'Montaggio speciale: € 25.':'Tradizionale: € 25 con progressive/supporto accomodativo, € 15 con tutte le altre.');
  }
  function price(){
    refreshEyRules();
    var frame=num('eyFramePrice'),unit=num('eyLensPrice'),qty=soldLensTypes().length,discount=Math.max(0,Math.min(100,Number(E('eyDiscount').value||0)));
    var gross=Math.round(unit*qty*100)/100,disc=Math.round(gross*discount)/100,net=Math.round((gross-disc)*100)/100;
    var td=treatmentDetails(),treatmentTotal=Math.round(td.reduce(function(a,x){return a+Number(x.total||0)},0)*100)/100,mi=mountingInfo();
    var total=Math.round((frame+net+treatmentTotal+mi.price)*100)/100;
    return {frame:frame,unit:unit,qty:qty,gross:gross,discount:discount,disc:disc,net:net,treatmentDetails:td,treatmentTotal:treatmentTotal,mounting:mi.label,mountingPrice:mi.price,total:total}
  }
  function renderSummary(){
    var p=price(),box=E('eySummary');if(!box)return;
    var extras=p.treatmentDetails.map(function(x){return '<div class="eySummaryRow"><span>'+esc(x.name)+(x.count?' · '+x.count+' lente'+(x.count===1?'':'i'):'')+'</span><b>'+esc(euro(x.total))+'</b></div>'}).join('');
    box.innerHTML='<div class="eySummaryRow"><span>Montatura</span><b>'+esc(euro(p.frame))+'</b></div>'+ 
      '<div class="eySummaryRow"><span>Lenti · '+p.qty+' × '+esc(euro(p.unit))+'</span><b>'+esc(euro(p.gross))+'</b></div>'+ 
      (p.discount?'<div class="eySummaryRow discount"><span>Sconto lenti '+p.discount+'%</span><b>− '+esc(euro(p.disc))+'</b></div>':'')+
      '<div class="eySummaryRow"><span>Totale lenti dopo sconto</span><b>'+esc(euro(p.net))+'</b></div>'+extras+
      (p.mounting?'<div class="eySummaryRow"><span>'+esc(p.mounting)+'</span><b>'+esc(euro(p.mountingPrice))+'</b></div>':'')+
      '<div class="eySummaryRow total"><span>Totale '+(S.mode==='quote'?'preventivo':'busta')+'</span><b>'+esc(euro(p.total))+'</b></div>'
  }
'''
s=s[:start]+new_price+s[end:]

# Binding: aggiorna prezzo/regole ad ogni variazione.
rep("    ['eyFramePrice','eyLensPrice','eyLensQty','eyDiscount'].forEach(function(id){E(id).oninput=renderSummary;E(id).onchange=renderSummary});",
    "    ['eyFramePrice','eyLensPrice','eyDiscount','eyLensType','eyLensTypeOS','eyMounting'].forEach(function(id){if(!E(id))return;E(id).oninput=function(){refreshEyRules();renderSummary()};E(id).onchange=function(){refreshEyRules();renderSummary()}});document.querySelectorAll('[data-ey-treatment]').forEach(function(x){x.onchange=function(){refreshEyRules();renderSummary()}});refreshEyRules();",
    'binding prezzi')

# Se si sceglie una lente dal listino, la applica a DX e SX di default.
rep("    if(r.lens_type)E('eyLensType').value=r.lens_type;if(r.design)E('eyLensDesign').value=r.design;if(r.material)E('eyLensMaterial').value=r.material;if(r.refractive_index)E('eyLensIndex').value=r.refractive_index;",
    "    if(r.lens_type){E('eyLensType').value=r.lens_type;E('eyLensTypeOS').value=r.lens_type}if(r.design)E('eyLensDesign').value=r.design;if(r.material)E('eyLensMaterial').value=r.material;if(r.refractive_index)E('eyLensIndex').value=r.refractive_index;",
    'catalogo dx sx')
rep("    E('eyCatalogSelected').innerHTML='<div class=\"eySelectedLens\"><b>Lente selezionata:</b> '+esc([r.brand,r.lens_name,r.code].filter(Boolean).join(' · '))+' · '+esc(euro(r.unit_price))+'</div>';renderSummary()",
    "    E('eyCatalogSelected').innerHTML='<div class=\"eySelectedLens\"><b>Lente selezionata:</b> '+esc([r.brand,r.lens_name,r.code].filter(Boolean).join(' · '))+' · '+esc(euro(r.unit_price))+'</div>';refreshEyRules();renderSummary()",
    'catalogo refresh')

# Payload nuovo.
start=s.find("  function payload(){")
end=s.find("  function save(){",start)
if start<0 or end<0:
    raise SystemExit('Eyewear v3: payload non trovato')
new_payload=r'''  function payload(){
    var p=price(),cm=colorMode(),lt=lensTypes(),general=lt[0]===lt[1]?lt[0]:('DX: '+lt[0]+' / SX: '+lt[1]);
    return {mode:S.mode,client_id:E('eyClient').value||'',frame:{brand:E('eyFrameBrand').value,model:E('eyFrameModel').value,type:E('eyFrameType').value||'',color:E('eyFrameColor').value,description:E('eyFrameDescription').value,price:p.frame,warehouse_item_id:S.selectedFrame&&S.selectedFrame.id||'',barcode:E('eyFrameBarcode').value||'',sku:E('eyFrameSku').value||'',stock_quantity:S.selectedFrame?Number(S.selectedFrame.inventory_quantity||0):null},lens:{catalog_id:S.selected&&S.selected.id||'',code:S.selected&&S.selected.code||'',supplier:S.selected&&S.selected.supplier||'',brand:E('eyLensBrand').value,lens_name:E('eyLensName').value,lens_type:general,lens_type_od:lt[0],lens_type_os:lt[1],design:E('eyLensDesign').value,material:E('eyLensMaterial').value,refractive_index:E('eyLensIndex').value,treatments:treatments(),mounting:E('eyMounting').value||'',color_mode:cm,color:cm==='clear'?'':E('eyLensColor').value,polarized:treatments().indexOf('Polarizzato')>=0,photochromic:cm==='photochromic',quantity:p.qty,unit_price:p.unit},discount_percent:p.discount,notes:E('eyNotes').value||''}
  }
'''
s=s[:start]+new_payload+s[end:]

# Reset dei nuovi campi.
rep("    ['eyFrameBrand','eyFrameModel','eyFrameColor','eyFrameDescription','eyFramePrice','eyFrameBarcode','eyFrameSku','eyFrameBarcodeSearch','eyFrameWarehouseSearch','eyLensDesign','eyLensMaterial','eyLensBrand','eyLensName','eyLensPrice','eyLensColor','eyLensColorNotes','eyNotes','eyCatalogSearch','eyReference'].forEach(function(id){if(E(id))E(id).value=''});",
    "    ['eyFrameBrand','eyFrameModel','eyFrameType','eyFrameColor','eyFrameDescription','eyFramePrice','eyFrameBarcode','eyFrameSku','eyFrameBarcodeSearch','eyFrameWarehouseSearch','eyLensDesign','eyLensMaterial','eyLensBrand','eyLensName','eyLensPrice','eyLensColor','eyLensColorNotes','eyNotes','eyCatalogSearch','eyReference'].forEach(function(id){if(E(id))E(id).value=''});",
    'reset frame type')
rep("    E('eyLensType').value='';E('eyLensIndex').value='';E('eyLensQty').value='2';E('eyDiscount').value='0';document.querySelectorAll('[data-ey-treatment]').forEach(function(x){x.checked=false});",
    "    E('eyLensType').value='';E('eyLensTypeOS').value='';E('eyLensIndex').value='';E('eyLensQty').value='0';E('eyMounting').value='';E('eyDiscount').value='0';document.querySelectorAll('[data-ey-treatment]').forEach(function(x){x.checked=false});refreshEyRules();",
    'reset lens fields')

# Stampa: mostra costi extra e montaggio.
s=s.replace("<div class=\"row\"><span>Trattamenti</span><span>'+esc(p.lens.treatments.join(', ')||'—')+'</span></div>","<div class=\"row\"><span>Trattamenti</span><span>'+esc(p.lens.treatments.join(', ')||'—')+' · '+esc(euro(pr.treatmentTotal))+'</span></div>" ,1)
s=s.replace("<div class=\"row\"><span>Colore</span><span>'+esc(p.lens.color_mode==='clear'?'Trasparente':(p.lens.color||p.lens.color_mode))+'</span></div>","<div class=\"row\"><span>Colore</span><span>'+esc(p.lens.color_mode==='clear'?'Trasparente':(p.lens.color||p.lens.color_mode))+'</span></div>'+(pr.mounting?'<div class=\"row\"><span>'+esc(pr.mounting)+'</span><b>'+esc(euro(pr.mountingPrice))+'</b></div>':'')+'" ,1)

# CSS supplementare.
style=r'''<style id="optykerEyewearRulesV3Css">/* OPTYKER_EYEWEAR_RULES_V3 */
.eyCheck span{display:flex;flex-direction:column;gap:2px}.eyCheck small{display:block;font-size:7px;font-weight:750;color:#7a8d9b;line-height:1.3}.eyCheck.disabled{opacity:.42;cursor:not-allowed;background:#f2f4f6}.eyCheck.disabled input{cursor:not-allowed}.eyMountingBox{margin-top:12px;border:1px solid #d7e3eb;border-radius:10px;background:#f7fafc;padding:11px;display:grid;grid-template-columns:minmax(220px,.7fr) minmax(260px,1fr);gap:10px;align-items:end}.eyRuleNote{font-size:8px;color:#647b8d;line-height:1.45;padding:8px 10px;border-radius:8px;background:#fff;border:1px solid #e0e8ee}@media(max-width:700px){.eyMountingBox{grid-template-columns:1fr}}
</style>'''
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit('Eyewear v3: body non trovato')
s=s[:pos]+style+s[pos:]

# Verifiche finali.
for req in [MARK,'Es. Michael Optyker','eyFrameType','eyLensTypeOS','Supporto accomodativo','Del cliente','€ 10 / lente','€ 15 / lente','€ 25 / lente','eyMounting','optyker-eyewear-api-v3']:
    if req not in s: raise SystemExit('Eyewear v3 incompleta: '+req)
if 'data-ey-treatment value="Antigraffio"' in s or 'Idrofobico / oleofobico' in s:
    raise SystemExit('Eyewear v3: trattamenti eliminati ancora presenti')
p.write_text(s,encoding='utf-8')
print('Optyker eyewear rules v3 OK')
