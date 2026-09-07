from pathlib import Path

p = Path("iphone-app-v13/index.html")
s = p.read_text(encoding="utf-8")
MARK = "OPTYKER_IPHONE_CUSTOMER_EYEWEAR_V1"
NEW_BUILD = "20260903-rxrules2"

if MARK not in s:
    # Endpoint autenticato dedicato agli occhiali del cliente.
    needle = "const API=U+'/functions/v1/optyker-mobile-api';"
    if needle not in s:
        raise SystemExit("Costante API non trovata")
    s = s.replace(needle, needle + "\nconst EYEWEAR_API=U+'/functions/v1/optyker-customer-eyewear';", 1)

    # Stato cliente: lista occhiali separata dal resto della home.
    if "home:null,appointments:[]" not in s:
        raise SystemExit("Stato home cliente non trovato")
    s = s.replace("home:null,appointments:[]", "home:null,eyewear:[],appointments:[]")

    markup = r'''
/* OPTYKER_IPHONE_CUSTOMER_EYEWEAR_V1 */
function eyewearMarkup(){
  const rows=Array.isArray(state.eyewear)?state.eyewear:[];
  const join=(a)=>a.filter(Boolean).join(' · ');
  const value=(label,v)=>v?`<div class="field"><b>${esc(label)}</b><span style="text-align:right;max-width:68%">${esc(v)}</span></div>`:'';
  const lensText=(eye,fallback={})=>join([eye?.brand||fallback.brand,eye?.name||fallback.name,eye?.type,eye?.design||fallback.design,eye?.material||fallback.material]);
  const cards=rows.map((x,i)=>{
    const f=x?.frame||{},l=x?.lenses||{},w=x?.warranty||{};
    const treatments=Array.isArray(l.treatments)?l.treatments.filter(Boolean):[];
    const optical=join([l.refractive_index?('Indice '+l.refractive_index):'',l.geometry,l.mounting]);
    const color=join([l.color_mode,l.color,l.photochromic?'Fotocromatico':'',l.polarized?'Polarizzato':'']);
    const ref=x?.reference||'Occhiale';
    const frame=join([f.brand,f.model,f.type,f.color])||f.description||'Montatura registrata';
    return `<div class="card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div><h2 style="margin-bottom:3px">${esc(ref)}</h2><div class="tiny">${i===0?'Ultimo occhiale registrato':'Occhiale precedente'}${x?.registered_at?' · '+esc(fmtDate(x.registered_at)):''}</div></div>
        <span style="display:inline-flex;align-items:center;border-radius:999px;background:#edf5fb;color:#1769aa;padding:6px 9px;font-size:9px;font-weight:900;white-space:nowrap">${esc('Garanzia '+(w.name||'Base'))}</span>
      </div>
      ${value('Montatura',frame)}
      ${value('Lente OD',lensText(l.od,l))}
      ${value('Lente OS',lensText(l.os,l))}
      ${value('Caratteristiche lenti',optical)}
      ${value('Trattamenti',treatments.join(' · '))}
      ${value('Colore / tecnologia',color)}
      ${value('Garanzia',w.name||'Base')}
      ${value('Fascia garanzia',w.eligibility||'')}
    </div>`;
  }).join('');
  return `<div class="page"><div class="header"><div class="eyebrow">OTTICA VISUAL CARE</div><h1>I miei occhiali</h1><div class="sub">Montatura, lenti e garanzia associate alla tua anagrafica Optyker</div></div>${cards||'<div class="card"><div class="empty">Non risultano ancora occhiali collegati alla tua anagrafica.</div></div>'}</div>`;
}
'''
    needle = "function usageInstructionsMarkup(){"
    if needle not in s:
        raise SystemExit("Punto inserimento markup occhiali non trovato")
    s = s.replace(needle, markup + "\n" + needle, 1)

    # Routing della nuova pagina.
    needle = "  if(tab==='instructions')return usageInstructionsMarkup();"
    if needle not in s:
        raise SystemExit("Routing Indicazioni d'uso non trovato")
    s = s.replace(needle, "  if(tab==='eyewear')return eyewearMarkup();\n" + needle, 1)

    # Pulsante laterale visibile soltanto quando esiste almeno un occhiale collegato.
    needle = '        <button class="drawerBtn" data-nav="rx" onclick="goTab(\'rx\')">Prescrizione</button>'
    if needle not in s:
        raise SystemExit("Pulsante Prescrizione nel drawer non trovato")
    eye_btn = '        <button class="drawerBtn ${state.eyewear?.length?\'\':\'hidden\'}" data-nav="eyewear" onclick="goTab(\'eyewear\')">I miei occhiali</button>\n'
    s = s.replace(needle, eye_btn + needle, 1)

    # Caricamento iniziale insieme a home e agenda. Un errore del modulo occhiali non blocca l'app.
    needle = "const [homeX,apptX]=await Promise.all([call(API,'customer_home'),call(APPT,'history')]);"
    if needle not in s:
        raise SystemExit("Caricamento iniziale cliente non trovato")
    s = s.replace(needle, "const [homeX,apptX,eyeX]=await Promise.all([call(API,'customer_home'),call(APPT,'history'),call(EYEWEAR_API,'list').catch(()=>({data:[]}))]);", 1)
    needle = "state.home=homeX.data||null;state.appointments=Array.isArray(apptX.data)?apptX.data:[];"
    if needle not in s:
        raise SystemExit("Assegnazione home cliente non trovata")
    s = s.replace(needle, "state.home=homeX.data||null;state.eyewear=Array.isArray(eyeX.data)?eyeX.data:[];state.appointments=Array.isArray(apptX.data)?apptX.data:[];", 1)

    # Refresh live: aggiorna anche gli occhiali se in negozio viene salvata una nuova busta.
    needle = "const r=await Promise.all([call(API,'customer_home'),call(APPT,'history')]);"
    if needle not in s:
        raise SystemExit("Refresh live cliente non trovato")
    s = s.replace(needle, "const r=await Promise.all([call(API,'customer_home'),call(APPT,'history'),call(EYEWEAR_API,'list').catch(()=>({data:state.eyewear||[]}))]);", 1)
    needle = "const nextHome=r[0].data||state.home,nextAppointments=Array.isArray(r[1].data)?r[1].data:state.appointments;"
    if needle not in s:
        raise SystemExit("Dati refresh live non trovati")
    s = s.replace(needle, "const nextHome=r[0].data||state.home,nextAppointments=Array.isArray(r[1].data)?r[1].data:state.appointments,nextEyewear=Array.isArray(r[2]?.data)?r[2].data:state.eyewear;", 1)
    needle = "state.home=nextHome;state.appointments=nextAppointments;"
    if needle not in s:
        raise SystemExit("Assegnazione refresh live non trovata")
    s = s.replace(needle, "state.home=nextHome;state.eyewear=nextEyewear;state.appointments=nextAppointments;", 1)

# Forza l'aggiornamento della PWA installata su iPhone.
s = s.replace("20260907-eyewear1", NEW_BUILD)
s = s.replace("20260903-rxrules2", NEW_BUILD)
p.write_text(s, encoding="utf-8")

sw = Path("iphone-app-v13/sw.js")
ws = sw.read_text(encoding="utf-8")
ws = ws.replace("20260907-eyewear1", NEW_BUILD)
ws = ws.replace("20260903-rxrules2", NEW_BUILD)
sw.write_text(ws, encoding="utf-8")

for req in [MARK, "optyker-customer-eyewear", "data-nav=\"eyewear\"", "function eyewearMarkup()", NEW_BUILD]:
    if req not in s:
        raise SystemExit("Patch occhiali cliente incompleta: " + req)
if NEW_BUILD not in ws:
    raise SystemExit("Versione service worker non aggiornata")
print("Vista cliente Occhiali iPhone OK")
