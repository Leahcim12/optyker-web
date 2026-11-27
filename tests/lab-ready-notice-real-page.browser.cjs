/* Laboratorio 20261127: conferma prima dell'avviso WhatsApp «busta pronta», sulla pagina reale della build (_site).
   Accesso operatore e API simulati: nessun cliente, busta o messaggio reale viene letto o scritto. */
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const {chromium} = require('playwright');

const op = 'MICHAEL MOLOGNI';
const ID = {A: 'aaaaaaaa-1111-4111-8111-111111111111', B: 'bbbbbbbb-2222-4222-8222-222222222222', E: 'eeeeeeee-5555-4555-8555-555555555555'};
const orders = [
  {id: ID.A, reference_code: 'BU-OC-2026-990001', order_type: 'eyewear_busta', status: 'costruzione', client_name: 'PROVA ROSSI', phone: '3331234567'},
  {id: ID.B, reference_code: 'BU-OC-2026-990002', order_type: 'eyewear_busta', status: 'pronto_consegna', client_name: 'PROVA BIANCHI', phone: '3407654321'},
  {id: ID.E, reference_code: '990005B26', order_type: 'lac_busta', status: 'in_spedizione', client_name: 'PROVA GIALLI', phone: '3201234567'},
].map((o) => Object.assign(o, {client_reference: 'T-' + o.reference_code.slice(-3), created_at: '2026-11-20T09:00:00Z', created_by: 'TEST',
  status_since: '2026-11-20T09:00:00Z', manual_status: false, manual_status_by: '', auto_work_at: '2026-11-22T09:00:00Z',
  auto_ready_at: '2026-11-30T09:00:00Z', payload: {snapshot: {}}, pending: null, last: null}));
const preview = (t) => "Buongiorno, siamo l'ottica di Lallio.\n*Ottica Visual Care*\n📍 Via Primo Maggio 4, 24040 Lallio (BG)\n\nCome stai? Volevamo avvisarti che " +
  (t === 'lac_busta' ? 'le tue lenti a contatto sono pronte' : 'il tuo occhiale è pronto') + '.\nPrenota tramite il link:\nhttps://optyker.it/booking/';
const info = (o) => ({id: o.id, reference_code: o.reference_code, order_type: o.order_type, status: o.status, status_since: o.status_since,
  client_name: o.client_name, phone: o.phone, phone_to: '39' + o.phone, enabled: true, can_send: true, block_reason: null,
  preview: preview(o.order_type), send_at: 'now', pending: o.status === 'pronto_consegna' ? o.pending : null, last: o.last});
const row = (o) => { const r = Object.assign({}, o); delete r.phone; delete r.pending; delete r.last; return r; };
const calls = [];

function labApi(fn, b) {
  calls.push({fn, action: b.p_action, payload: b.p_payload});
  const p = b.p_payload || {}, o = orders.find((x) => x.id === p.id);
  if (fn === 'optyker_api' && b.p_action === 'list_work_orders') return {ok: true, data: orders.map(row)};
  if (fn === 'optyker_api' && b.p_action === 'update_work_order_status') {
    Object.assign(o, {status: p.status, status_since: new Date().toISOString(), manual_status: true, manual_status_by: op, pending: null});
    return {ok: true, data: row(o)};
  }
  if (fn !== 'optyker_lab_ready_notice_api') return null;
  if (!b.p_username || !b.p_password) return {ok: false, error: 'Operatore non autorizzato'};
  const req = () => ({requested_at: new Date().toISOString(), requested_by: op});
  if (b.p_action === 'status') return {ok: true, data: (p.ids || []).map((id) => orders.find((x) => x.id === id)).filter(Boolean).map(info)};
  if (b.p_action === 'info') return {ok: true, data: info(o)};
  if (b.p_action === 'set_ready') { Object.assign(o, {status: 'pronto_consegna', manual_status: true, pending: p.notify ? req() : null}); return {ok: true, data: info(o), order: row(o)}; }
  if (b.p_action === 'send') { o.pending = req(); return {ok: true, repeat: false, data: info(o)}; }
  if (b.p_action === 'cancel') { o.pending = null; return {ok: true, cancelled: 1, data: info(o)}; }
  return {ok: false, error: 'Azione non valida'};
}

(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath: process.env.CHROME_EXECUTABLE_PATH} : {})});
  const context = await browser.newContext({viewport: {width: 1280, height: 950}, serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome'});
  const page = await context.newPage(), errors = [], dialogs = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await context.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    let b = {}; try { b = req.postDataJSON() || {}; } catch (e) { b = {}; }
    if (req.method() !== 'GET' || url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/v1/')) {
      let data = {ok: true, data: [], rows: [], clients: [], sheets: [], orders: [], messages: []};
      if (url.pathname.includes('optyker-staff-auth')) data = {ok: true, username: b.username || op, needs_password: false, has_email: true};
      const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc) { const x = labApi(rpc[1], b); if (x) data = x; }
      if (url.pathname.includes('/rest/v1/') && !url.pathname.includes('/rpc/')) data = [];
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
    }
    if (['www.optyker.it', 'optyker.it'].includes(url.hostname)) {
      let rel = url.pathname.replace(/^\//, ''); if (!rel || rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve('_site', rel);
      if (file.startsWith(path.resolve('_site') + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({status: 200, body: fs.readFileSync(file), contentType: ({'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
          '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml'}[path.extname(file)] || 'application/octet-stream')});
      }
    }
    return route.fulfill({status: 204, body: ''});
  });
  const card = (id) => page.locator('#labOrdersList .labCard', {has: page.locator('select[onchange*="' + id + '"]')});
  const select = (id) => card(id).locator('.labStatusBox select');
  const statusCalls = () => calls.filter((c) => c.fn === 'optyker_api' && c.action === 'update_work_order_status');
  const noticeCalls = (a) => calls.filter((c) => c.fn === 'optyker_lab_ready_notice_api' && c.action === a);
  async function waitFor(fn, ms = 8000) { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('attesa scaduta'); await page.waitForTimeout(25); } }
  const tab = (name) => page.click('#labStatusTabs [data-lab-tab="' + name + '"]');
  try {
    await page.goto('https://www.optyker.it/', {waitUntil: 'domcontentloaded'});
    const opts = await page.locator('#optykerLoginOperator option').evaluateAll((a) => a.map((o) => o.value).filter(Boolean));
    await page.selectOption('#optykerLoginOperator', opts.find((v) => /michael/i.test(v)) || opts[0]);
    await page.fill('#optykerAuthPassword', 'SYNTHETIC_PASSWORD'); await page.click('.optykerLoginButton');
    await page.waitForFunction(() => window.optykerAuthenticated === true);
    await page.waitForFunction(() => window.OPTYKER_LAB_READY_NOTICE === '20261127-confirm1' && window.labUpdateStatus && window.labUpdateStatus.__lrn === true);
    errors.length = 0;
    await page.evaluate(() => window.openLaboratory());
    await page.waitForSelector('#labOrdersList .labCard', {state: 'attached'});

    // Menu Stato ordine -> Pronto per la consegna: conferma con cliente, numero e testo; Annulla non salva nulla.
    await tab('work');
    await select(ID.A).selectOption('pronto_consegna');
    await page.waitForSelector('.lrnDialog [data-lrn-action="send"]');
    const text = await page.locator('.lrnDialog').innerText();
    for (const s of ['Busta pronta per la consegna', 'BU-OC-2026-990001', 'PROVA ROSSI', '+39 333 123 4567', 'il tuo occhiale è pronto'])
      assert.ok(text.includes(s), 'manca: ' + s + '\n' + text);
    if (process.env.LAB_READY_REAL_SCREENSHOT) await page.screenshot({path: process.env.LAB_READY_REAL_SCREENSHOT});
    await page.click('.lrnDialog [data-lrn-action="cancel"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.equal(await select(ID.A).inputValue(), 'costruzione'); assert.equal(statusCalls().length, 0);

    // «Sì»: stato e avviso insieme.
    await select(ID.A).selectOption('pronto_consegna');
    await page.waitForSelector('.lrnDialog [data-lrn-action="send"]');
    await page.click('.lrnDialog [data-lrn-action="send"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.deepEqual(noticeCalls('set_ready').map((c) => c.payload), [{id: ID.A, notify: true}]);
    assert.equal(statusCalls().length, 0);

    // «No»: cambio di stato originale del Laboratorio.
    await tab('ship');
    await select(ID.E).selectOption('pronto_consegna');
    await page.waitForSelector('.lrnDialog [data-lrn-action="status-only"]');
    await page.click('.lrnDialog [data-lrn-action="status-only"]');
    await waitFor(() => statusCalls().length === 1);
    assert.deepEqual(statusCalls()[0].payload, {id: ID.E, status: 'pronto_consegna'});

    // Buste pronte: stato dell'avviso e «Avvisa il cliente su WhatsApp» con conferma.
    await tab('ready');
    await page.waitForFunction((id) => { const s = [...document.querySelectorAll('#labOrdersList select')].find((x) => (x.getAttribute('onchange') || '').includes(id));
      return s && /Avvisa il cliente su WhatsApp/.test((s.closest('.labStatusBox').querySelector('.lrnSlot') || {}).textContent || ''); }, ID.B, {timeout: 10000});
    await page.waitForFunction((id) => { const s = [...document.querySelectorAll('#labOrdersList select')].find((x) => (x.getAttribute('onchange') || '').includes(id));
      return s && /in partenza/.test((s.closest('.labStatusBox').querySelector('.lrnSlot') || {}).textContent || ''); }, ID.A, {timeout: 10000});
    if (process.env.LAB_READY_REAL_CARDS_SCREENSHOT) await page.screenshot({path: process.env.LAB_READY_REAL_CARDS_SCREENSHOT});
    await card(ID.B).locator('.lrnSlot button').click();
    await page.waitForSelector('.lrnDialog [data-lrn-action="send"]');
    await page.click('.lrnDialog [data-lrn-action="send"]');
    await page.waitForSelector('.lrnOverlay', {state: 'detached'});
    assert.deepEqual(noticeCalls('send').map((c) => c.payload), [{id: ID.B}]);

    const mine = errors.filter((e) => /lab-ready-notice|lrn/i.test(e));
    assert.deepEqual(mine, []); assert.deepEqual(dialogs, []);
    console.log(JSON.stringify({ok: true, checks: ['conferma prima di Pronto per la consegna', 'Annulla non salva', 'Sì = set_ready con notify',
      'No = cambio di stato originale', 'stato avviso sotto le buste pronte', 'Avvisa il cliente = send'], other_page_errors: errors.length}));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
