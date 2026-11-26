'use strict';
// Blocco stampa senza chiusura RCH (20261123), sulla pagina reale costruita (_site).
// Nessun dato reale: tutte le API Optyker, il connettore RCH locale e il Cloud Relay sono simulati.
// Uso: node tests/cash-print-closure-guard.browser.cjs _site   (richiede playwright)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const SITE = path.resolve(process.argv[2] || '_site');
const FN = 'https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/';
const LOCAL = 'http://127.0.0.1:8765';
const SALE_ID = '11111111-1111-4111-8111-111111111111';
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png'};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(SITE, p);
      if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function blockedGate(today, extra) {
  return Object.assign({allowed: false, reason: 'missing_closure', today, last_closure_date: '2026-11-21', last_closure_number: 1246,
    last_closure_text: 'sabato 21/11 alle 19:51', documents_after_closure: 0, uncertain_jobs: 0, pending_closure: null, today_opened: false,
    message: 'Stampa bloccata: manca la chiusura RCH del giorno precedente (domenica 22/11). Ultima chiusura: sabato 21/11 alle 19:51. Fai prima «Chiusura cassa e RCH» con la chiusura della RCH: poi la stampa si sblocca.'}, extra || {});
}
function allowedGate(today) {
  return {allowed: true, reason: 'closed_today', message: '', today, last_closure_text: 'lunedì 23/11 alle 08:57', uncertain_jobs: 0, today_opened: true};
}

// La pagina reale a volte completa il caricamento senza che Playwright riceva «load» (succede anche
// senza il blocco): si attende il DOM e poi i moduli della cassa.
async function gotoApp(page, base) {
  await page.goto(base + '/index.html', {waitUntil: 'domcontentloaded', timeout: 120000});
  await page.waitForFunction(() => document.readyState === 'complete' && typeof window.openOptykerCash === 'function' &&
    !!window.OPTYKER_CASH_SESSIONS && !!window.OPTYKER_FISCAL && !!window.OPTYKER_PRINT_GUARD, null, {timeout: 120000});
  await page.waitForTimeout(1500);
}
async function openPage(browser, base, mock) {
  const page = await browser.newPage({viewport: {width: 1366, height: 900}});
  page.on('pageerror', e => mock.errors.push(String(e && e.message || e)));
  page.on('dialog', d => { mock.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    if (url.startsWith(LOCAL)) {
      const p = url.slice(LOCAL.length).split('?')[0];
      mock.calls.push({fn: 'local', action: req.method() + ' ' + p});
      if (!mock.localOnline) return route.abort();
      if (p === '/health') return route.fulfill({json: {ok: true, version: '1.8-auto-receipt', capabilities: {automaticReference: true, receipt: true, reprintReceipt: true, voidReceipt: true}}});
      if (p === '/status') return route.fulfill({json: {ok: true, mode: 'REG', idleState: '0', busy: 0, errorCode: 0, printerError: 0, paperEnd: 0, coverOpen: 0}});
      return route.fulfill({json: {ok: true}});
    }
    if (url.startsWith(FN)) {
      const fn = url.slice(FN.length).split(/[/?#]/)[0];
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) { body = {}; }
      mock.calls.push({fn, action: body.action || '', payload: body.payload || {}});
      if (fn === 'optyker-cash-print-gate') {
        if (mock.gateStatus !== 200) return route.fulfill({status: mock.gateStatus, json: {ok: false, error: 'non disponibile'}});
        return route.fulfill({json: {ok: true, data: mock.gate}});
      }
      if (fn === 'optyker-rch-relay-api' && body.action === 'status')
        return route.fulfill({json: {ok: true, data: {online: true, connector_version: '2.2-daily-closure', status: {ok: true, mode: 'REG', idleState: '0', busy: 0, errorCode: 0, printerError: 0, paperEnd: 0, coverOpen: 0}}}});
      if (/^optyker-fiscal-api/.test(fn) && body.action === 'sale')
        return route.fulfill({json: {ok: true, data: {sale_id: SALE_ID, status: 'completed', total: 50, lines: [], has_fiscal_code: false, jobs: [],
          payments: [{id: '33333333-3333-4333-8333-333333333333', payment_stage: 'balance', payment_method: 'card', amount: 50, automatic_receipt: true, created_at: '2026-11-23T09:00:00Z'}]}}});
      if (/^optyker-cash-register-api/.test(fn) && body.action === 'open_deposits')
        return route.fulfill({json: {ok: true, data: [{id: '22222222-2222-4222-8222-222222222222', shopify_order_name: '#OVC-TEST', client: {name: 'Prova', surname: 'Cliente'},
          created_at: '2026-11-20T10:00:00Z', total: 300, paid_amount: 100, due_amount: 200}]}});
      return route.fulfill({json: {ok: true, data: []}});
    }
    return route.abort();
  });
  await gotoApp(page, base);
  return page;
}
const printCalls = mock => mock.calls.filter(c => c.fn === 'local' ? /^POST \/(receipt|receipt\/void|receipt\/reprint|gift-receipt)$/.test(c.action) :
  (/^optyker-fiscal-api/.test(c.fn) && ['prepare', 'prepare_void', 'unified_void_start', 'unified_void_prepare', 'reissue_prepare'].includes(c.action)) ||
  (c.fn === 'optyker-rch-relay-api' && (c.action === 'queue_fiscal' || (c.action === 'queue_aux' && c.payload.kind === 'gift_receipt'))) ||
  (/^optyker-cash-(register-api|local-api)/.test(c.fn) && c.payload.auto_receipt === true));
// Il clic su un pulsante bloccato non deve arrivare ai gestori del pulsante.
async function clickReaches(page, selector) {
  await page.evaluate(sel => {
    const b = document.querySelector(sel); window.__reached = window.__reached || {};
    b.addEventListener('click', () => { window.__reached[sel] = true; });
  }, selector);
  await page.click(selector, {force: true});
  await page.waitForTimeout(350);
  return page.evaluate(sel => !!(window.__reached && window.__reached[sel]), selector);
}
const login = page => page.evaluate(() => { window.OPTYKER_CLOUD = Object.assign(window.OPTYKER_CLOUD || {}, {username: 'OPERATORE PROVA', password: 'password-di-prova'}); window.OPTYKER_ACTIVE_USER = 'OPERATORE PROVA'; });
const showCash = page => page.evaluate(() => {
  window.openOptykerCash();
  const o = document.getElementById('optykerCashOverlay'); o.classList.add('open');
  const l = document.getElementById('optykerLoginScreen'); if (l) l.style.setProperty('display', 'none', 'important');
});

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  assert.match(html.match(/<script\b[^>]*>/)[0], /id="optykerCashPrintGuardJs"/, 'il blocco deve essere il primo script della pagina');
  const browser = await chromium.launch();
  try {
    // 1. Giorno senza chiusura: avviso, pulsanti bloccati, nessuna richiesta di stampa.
    const mock = {calls: [], errors: [], dialogs: [], gate: null, gateStatus: 200, localOnline: false};
    const page = await openPage(browser, base, mock);
    assert.equal(await page.evaluate(() => window.OPTYKER_PRINT_GUARD && window.OPTYKER_PRINT_GUARD.version), '20261123-guard1');
    const today = await page.evaluate(() => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Rome'}).format(new Date()));
    mock.gate = blockedGate(today);
    await login(page);
    await showCash(page);
    await page.waitForSelector('#optykerPrintLockBanner', {timeout: 15000});
    const banner = await page.textContent('#optykerPrintLockBanner');
    assert.match(banner, /Stampa bloccata: fai prima la chiusura/);
    assert.match(banner, /Manca la chiusura RCH di domenica 22\/11/);
    assert.match(banner, /sabato 21\/11 alle 19:51/);
    assert.match(banner, /1 · Apertura cassa/);
    assert.match(banner, /2 · Chiusura cassa e RCH/);
    await page.waitForFunction(() => document.getElementById('optykerCashGiftBtn').getAttribute('data-optyker-print-lock') === '1');
    const styles = await page.evaluate(() => ['optykerCashCheckoutBtn', 'optykerCashGiftBtn', 'optykerCashDrawer'].map(id => {
      const b = document.getElementById(id); return [id, b.getAttribute('data-optyker-print-lock'), getComputedStyle(b).opacity, getComputedStyle(b).cursor]; }));
    assert.deepEqual(styles.map(s => s[1]), ['1', '1', null], 'cassetto e REG restano liberi, stampa e cortesia no');
    assert.ok(Number(styles[1][2]) < 0.5 && styles[1][3] === 'not-allowed', 'il pulsante bloccato appare disattivato');

    const net = await page.evaluate(async ({FN, LOCAL}) => {
      const post = (url, body) => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.status, e => 'network');
      const o = {};
      o.fiscalPrepare = await post(FN + 'optyker-fiscal-api', {action: 'prepare', payload: {payment_id: 'x'}});
      o.fiscalV2Prepare = await post(FN + 'optyker-fiscal-api-v2', {action: 'prepare', payload: {payment_id: 'x'}});
      o.prepareVoid = await post(FN + 'optyker-fiscal-api', {action: 'prepare_void', payload: {}});
      o.unifiedVoid = await post(FN + 'optyker-fiscal-api', {action: 'unified_void_start', payload: {}});
      o.reissue = await post(FN + 'optyker-fiscal-api-v2', {action: 'reissue_prepare', payload: {}});
      o.relayQueue = await post(FN + 'optyker-rch-relay-api', {action: 'queue_fiscal', payload: {}});
      o.relayGift = await post(FN + 'optyker-rch-relay-api', {action: 'queue_aux', payload: {kind: 'gift_receipt'}});
      o.checkout = await post(FN + 'optyker-cash-register-api', {action: 'checkout', payload: {auto_receipt: true}});
      o.checkoutLocal = await post(FN + 'optyker-cash-local-api', {action: 'checkout', payload: {auto_receipt: true}});
      o.settle = await post(FN + 'optyker-cash-register-api-v2', {action: 'settle', payload: {auto_receipt: true}});
      o.localReceipt = await post(LOCAL + '/receipt', {});
      o.localVoid = await post(LOCAL + '/receipt/void', {});
      o.localReprint = await post(LOCAL + '/receipt/reprint', {});
      o.localGift = await post(LOCAL + '/gift-receipt', {});
      // Consentiti: consultazioni, cassetto, fattura, verifica esito.
      o.fiscalJob = await post(FN + 'optyker-fiscal-api', {action: 'job', payload: {}});
      o.relayStatus = await post(FN + 'optyker-rch-relay-api', {action: 'status', payload: {}});
      o.relayDrawer = await post(FN + 'optyker-rch-relay-api', {action: 'queue_aux', payload: {kind: 'drawer'}});
      o.invoice = await post(FN + 'optyker-cash-register-api', {action: 'checkout', payload: {auto_receipt: false, invoice_requested: true}});
      o.blockedBody = await fetch(FN + 'optyker-fiscal-api', {method: 'POST', body: JSON.stringify({action: 'prepare', payload: {}})}).then(r => r.json());
      o.checkReady = await window.OPTYKER_FISCAL.checkReady().then(() => 'passed', e => e.message);
      o.issuePayment = await window.OPTYKER_FISCAL.issuePayment('11111111-1111-4111-8111-111111111111', 'p').then(() => 'passed', e => e.message);
      return o;
    }, {FN, LOCAL});
    for (const k of ['fiscalPrepare', 'fiscalV2Prepare', 'prepareVoid', 'unifiedVoid', 'reissue', 'relayQueue', 'relayGift', 'checkout', 'checkoutLocal', 'settle', 'localReceipt', 'localVoid', 'localReprint', 'localGift'])
      assert.equal(net[k], 423, k + ' deve essere bloccata');
    for (const k of ['fiscalJob', 'relayStatus', 'relayDrawer', 'invoice']) assert.equal(net[k], 200, k + ' deve restare libera');
    assert.equal(net.blockedBody.ok, false);
    assert.match(net.blockedBody.error, /^Stampa bloccata: manca la chiusura RCH/);
    assert.match(net.checkReady, /^Stampa bloccata/);
    assert.match(net.issuePayment, /^Stampa bloccata/);
    assert.deepEqual(printCalls(mock), [], 'nessuna richiesta di stampa deve uscire');

    // Incassa e stampa: il clic non avvia la vendita (nessun incasso registrato, nessun tentativo in sospeso).
    await page.evaluate(() => { const b = document.getElementById('optykerCashCheckoutBtn'); b.disabled = false; });
    assert.equal(await clickReaches(page, '#optykerCashCheckoutBtn'), false, 'Incassa e stampa non deve partire');
    assert.equal(mock.calls.filter(c => c.action === 'checkout').length, 1, 'solo la prova con fattura è partita');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('optykerCashPendingRequest')), null);
    assert.match(await page.textContent('#optykerPrintLockToast'), /^Stampa bloccata/);
    // Con «Prepara fattura» non si stampa: il pulsante torna libero.
    await page.evaluate(() => { const i = document.getElementById('optykerCashInvoice'); i.disabled = false; i.checked = true; i.dispatchEvent(new Event('change', {bubbles: true})); });
    await page.waitForFunction(() => !document.getElementById('optykerCashCheckoutBtn').hasAttribute('data-optyker-print-lock'));
    await page.evaluate(() => { const i = document.getElementById('optykerCashInvoice'); i.checked = false; i.dispatchEvent(new Event('change', {bubbles: true})); });
    await page.waitForFunction(() => document.getElementById('optykerCashCheckoutBtn').getAttribute('data-optyker-print-lock') === '1');

    // Scontrino cortesia: nessun comando.
    assert.equal(await clickReaches(page, '#optykerCashGiftBtn'), false, 'Scontrino cortesia non deve partire');
    // Cassetto: resta libero (il clic arriva al pulsante).
    assert.equal(await clickReaches(page, '#optykerCashDrawer'), true, 'Apri cassetto resta disponibile');

    // Acconti aperti: Saldo bloccato prima della conferma.
    await page.click('#optykerCashDepositsBtn');
    await page.waitForSelector('#optykerCashDepositsModal [data-settle]');
    await page.waitForFunction(() => document.querySelector('#optykerCashDepositsModal [data-settle]').getAttribute('data-optyker-print-lock') === '1');
    assert.match(await page.textContent('#optykerCashDepositsModal'), /Stampa bloccata/);
    await page.selectOption('#optykerCashDepositsModal [data-settle-pay]', 'card');
    assert.equal(await clickReaches(page, '#optykerCashDepositsModal [data-settle="balance"]'), false, 'Saldo non deve partire');
    assert.deepEqual(mock.dialogs.filter(d => /Registrare/.test(d)), [], 'nessuna conferma di saldo deve comparire');
    await page.evaluate(() => document.getElementById('optykerCashDepositsModal').classList.remove('open'));

    // Finestra «Emissione scontrino RCH» del PC cassa, con la struttura di fiscal-receipts.js.
    await page.evaluate(() => {
      const m = document.createElement('div'); m.id = 'optykerFiscalModal'; m.className = 'optykerCashModal open';
      m.innerHTML = '<div class="optykerCashModalCard" style="max-width:950px"><div class="optykerCashModalTitle">Emissione scontrino RCH</div><div class="ofBody">' +
        '<p>€ 50,00 · dati fiscali già registrati con il pagamento.</p><button type="button" class="ofAutoIssue">Stampa scontrino</button>' +
        '<form class="ofIssue"><input name="probe"><button type="submit" class="ofEmit">Emetti scontrino di € 50,00</button></form>' +
        '<button type="button" id="probeReprint">Ristampa su RCH RT</button><button type="button" id="probeRefresh">Aggiorna esito</button></div>' +
        '<p class="ofMessage" role="status"></p><button type="button" class="ofClose optykerCashModalClose">Chiudi</button></div>';
      document.body.appendChild(m);
      m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); window.__submitted = true; });
    });
    await page.waitForFunction(() => document.querySelector('#optykerFiscalModal .ofAutoIssue').getAttribute('data-optyker-print-lock') === '1');
    assert.deepEqual(await page.evaluate(() => ['.ofAutoIssue', '.ofEmit', '#probeReprint', '#probeRefresh', '.ofClose'].map(sel =>
      document.querySelector('#optykerFiscalModal ' + sel).getAttribute('data-optyker-print-lock'))), ['1', '1', '1', null, null]);
    assert.match(await page.textContent('#optykerFiscalModal'), /Stampa bloccata/);
    assert.equal(await clickReaches(page, '#optykerFiscalModal .ofAutoIssue'), false, 'Stampa scontrino non deve partire');
    assert.equal(await clickReaches(page, '#probeReprint'), false, 'Ristampa non deve partire');
    assert.equal(await clickReaches(page, '#probeRefresh'), true, 'Aggiorna esito resta disponibile');
    await page.focus('#optykerFiscalModal input[name=probe]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__submitted === true), false, 'Invio nel modulo non deve emettere');
    await page.evaluate(() => document.getElementById('optykerFiscalModal').remove());
    // Emissione da iPad (Cloud Relay), con il modulo reale: «Emetti» bloccato.
    await page.evaluate(id => window.OPTYKER_FISCAL.openSale(id), SALE_ID);
    await page.waitForSelector('#optykerRchCloudModal [data-pay]');
    await page.waitForFunction(() => document.querySelector('#optykerRchCloudModal [data-pay]').getAttribute('data-optyker-print-lock') === '1');
    assert.equal(await clickReaches(page, '#optykerRchCloudModal [data-pay]'), false, 'Emetti (iPad) non deve partire');
    await page.evaluate(() => document.getElementById('optykerRchCloudModal').remove());
    assert.deepEqual(printCalls(mock), [], 'i clic su pulsanti bloccati non devono stampare');

    // Il pulsante dell'avviso apre la chiusura di oggi.
    await page.click('#optykerPrintLockBanner [data-oplb="close"]');
    await page.waitForSelector('#optykerCashSessionsModal');
    await page.evaluate(() => document.getElementById('optykerCashSessionsModal').remove());

    // Scontrini di ieri dopo l'ultima chiusura, scontrino da verificare, cassa già aperta.
    mock.gate = blockedGate(today, {reason: 'documents_after_closure', last_closure_date: today, documents_from: '2026-10-26', last_closure_text: 'lunedì 26/10 alle 09:21', uncertain_jobs: 1, today_opened: true});
    await page.evaluate(() => window.OPTYKER_PRINT_GUARD.refresh());
    await page.waitForFunction(() => /Ci sono scontrini di lunedì 26\/10/.test(document.getElementById('optykerPrintLockBanner').textContent));
    const banner2 = await page.textContent('#optykerPrintLockBanner');
    assert.match(banner2, /esito da verificare/);
    assert.match(banner2, /Ultime vendite/);
    assert.doesNotMatch(banner2, /1 · Apertura cassa/);

    // Chiusura fatta: tutto torna come prima.
    mock.gate = allowedGate(today);
    await page.evaluate(() => window.dispatchEvent(new Event('optyker:cash-session-changed')));
    await page.waitForFunction(() => !document.getElementById('optykerPrintLockBanner'), null, {timeout: 10000});
    assert.equal(await page.evaluate(() => document.querySelectorAll('[data-optyker-print-lock]').length), 0);
    assert.match(await page.textContent('#optykerPrintLockToast'), /stampa è di nuovo disponibile/);
    assert.equal(await page.evaluate(() => document.getElementById('optykerCashGiftBtn').style.opacity), '', 'stile del pulsante ripristinato');
    assert.equal(await clickReaches(page, '#optykerCashGiftBtn'), true, 'dopo la chiusura Scontrino cortesia torna disponibile');
    const after = await page.evaluate(async FN => ({
      prepare: await fetch(FN + 'optyker-fiscal-api', {method: 'POST', body: JSON.stringify({action: 'prepare', payload: {}})}).then(r => r.status),
      checkReady: await window.OPTYKER_FISCAL.checkReady().then(() => 'passed', e => e.message)
    }), FN);
    assert.deepEqual(after, {prepare: 200, checkReady: 'passed'});
    assert.ok(!mock.errors.some(e => /print-lock|PRINT_GUARD|printKind|oplb/i.test(e)), 'nessun errore del blocco: ' + mock.errors.join(' | '));
    await page.close();

    // 2. Controllo non disponibile: nessun blocco (il flusso resta quello di prima) e nessuna raffica di richieste.
    const down = {calls: [], errors: [], dialogs: [], gate: null, gateStatus: 503, localOnline: false};
    const page2 = await openPage(browser, base, down);
    await login(page2);
    await showCash(page2);
    await page2.waitForTimeout(2500);
    assert.equal(await page2.$('#optykerPrintLockBanner'), null);
    assert.equal(await page2.evaluate(FN => fetch(FN + 'optyker-fiscal-api', {method: 'POST', body: JSON.stringify({action: 'prepare', payload: {}})}).then(r => r.status), FN), 200);
    assert.ok(down.calls.filter(c => c.fn === 'optyker-cash-print-gate').length <= 3, 'nessuna raffica verso il controllo');
    await page2.close();

    // 3. Credenziali rifiutate: un solo tentativo, nessun blocco account per tentativi ripetuti.
    const denied = {calls: [], errors: [], dialogs: [], gate: null, gateStatus: 401, localOnline: false};
    const page3 = await openPage(browser, base, denied);
    await login(page3);
    await showCash(page3);
    await page3.waitForTimeout(7000);
    assert.equal(denied.calls.filter(c => c.fn === 'optyker-cash-print-gate').length, 1);
    await page3.close();

    // 4. Cambio giorno: la stampa consentita ieri sera non vale per stamattina.
    const night = {calls: [], errors: [], dialogs: [], gate: null, gateStatus: 200, localOnline: false};
    const ctx = await browser.newContext({viewport: {width: 1366, height: 900}});
    const p4 = await ctx.newPage();
    await p4.clock.setFixedTime(new Date('2026-11-21T19:30:00+01:00'));
    await p4.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      if (url.startsWith(FN + 'optyker-cash-print-gate')) { night.calls.push('gate'); return route.fulfill({json: {ok: true, data: night.gate}}); }
      if (url.startsWith(FN)) { night.calls.push(url.slice(FN.length)); return route.fulfill({json: {ok: true, data: []}}); }
      return route.abort();
    });
    await gotoApp(p4, base);
    night.gate = allowedGate('2026-11-21');
    await p4.evaluate(() => { window.OPTYKER_CLOUD = Object.assign(window.OPTYKER_CLOUD || {}, {username: 'OPERATORE PROVA', password: 'password-di-prova'}); return window.OPTYKER_PRINT_GUARD.refresh(); });
    const prep = FN => fetch(FN + 'optyker-fiscal-api', {method: 'POST', body: JSON.stringify({action: 'prepare', payload: {}})}).then(r => r.status);
    assert.equal(await p4.evaluate(prep, FN), 200, 'sabato sera dopo la chiusura si stampa');
    await p4.clock.setFixedTime(new Date('2026-11-23T09:50:00+01:00'));
    night.gate = blockedGate('2026-11-23');
    assert.equal(await p4.evaluate(prep, FN), 423, 'lunedì mattina senza chiusura no');
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log('Blocco stampa senza chiusura RCH: avviso, pulsanti, richieste, sblocco, controllo non disponibile e cambio giorno verificati');
})().catch(e => { console.error(e); process.exit(1); });
