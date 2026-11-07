// Assistente IA WhatsApp: logica pura dell'assistente e lettura del webhook.
// node --experimental-strip-types --test tests/whatsapp-ai.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../supabase/functions/optyker-whatsapp-ai/logic.ts';
import * as P from '../supabase/functions/optyker-whatsapp-webhook/parse.ts';

const settings = (x = {}) => ({
  enabled: true, test_phones: [], model: 'claude-sonnet-5-5', operator_pause_hours: 12, handoff_wait_hours: 48,
  signature: '_Assistente automatico · Ottica Visual Care_', store_info: 'Ottica Visual Care\nVia Primo Maggio 4', ...x,
});
const now = new Date('2026-11-07T10:00:00Z');
const ago = (h) => new Date(now.getTime() - h * 3600000).toISOString().replace('Z', '+00:00');
const msg = (direction, hoursAgo, extra = {}) => ({
  wamid: 'w' + Math.random().toString(36).slice(2), direction, sender_name: direction === 'inbound' ? 'Mario' : 'MICHAEL MOLOGNI',
  message: 'ciao', created_at: ago(hoursAgo), type: 'text', ...extra,
});
const phone = '393331234567';

test('gate: spento o numero non di prova non lascia traccia', () => {
  assert.deepEqual(L.gate({ settings: settings({ enabled: false }), phone, now, messages: [], lastHandoffAt: null }), { ok: false, reason: 'assistente spento', log: false });
  assert.equal(L.gate({ settings: null, phone, now, messages: [], lastHandoffAt: null }).ok, false);
  const t = L.gate({ settings: settings({ test_phones: ['+39 340 0000000'] }), phone, now, messages: [], lastHandoffAt: null });
  assert.equal(t.ok, false); assert.equal(t.log, false);
  assert.equal(L.gate({ settings: settings({ test_phones: ['333 1234567'] }), phone, now, messages: [], lastHandoffAt: null }).ok, true);
});

test('gate: operatore attivo e chat in attesa dell\'operatore', () => {
  const op = L.gate({ settings: settings(), phone, now, messages: [msg('outbound', 2)], lastHandoffAt: null });
  assert.equal(op.ok, false); assert.equal(op.log, true);
  // Messaggi dell'assistente, delle automazioni e vecchi di 13 ore non bloccano.
  const free = [msg('outbound', 1, { sender_name: L.BOT_SENDER }), msg('outbound', 1, { sender_name: L.AUTOMATION_SENDER }), msg('outbound', 13)];
  assert.equal(L.gate({ settings: settings(), phone, now, messages: free, lastHandoffAt: null }).ok, true);
  // Echi dell'app WhatsApp Business = operatore.
  assert.equal(L.gate({ settings: settings(), phone, now, messages: [msg('outbound', 3, { sender_name: L.PHONE_SENDER })], lastHandoffAt: null }).ok, false);
  // Passata all'operatore 5 ore fa, nessuna risposta: silenzio.
  assert.equal(L.gate({ settings: settings(), phone, now, messages: [], lastHandoffAt: ago(5) }).ok, false);
  // L'operatore ha risposto dopo (20 ore fa) e la pausa è finita: l'assistente riprende.
  assert.equal(L.gate({ settings: settings(), phone, now, messages: [msg('outbound', 20)], lastHandoffAt: ago(30) }).ok, true);
  // Passata all'operatore più di 48 ore fa senza risposta: riprende.
  assert.equal(L.gate({ settings: settings(), phone, now, messages: [], lastHandoffAt: ago(50) }).ok, true);
});

test('messaggi da valutare: dopo l\'ultimo messaggio del negozio, senza reazioni, entro 24 ore', () => {
  const a = msg('inbound', 30), b = msg('outbound', 3, { sender_name: L.BOT_SENDER }), c = msg('inbound', 2, { message: 'sono pronti?' }),
    d = msg('inbound', 1, { type: 'reaction', message: '[Reazione 👍]' }), e = msg('inbound', 0.5, { message: 'grazie' });
  const p = L.pendingInbound([e, a, d, b, c], now);
  assert.deepEqual(p.map((m) => m.message), ['sono pronti?', 'grazie']);
  assert.equal(L.hasNonText(p), false);
  assert.equal(L.hasNonText([msg('inbound', 1, { type: 'image' })]), true);
  assert.equal(L.hasNonText([msg('inbound', 1, { type: 'button' }), msg('inbound', 1, { type: 'interactive' })]), false);
});

test('ora di Roma, date e orari liberi (anche con il cambio d\'ora)', () => {
  assert.deepEqual(L.romeParts(new Date('2026-11-10T08:00:00Z')), { date: '2026-11-10', time: '09:00', weekday: 2 });
  assert.equal(L.romeParts(new Date('2026-07-10T07:00:00Z')).time, '09:00');
  assert.equal(L.italianDay('2026-11-10'), 'martedì 10 novembre');
  assert.equal(L.romeTimestamp('2026-11-10', '09:15'), '2026-11-10 09:15:00 Europe/Rome');
  assert.equal(L.validDate('2026-02-30'), false); assert.equal(L.validDate('2026-12-08'), true);
  assert.equal(L.validTime('9:00'), false); assert.equal(L.validTime('09:00'), true); assert.equal(L.validTime('24:00'), false);
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(L.daysBetween('2026-11-07', '2026-11-10'), 3);
  const c = [
    { starts_at: '2026-11-10T08:00:00+00:00' }, { starts_at: '2026-11-10T08:00:00+00:00' },
    { starts_at: '2026-11-10T14:15:00+00:00' }, { starts_at: '2026-11-10T08:30:00+00:00' }, { starts_at: '2026-11-11T08:00:00+00:00' },
  ];
  assert.deepEqual(L.slotTimes(c, '2026-11-10'), ['09:00', '09:30', '15:15']);
});

test('messaggio per il modello: clienti, ruoli e firma tolta', () => {
  const sig = settings().signature;
  const text = L.buildUserMessage({
    now, signature: sig,
    clients: [{ cliente_id: 'c1', nome: 'Mario', cognome: 'Rossi' }],
    history: [msg('outbound', 3, { sender_name: L.BOT_SENDER, message: 'Ciao!\n\n' + sig }), msg('outbound', 2, { sender_name: L.AUTOMATION_SENDER, message: 'Promemoria' }), msg('outbound', 1)],
    pending: [msg('inbound', 0.1, { message: 'Di che colore è la lente destra?' })],
  });
  assert.match(text, /sabato 7 novembre 2026, ore 11:00/);
  assert.match(text, /riconosciuti dal numero WhatsApp da cui scrive \(1\):\n- cliente_id c1: Mario Rossi/);
  assert.match(text, /assistente automatico \(tu\): Ciao!/);
  assert.doesNotMatch(text, /Assistente automatico · Ottica/);
  assert.match(text, /messaggio automatico: Promemoria/);
  assert.match(text, /Negozio · operatore/);
  assert.match(text, /NUOVI MESSAGGI[\s\S]*Di che colore è la lente destra\?/);
  assert.match(L.buildUserMessage({ now, signature: sig, clients: [], history: [], pending: [msg('inbound', 0)] }), /nessuno \(numero non presente in anagrafica\)/);
});

test('istruzioni: solo i quattro argomenti, colori della scheda LAC, orari e servizi', () => {
  const s = L.buildSystemPrompt({
    storeInfo: 'Ottica Visual Care\nVia Primo Maggio 4, 24040 Lallio (BG)',
    hours: { settimana: [{ giorno: 'lunedì', orari: '09:00-13:00 e 15:00-19:00' }, { giorno: 'domenica', orari: 'chiuso' }], giorni_speciali: [{ data: '2026-12-08', giorno: 'martedì 8 dicembre', orari: 'chiuso' }] },
    services: [{ id: 's1', name: 'Analisi Visiva', duration_minutes: 90 }],
  });
  for (const r of [/dando del tu/, /colore della lente destra e della lente sinistra/, /passa_all_operatore/, /nessuna_risposta/,
    /lunedì: 09:00-13:00 e 15:00-19:00/, /martedì 8 dicembre \(2026-12-08\): chiuso/, /s1 · Analisi Visiva · 90 minuti/, /Via Primo Maggio 4/,
    /pronti da non più di 30 giorni/,
    // Il cliente è riconosciuto dal numero: niente richiesta di nome e cognome, famiglie gestite per nome.
    /riconosciuto dal numero WhatsApp da cui scrive/, /Non chiedere mai nome, cognome o numero di telefono/,
    /chiama lo strumento senza cliente_id/, /gli occhiali di Giulia sono pronti/]) assert.match(s, r);
  assert.doesNotMatch(s, /chiedi per chi è la richiesta \(nome e cognome\)/);
  const names = L.TOOLS.map((t) => t.name);
  for (const n of ['stato_ordini', 'appuntamenti_cliente', 'orari_disponibili', 'prenota_appuntamento', 'sposta_appuntamento', 'disdici_appuntamento', 'lenti_a_contatto', 'rispondi', 'nessuna_risposta', 'passa_all_operatore']) assert.ok(names.includes(n), n);
  for (const t of L.TOOLS) assert.equal(t.input_schema.type, 'object');
  // Ordini e lenti: cliente_id facoltativo, così bastano il numero e la domanda.
  for (const n of ['stato_ordini', 'lenti_a_contatto', 'appuntamenti_cliente']) assert.deepEqual(L.TOOLS.find((t) => t.name === n).input_schema.required, [], n);
});

test('ordini attuali e dati per ogni cliente collegato al numero', () => {
  const orders = [
    { tipo: 'occhiali', stato: 'in_lavorazione', giorni_nello_stato: 2 },
    { tipo: 'lenti a contatto', stato: 'pronto_per_il_ritiro', giorni_nello_stato: 3 },
    { tipo: 'occhiali', stato: 'pronto_per_il_ritiro', giorni_nello_stato: 30 },
    { tipo: 'occhiali', stato: 'pronto_per_il_ritiro', giorni_nello_stato: '31' },
    { tipo: 'occhiali', stato: 'consegnato', giorni_nello_stato: 1 },
    { tipo: 'occhiali', stato: 'annullato', giorni_nello_stato: 1 },
    { tipo: 'occhiali', stato: 'pronto_per_il_ritiro', giorni_nello_stato: null },
  ];
  assert.deepEqual(L.currentOrders(orders).map((o) => [o.stato, o.giorni_nello_stato]), [['in_lavorazione', 2], ['pronto_per_il_ritiro', 3], ['pronto_per_il_ritiro', 30]]);
  assert.deepEqual(L.currentOrders(null), []);
  const family = [{ cliente_id: 'c1', nome: 'Mario', cognome: 'Rossi' }, { cliente_id: 'c2', nome: 'Giulia', cognome: 'Rossi' }, { cliente_id: 'c3', nome: null, cognome: null }];
  const r = L.byClient(family, [[], [{ stato: 'pronto_per_il_ritiro' }], undefined], 'ordini');
  assert.equal(r.clienti_collegati_al_numero, 3);
  assert.deepEqual(r.con_dati, [{ cliente_id: 'c2', cliente: 'Giulia Rossi', ordini: [{ stato: 'pronto_per_il_ritiro' }] }]);
  assert.deepEqual(r.senza_dati, ['Mario Rossi', 'nome non indicato']);
});

test('testo finale per WhatsApp', () => {
  assert.equal(L.finalizeReply('  **Pronti** per il ritiro!\n\n\n\nA presto  ', '_Firma_'), '*Pronti* per il ritiro!\n\nA presto\n\n_Firma_');
  assert.equal(L.finalizeReply('### Orari\nlunedì', ''), 'Orari\nlunedì');
  assert.equal(L.finalizeReply('   ', '_Firma_'), null);
  assert.ok(L.finalizeReply('x'.repeat(5000), '').length <= 1200);
});

const use = (name, input = {}, id = 't' + Math.random()) => ({ content: [{ type: 'tool_use', id, name, input }], usage: { input_tokens: 10, output_tokens: 2 } });
const model = (...responses) => { let i = 0; const seen = []; const f = async (m) => { seen.push(JSON.parse(JSON.stringify(m))); return responses[i++]; }; f.seen = seen; return f; };

test('ciclo: strumento, poi risposta', async () => {
  const callModel = model(use('lenti_a_contatto', { cliente_id: 'c1' }, 'u1'), use('rispondi', { testo: 'La destra è blu, la sinistra rossa.' }));
  const calls = [];
  const d = await L.runAgent({ userText: 'x', callModel, runTool: async (n, a) => { calls.push([n, a]); return { schede: [{ colore_lente_destra: 'blu' }] }; } });
  assert.equal(d.decision, 'reply'); assert.equal(d.text, 'La destra è blu, la sinistra rossa.');
  assert.deepEqual(calls, [['lenti_a_contatto', { cliente_id: 'c1' }]]);
  assert.equal(d.wrote, false); assert.equal(d.usage.input_tokens, 20);
  const second = callModel.seen[1];
  assert.equal(second[1].role, 'assistant');
  assert.equal(second[2].content[0].type, 'tool_result'); assert.equal(second[2].content[0].tool_use_id, 'u1');
});

test('ciclo: silenzio, nessuna risposta, errori e scritture', async () => {
  assert.equal((await L.runAgent({ userText: 'x', callModel: model(use('passa_all_operatore', { motivo: 'chiede un prezzo' })), runTool: async () => ({}) })).reason, 'chiede un prezzo');
  assert.equal((await L.runAgent({ userText: 'x', callModel: model(use('nessuna_risposta', { motivo: 'grazie' })), runTool: async () => ({}) })).decision, 'no_reply');
  assert.equal((await L.runAgent({ userText: 'x', callModel: model({ content: [{ type: 'text', text: 'ciao' }] }), runTool: async () => ({}) })).decision, 'handoff');
  assert.equal((await L.runAgent({ userText: 'x', callModel: model(use('rispondi', { testo: '  ' })), runTool: async () => ({}) })).decision, 'handoff');
  const both = { content: [{ type: 'tool_use', id: 'a', name: 'stato_ordini', input: {} }, { type: 'tool_use', id: 'b', name: 'rispondi', input: { testo: 'ok' } }] };
  assert.equal((await L.runAgent({ userText: 'x', callModel: model(both), runTool: async () => ({}) })).decision, 'handoff');
  // Errore di uno strumento: il modello lo vede e può passare all'operatore.
  const m = model(use('stato_ordini', { cliente_id: 'zz' }), use('passa_all_operatore', { motivo: 'cliente non trovato' }));
  const d = await L.runAgent({ userText: 'x', callModel: m, runTool: async () => { throw new Error('cliente non collegato a questo numero'); } });
  assert.equal(d.decision, 'handoff'); assert.equal(d.toolCalls[0].ok, false);
  assert.match(m.seen[1][2].content[0].content, /cliente non collegato/);
  // Prenotazione riuscita: segnata come scrittura.
  const w = await L.runAgent({ userText: 'x', callModel: model(use('prenota_appuntamento', {}), use('rispondi', { testo: 'Prenotato!' })), runTool: async () => ({ ok: true }) });
  assert.equal(w.wrote, true); assert.equal(w.decision, 'reply');
  const f = await L.runAgent({ userText: 'x', callModel: model(use('prenota_appuntamento', {}), use('passa_all_operatore', { motivo: 'x' })), runTool: async () => ({ errore: 'orario occupato' }) });
  assert.equal(f.wrote, false);
  // Troppi passaggi.
  const loop = async () => use('stato_ordini', { cliente_id: 'c1' });
  assert.equal((await L.runAgent({ userText: 'x', callModel: loop, runTool: async () => ({}), maxRounds: 3 })).reason, 'troppi passaggi senza conclusione');
});

test('webhook: messaggi ricevuti, echi dell\'app Business, stati, cronologia ignorata', () => {
  const body = { object: 'whatsapp_business_account', entry: [{ changes: [
    { field: 'messages', value: { contacts: [{ wa_id: phone, profile: { name: 'Mario' } }], messages: [
      { from: phone, id: 'wamid.1', timestamp: '1794045600', type: 'text', text: { body: 'Sono pronti i miei occhiali?' } },
      { from: phone, id: 'wamid.2', timestamp: '1794045601', type: 'reaction', reaction: { emoji: '👍', message_id: 'x' } },
      { from: '393401112223', id: 'wamid.3', timestamp: '1794045602', type: 'image', image: { caption: 'questa montatura?' } },
      { from: phone, id: 'wamid.4', timestamp: '1794045590', type: 'button', button: { text: 'Confermo' } },
    ], statuses: [{ id: 'wamid.out', status: 'read' }, { id: 'wamid.bad', status: 'failed', errors: [{ title: 'Re-engagement message' }] }] } },
    { field: 'smb_message_echoes', value: { message_echoes: [{ from: '393313576467', to: phone, id: 'wamid.echo', timestamp: '1794045700', type: 'text', text: { body: 'Sì, passa pure!' } }] } },
    { field: 'history', value: { history: [{ threads: [] }] } },
  ] }] };
  const { inbound, echoes, statuses } = P.extractEvents(body);
  assert.deepEqual(inbound.map((r) => [r.wamid, r.message, r.sender_name]), [
    ['wamid.1', 'Sono pronti i miei occhiali?', 'Mario'], ['wamid.2', '[Reazione 👍]', 'Mario'],
    ['wamid.3', '[Immagine] questa montatura?', 'Cliente'], ['wamid.4', 'Confermo', 'Mario'],
  ]);
  assert.equal(inbound[0].created_at, '2026-11-07T10:00:00.000Z');
  assert.deepEqual(echoes.map((r) => [r.wamid, r.phone, r.direction, r.sender_name, r.message]), [['wamid.echo', phone, 'outbound', P.PHONE_SENDER, 'Sì, passa pure!']]);
  assert.equal(P.PHONE_SENDER, L.PHONE_SENDER);
  assert.deepEqual(statuses, [{ wamid: 'wamid.out', status: 'read', error: '' }, { wamid: 'wamid.bad', status: 'failed', error: 'Re-engagement message' }]);
  // Una sola valutazione per numero (l'ultima), reazioni escluse.
  assert.deepEqual(P.aiTargets(inbound), [{ phone, wamid: 'wamid.1' }, { phone: '393401112223', wamid: 'wamid.3' }]);
  assert.deepEqual(P.aiTargets([inbound[1]]), []);
  // Evento senza "field" (formato precedente): trattato come messaggi.
  assert.equal(P.extractEvents({ entry: [{ changes: [{ value: { messages: [{ from: phone, id: 'w9', type: 'text', text: { body: 'ciao' } }] } }] }] }).inbound.length, 1);
  assert.equal(P.messageText({ type: 'interactive', interactive: { list_reply: { title: 'Martedì 9:00' } } }), 'Martedì 9:00');
  assert.equal(P.messageText({ type: 'audio' }), '[Audio]');
});
