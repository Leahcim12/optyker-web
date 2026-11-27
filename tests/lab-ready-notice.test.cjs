/* Laboratorio 20261127: conferma prima dell'avviso WhatsApp «busta pronta».
   Pagina sintetica con lo script del Laboratorio ricostruito dalle patch della build (patch_laboratory_orders.py,
   apply_ovc_operations.py, patch_order_cart_lab_20260915.py), le schede per stato (lab-status-tabs.js) e il
   modulo lab-ready-notice.js caricato dal passo di build. API simulate: nessun cliente o busta reale. */
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('node:assert/strict');
const {execFileSync, spawnSync} = require('child_process');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');

// Script del Laboratorio come lo producono le patch della build (stesse sostituzioni, con controllo degli appigli).
const LAB_PAGE = String.raw`
import re, sys
from pathlib import Path
repo = Path(sys.argv[1])
src = (repo / 'scripts' / 'patch_laboratory_orders.py').read_text(encoding='utf-8')
css = re.search(r"\ncss=r'''(.*?)'''", src, re.S).group(1)
js = re.search(r"\njs=r'''(.*?)'''", src, re.S).group(1)
def one(s, old, new):
    if s.count(old) != 1:
        raise SystemExit('appiglio del Laboratorio cambiato: ' + old[:90])
    return s.replace(old, new, 1)
ovc = (repo / 'scripts' / 'apply_ovc_operations.py').read_text(encoding='utf-8')
for needle in ("'/rest/v1/rpc/optyker_api_legacy_passwordless'", "p_password:String(OPTYKER_CLOUD.password||'')"):
    if needle not in ovc:
        raise SystemExit('apply_ovc_operations.py cambiato: ' + needle)
js = one(js, "'/rest/v1/rpc/optyker_api_legacy_passwordless'", "'/rest/v1/rpc/optyker_api'")
js = one(js, "p_password:''", "p_password:String(OPTYKER_CLOUD.password||'')")
js = one(js, '<span class="labPill">LAC · BUSTA</span>', '<span class="labPill">\'+(o.order_type===\'eyewear_busta\'?\'OCCHIALI · BUSTA\':\'LAC · BUSTA\')+\'</span>')
js = js.replace("costruzione:'Costruzione'", "costruzione:'In costruzione'").replace('>Costruzione</option>', '>In costruzione</option>')
cart = (repo / 'scripts' / 'patch_order_cart_lab_20260915.py').read_text(encoding='utf-8')
opt = "<option value=\"in_spedizione\"'+(o.status==='in_spedizione'?' selected':'')+'>In spedizione</option>"
extra = "<option value=\"pronto_consegna\"'+(o.status==='pronto_consegna'?' selected':'')+'>Pronto per la consegna</option><option value=\"completato\"'+(o.status==='completato'?' selected':'')+'>Consegnato</option><option value=\"annullato\"'+(o.status==='annullato'?' selected':'')+'>Annullato</option>"
if opt.replace('"', '\\"') not in cart or extra.replace('"', '\\"') not in cart:
    raise SystemExit('patch_order_cart_lab_20260915.py cambiato: opzioni di stato')
js = one(js, opt, opt + extra)
js = one(js, '>Da fare</option>', '>Inserito</option>')
js = one(js, '>In costruzione</option>', '>In lavorazione</option>')
js, n = re.subn(r"function statusLabel\(s\)\{\s*return \{[^}]*\}\[s\]\|\|s\|\|'Da fare';?\s*\}",
    "function statusLabel(s){return {da_fare:'Inserito',in_preparazione:'In preparazione',costruzione:'In lavorazione',in_spedizione:'In spedizione',pronto_consegna:'Pronto per la consegna',completato:'Consegnato',annullato:'Annullato'}[s]||s||'Inserito'}", js, count=1)
if n != 1:
    raise SystemExit('statusLabel del Laboratorio cambiato')
boot = "<script>window.OPTYKER_CLOUD={root:'https://optyker.test/__db',key:'anon-test',username:'MICHAEL MOLOGNI',password:'SYNTHETIC',clients:[]};</script>"
page = ('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Optyker</title>' + boot + '</head><body>'
        '<button id="navOrders" class="moduleBtn">Ordini</button><div id="clientsPanel" class="panel">Clienti</div>'
        + css + js + '</body></html>')
sys.stdout.write(page)
`;

const ID = {A: '11111111-1111-4111-8111-111111111111', B: '22222222-2222-4222-8222-222222222222', C: '33333333-3333-4333-8333-333333333333',
  D: '44444444-4444-4444-8444-444444444444', E: '55555555-5555-4555-8555-555555555555'};
const XSS = '<img src=x onerror="window.__lrnXss=1">';
function freshOrders() {
  const o = (id, ref, type, status, name, phone, extra) => Object.assign({id, reference_code: ref, order_type: type, status, client_name: name,
    client_reference: 'C-' + ref.slice(-3), created_at: '2026-11-20T09:00:00Z', created_by: 'TEST', status_since: '2026-11-20T09:00:00Z',
    manual_status: false, manual_status_by: '', auto_work_at: '2026-11-22T09:00:00Z', auto_ready_at: '2026-11-30T09:00:00Z',
    payload: type === 'eyewear_busta' ? {snapshot: {frame: {type: 'Da vista', brand: 'Marca', model: 'M1'}, lens: {lens_type_od: 'Monofocale', lens_type_os: 'Monofocale', treatments: []}}} : {snapshot: {lacState: {odProductName: 'Lente prova'}}},
    phone, pending: null, last: null}, extra || {});
  return [
    o(ID.A, 'BU-OC-2026-000901', 'eyewear_busta', 'costruzione', 'ROSSI MARIO', '3331234567'),
    o(ID.B, 'BU-OC-2026-000902', 'eyewear_busta', 'pronto_consegna', 'BIANCHI ANNA', '3407654321'),
    o(ID.C, '210B26', 'lac_busta', 'in_spedizione', 'VERDI LUCA', ''),
    o(ID.D, 'BU-OC-2026-000904', 'eyewear_busta', 'pronto_consegna', XSS + ' NERI', '3391112222',
      {last: {status: 'sent', at: '2026-11-26T14:34:08Z', error: null, delivery: 'delivered', delivery_error: null}}),
    o(ID.E, 'BU-OC-2026-000905', 'eyewear_busta', 'in_spedizione', 'GIALLI PAOLA', '3201234567'),
  ];
}
const preview = (t) => "Buongiorno, siamo l'ottica di Lallio.\n*Ottica Visual Care*\n📍 Via Primo Maggio 4, 24040 Lallio (BG)\n\nCome stai? Volevamo avvisarti che " +
  (t === 'lac_busta' ? 'le tue lenti a contatto sono pronte' : 'il tuo occhiale è pronto') + '.\nPrenota tramite il link:\nhttps://optyker.it/booking/';

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-ready-notice-')), site = path.join(tmp, '_site');
  fs.mkdirSync(path.join(tmp, 'scripts'));
  for (const d of ['gestionale-v2', 'gestionale-v3']) fs.mkdirSync(path.join(site, d), {recursive: true});
  for (const f of ['apply_lab_tabs_20261108.py', 'apply_lab_ready_notice_20261127.py']) fs.copyFileSync(path.join(repo, 'scripts', f), path.join(tmp, 'scripts', f));
  for (const f of ['lab-status-tabs.js', 'lab-ready-notice.js']) fs.copyFileSync(path.join(repo, f), path.join(tmp, f));
  const PAGE = execFileSync('python3', ['-c', LAB_PAGE, repo], {encoding: 'utf8'});
  const ENTRIES = ['index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'];
  for (const rel of ENTRIES) fs.writeFileSync(path.join(site, rel), PAGE);
  const count = (s, x) => s.split(x).length - 1;

  // Passo di build: un solo caricamento differito nell'intestazione, ripetibile, stessa pagina nei tre accessi.
  execFileSync('python3', [path.join(tmp, 'scripts', 'apply_lab_tabs_20261108.py')]);
  const apply = path.join(tmp, 'scripts', 'apply_lab_ready_notice_20261127.py');
  execFileSync('python3', [apply]); execFileSync('python3', [apply]);
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.equal(count(html, 'id="optykerLabReadyNoticeJs"'), 1);
  assert.ok(html.indexOf('id="optykerLabReadyNoticeJs"') < html.indexOf('</head>'));
  const src = html.match(/id="optykerLabReadyNoticeJs" defer src="\/(lab-ready-notice\.[0-9a-f]{12}\.js)"/);
  assert.ok(src && fs.existsSync(path.join(site, src[1])));
  for (const rel of ENTRIES.slice(1)) assert.equal(fs.readFileSync(path.join(site, rel), 'utf8'), html);
  const version = JSON.parse(fs.readFileSync(path.join(site, 'lab-ready-notice-version.json'), 'utf8'));
  assert.equal(version.file, src[1]); assert.equal(version.api, 'optyker_lab_ready_notice_api');
  // Un Laboratorio diverso ferma la build invece di pubblicare una conferma che non compare.
  fs.writeFileSync(path.join(site, 'gestionale-v2/index.html'), html.replace('window.labUpdateStatus=function(id,status)', 'window.labSetStatus=function(id,status)'));
  let bad = spawnSync('python3', [apply], {encoding: 'utf8'});
  assert.notEqual(bad.status, 0); assert.match(bad.stderr + bad.stdout, /funzione labUpdateStatus cambiato nel Laboratorio di gestionale-v2/);
  fs.writeFileSync(path.join(site, 'gestionale-v2/index.html'), html.replace(/<script\b[^>]*id="optykerLaboratoryScript"[\s\S]*?<\/script>/, ''));
  bad = spawnSync('python3', [apply], {encoding: 'utf8'});
  assert.notEqual(bad.status, 0); assert.match(bad.stderr + bad.stdout, /script del Laboratorio assente o duplicato in gestionale-v2/);
  fs.writeFileSync(path.join(site, 'gestionale-v2/index.html'), html);

  // Server simulato: optyker_api (lista e cambio di stato del Laboratorio) e optyker_lab_ready_notice_api.
  let orders = freshOrders(), failNext = '';
  const calls = [];
  const info = (o) => ({id: o.id, reference_code: o.reference_code, order_type: o.order_type, status: o.status, status_since: o.status_since,
    client_name: o.client_name, phone: o.phone, phone_to: o.phone ? '39' + o.phone : '', enabled: true, can_send: !!o.phone,
    block_reason: o.phone ? null : 'Il cliente non ha un numero di cellulare in anagrafica.', preview: preview(o.order_type),
    send_at: 'now', pending: o.status === 'pronto_consegna' ? o.pending : null, last: o.last});
  const row = (o) => { const r = Object.assign({}, o); delete r.phone; delete r.pending; delete r.last; return r; };
  function handle(fn, b) {
    calls.push({fn, action: b.p_action, payload: b.p_payload});
    if (b.p_username !== 'MICHAEL MOLOGNI' || b.p_password !== 'SYNTHETIC') return {ok: false, error: 'Operatore non autorizzato'};
    const p = b.p_payload || {}, o = orders.find((x) => x.id === p.id);
    if (fn === 'optyker_api') {
      if (b.p_action === 'list_work_orders') return {ok: true, data: orders.map(row)};
      if (b.p_action === 'update_work_order_status') {
        if (!o) return {ok: false, error: 'Ordine non trovato'};
        Object.assign(o, {status: p.status, status_since: new Date().toISOString(), manual_status: true, manual_status_by: 'MICHAEL MOLOGNI', pending: null});
        return {ok: true, data: row(o)};
      }
      return {ok: false, error: 'azione non prevista nel test: ' + b.p_action};
    }
    if (failNext) { const e = failNext; failNext = ''; return {ok: false, error: e}; }
    if (b.p_action === 'status') return {ok: true, data: (p.ids || []).map((id) => orders.find((x) => x.id === id)).filter(Boolean).map(info)};
    if (!o) return {ok: false, error: 'Busta non trovata'};
    const req = () => ({requested_at: new Date().toISOString(), requested_by: 'MICHAEL MOLOGNI'});
    if (b.p_action === 'info') return {ok: true, data: info(o)};
    if (b.p_action === 'set_ready') {
      if (p.notify && !o.phone) return {ok: false, error: info(o).block_reason};
      Object.assign(o, {status: 'pronto_consegna', status_since: new Date().toISOString(), manual_status: true, pending: p.notify ? req() : null});
      return {ok: true, repeat: false, data: info(o), order: row(o)};
    }
    if (b.p_action === 'send') {
      if (o.status !== 'pronto_consegna') return {ok: false, error: 'La busta non è più in «Pronto per la consegna»: premi Aggiorna.'};
      o.pending = req();
      return {ok: true, repeat: false, data: info(o)};
    }
    if (b.p_action === 'cancel') { const n = o.pending ? 1 : 0; o.pending = null; return {ok: true, cancelled: n, data: info(o)}; }
    return {ok: false, error: 'Azione non valida'};
  }

  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath: process.env.CHROME_EXECUTABLE_PATH} : {})});
  const page = await browser.newPage({viewport: {width: 1180, height: 860}, locale: 'it-IT', timezoneId: 'Europe/Rome'});
  const errors = [], dialogs = [];
  page.on('pageerror', (x) => errors.push(String(x)));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.route('https://optyker.test/**', (route) => {
    const url = new URL(route.request().url());
    const rpc = url.pathname.match(/^\/__db\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (rpc) return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(handle(rpc[1], route.request().postDataJSON() || {}))});
    let rel = url.pathname.replace(/^\//, ''); if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(site, rel);
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'text/html', body: fs.readFileSync(file)});
  });

  const card = (id) => page.locator('#labOrdersList .labCard', {has: page.locator('select[onchange*="' + id + '"]')});
  const select = (id) => card(id).locator('.labStatusBox select');
  const tab = async (name) => { await page.click('#labStatusTabs [data-lab-tab="' + name + '"]'); };
  const statusCalls = () => calls.filter((c) => c.fn === 'optyker_api' && c.action === 'update_work_order_status');
  const noticeCalls = (a) => calls.filter((c) => c.fn === 'optyker_lab_ready_notice_api' && (!a || c.action === a));
  const dialogText = () => page.locator('.lrnDialog').innerText();
  const waitDialogReady = () => page.waitForSelector('.lrnDialog [data-lrn-action="send"], .lrnDialog [data-lrn-action="status-only"]');
  async function waitFor(fn, ms = 5000) { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('attesa scaduta'); await page.waitForTimeout(25); } }
  const slotText = (id) => card(id).locator('.lrnSlot').innerText();

  try {
    await page.goto('https://optyker.test/gestionale-v3/');
    await page.waitForFunction(() => window.OPTYKER_LAB_READY_NOTICE === '20261127-confirm1' && window.OPTYKER_LAB_TABS && typeof window.openLaboratory === 'function');
    await page.evaluate(() => window.openLaboratory());
    await page.waitForSelector('#labOrdersList .labCard', {state: 'attached'});
    await page.waitForFunction(() => window.labUpdateStatus && window.labUpdateStatus.__lrn === true);

    // 1. In lavorazione -> Pronto per la consegna: prima di salvare compare la conferma con cliente, numero e testo.
    await tab('work');
    await select(ID.A).selectOption('pronto_consegna');
    await waitDialogReady();
    let text = await dialogText();
    for (const s of ['Busta pronta per la consegna', 'BU-OC-2026-000901', 'Occhiali', 'ROSSI MARIO', '+39 333 123 4567',
      'Volevamo avvisarti che il tuo occhiale è pronto.', 'Il messaggio parte entro un minuto.', 'Sì, invia il messaggio',
      'No, solo «Pronto per la consegna»', 'Annulla']) assert.ok(text.includes(s), 'manca nella conferma: ' + s + '\n' + text);
    assert.equal(statusCalls().length, 0, 'lo stato non si salva prima della risposta');
    assert.deepEqual(noticeCalls().filter((c) => c.action !== 'status').map((c) => c.action), ['info']);
    await page.waitForFunction(() => document.activeElement && document.activeElement.textContent === 'Sì, invia il messaggio');

    // 2. Annulla: nessun salvataggio, il menu torna a In lavorazione e la busta resta nella sua scheda.
    await page.click('.lrnDialog [data-lrn-action="cancel"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.equal(await select(ID.A).inputValue(), 'costruzione');
    await page.waitForFunction((id) => { const s = [...document.querySelectorAll('#labOrdersList select')].find((x) => x.getAttribute('onchange').includes(id));
      return s && s.closest('.labCard').style.display !== 'none'; }, ID.A);
    assert.equal(statusCalls().length, 0);
    // Esc vale come Annulla.
    await select(ID.A).selectOption('pronto_consegna'); await waitDialogReady();
    await page.keyboard.press('Escape');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.equal(await select(ID.A).inputValue(), 'costruzione'); assert.equal(statusCalls().length, 0);

    // 3. «No»: stesso cambio di stato di prima (optyker_api), nessun avviso.
    await select(ID.A).selectOption('pronto_consegna'); await waitDialogReady();
    await page.click('.lrnDialog [data-lrn-action="status-only"]');
    await waitFor(() => statusCalls().length === 1);
    assert.deepEqual(statusCalls()[0].payload, {id: ID.A, status: 'pronto_consegna'});
    assert.equal(noticeCalls('set_ready').length + noticeCalls('send').length, 0);
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});

    // 4. «Sì»: stato e avviso confermati insieme (set_ready con notify), senza il cambio di stato separato.
    await tab('ship');
    await select(ID.E).selectOption('pronto_consegna'); await waitDialogReady();
    assert.ok((await dialogText()).includes('GIALLI PAOLA'));
    if (process.env.LAB_READY_SCREENSHOT) await page.locator('.lrnDialog').screenshot({path: process.env.LAB_READY_SCREENSHOT});
    failNext = 'Errore di prova';
    await page.click('.lrnDialog [data-lrn-action="send"]');
    await page.waitForFunction(() => { const e = document.querySelector('.lrnDialog .lrnError'); return e && !e.hidden && e.textContent === 'Errore di prova'; });
    assert.equal(await page.locator('.lrnDialog [data-lrn-action="send"]').isDisabled(), false, 'dopo un errore si può riprovare');
    assert.equal(orders.find((o) => o.id === ID.E).status, 'in_spedizione');
    await page.click('.lrnDialog [data-lrn-action="send"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    const sr = noticeCalls('set_ready');
    assert.equal(sr.length, 2); assert.deepEqual(sr[1].payload, {id: ID.E, notify: true});
    assert.equal(statusCalls().length, 1, 'nessun cambio di stato separato con «Sì»');
    await page.waitForFunction(() => /Il messaggio WhatsApp parte entro un minuto/.test((document.getElementById('lrnToast') || {}).textContent || ''));

    // 5. Scheda «Pronte per la consegna»: stato dell'avviso sotto ogni busta pronta.
    await waitFor(() => calls.filter((c) => c.action === 'list_work_orders').length >= 3);
    await tab('ready');
    await page.waitForFunction((ids) => ids.every((id) => [...document.querySelectorAll('#labOrdersList select')]
      .some((s) => s.getAttribute('onchange').includes(id) && s.closest('.labStatusBox').querySelector('.lrnSlot'))), [ID.A, ID.B, ID.D, ID.E]);
    assert.match(await slotText(ID.E), /Avviso WhatsApp in partenza\s+Confermato da MICHAEL MOLOGNI il \d\d\/\d\d alle \d\d:\d\d\s+Annulla avviso/);
    assert.match(await slotText(ID.B), /Cliente non ancora avvisato su WhatsApp\.\s+Avvisa il cliente su WhatsApp/);
    assert.match(await slotText(ID.A), /Cliente non ancora avvisato/);
    assert.match(await slotText(ID.D), /Avviso WhatsApp inviato il 26\/11 alle 15:34 · consegnato\s+Invia di nuovo/);
    assert.equal(await page.evaluate(() => window.__lrnXss), undefined);
    assert.ok((await card(ID.D).locator('.labClient').innerText()).includes('<img'));
    if (process.env.LAB_READY_CARDS_SCREENSHOT) await page.locator('#labOrdersPanel').screenshot({path: process.env.LAB_READY_CARDS_SCREENSHOT});

    // 6. Busta già pronta (anche arrivata da sola): «Avvisa il cliente» chiede conferma e poi conferma l'invio.
    await card(ID.B).locator('.lrnSlot button').click();
    await page.waitForSelector('.lrnDialog [data-lrn-action="send"]');
    text = await dialogText();
    assert.ok(text.includes('Avvisa il cliente su WhatsApp') && text.includes('BIANCHI ANNA') && text.includes('+39 340 765 4321'), text);
    assert.equal(noticeCalls('send').length, 0);
    await page.click('.lrnDialog [data-lrn-action="send"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.deepEqual(noticeCalls('send').map((c) => c.payload), [{id: ID.B}]);
    await page.waitForFunction((id) => { const s = [...document.querySelectorAll('#labOrdersList select')].find((x) => x.getAttribute('onchange').includes(id));
      return /Avviso WhatsApp in partenza/.test(s.closest('.labStatusBox').querySelector('.lrnSlot').textContent); }, ID.B);

    // 7. Già inviato: ripetere l'avviso avvisa che il cliente lo riceve di nuovo; Annulla non invia nulla.
    await card(ID.D).locator('.lrnSlot button').click();
    await page.waitForSelector('.lrnDialog [data-lrn-action="send"]');
    text = await dialogText();
    assert.ok(text.includes('questo avviso è già stato inviato il 26/11 alle 15:34 · consegnato') && text.includes('lo riceve di nuovo'), text);
    assert.ok(text.includes(XSS + ' NERI'), 'il nome resta testo');
    await page.click('.lrnDialog [data-lrn-action="cancel"]');
    assert.equal(noticeCalls('send').length, 1);

    // 8. Annulla avviso prima che parta.
    await card(ID.E).locator('.lrnSlot button').click();
    await page.waitForSelector('.lrnDialog [data-lrn-action="confirm-cancel"]');
    await page.click('.lrnDialog [data-lrn-action="confirm-cancel"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.deepEqual(noticeCalls('cancel').map((c) => c.payload), [{id: ID.E}]);
    await page.waitForFunction((id) => { const s = [...document.querySelectorAll('#labOrdersList select')].find((x) => x.getAttribute('onchange').includes(id));
      return /Cliente non ancora avvisato/.test(s.closest('.labStatusBox').querySelector('.lrnSlot').textContent); }, ID.E);

    // 9. Altri stati: nessuna conferma, cambio di stato originale.
    await select(ID.B).selectOption('completato');
    await waitFor(() => statusCalls().length === 2);
    assert.deepEqual(statusCalls()[1].payload, {id: ID.B, status: 'completato'});
    assert.equal(await page.locator('.lrnOverlay').count(), 0);

    // 10. Cliente senza numero: si può segnare pronto senza messaggio, l'avviso non è proposto.
    await tab('ship');
    await select(ID.C).selectOption('pronto_consegna');
    await page.waitForSelector('.lrnDialog [data-lrn-action="status-only"]');
    text = await dialogText();
    assert.ok(text.includes('Il cliente non ha un numero di cellulare in anagrafica.') && text.includes('Segna pronto senza messaggio'), text);
    assert.equal(await page.locator('.lrnDialog [data-lrn-action="send"]').count(), 0);
    await page.click('.lrnDialog [data-lrn-action="status-only"]');
    await waitFor(() => statusCalls().length === 3);
    assert.deepEqual(statusCalls()[2].payload, {id: ID.C, status: 'pronto_consegna'});
    await tab('ready');
    await page.waitForFunction((id) => { const s = [...document.querySelectorAll('#labOrdersList select')].find((x) => x.getAttribute('onchange').includes(id));
      const slot = s && s.closest('.labStatusBox').querySelector('.lrnSlot'); return slot && /non disponibile: Il cliente non ha un numero/.test(slot.textContent); }, ID.C);
    assert.equal(await card(ID.C).locator('.lrnSlot button').count(), 0);

    // 11. Nessun errore nella pagina, nessun alert/confirm del browser, e il modulo non si aggancia due volte.
    assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#optykerLabReadyNoticeCss').length), 1);
    console.log('Laboratorio: conferma avviso WhatsApp «busta pronta» verificata (' + calls.length + ' chiamate simulate)');
  } finally {
    await browser.close();
    fs.rmSync(tmp, {recursive: true, force: true});
  }
})().catch((e) => { console.error(e); process.exit(1); });
