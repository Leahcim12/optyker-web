import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Assistente IA WhatsApp di Optyker. Lo avvia optyker-whatsapp-webhook per ogni nuovo messaggio ricevuto.
// Risponde da solo solo a orari/contatti, stato ordini, appuntamenti e lenti della scheda LAC; per tutto il
// resto resta in silenzio e la chat passa all'operatore. Impostazioni: optyker_wa_ai_settings.
// Segreti: ANTHROPIC_API_KEY (modello IA) e D360_API_KEY (invio WhatsApp tramite 360dialog).
import {
  addDays, BOT_SENDER, buildSystemPrompt, buildUserMessage, daysBetween, DEBOUNCE_MS, digits, finalizeReply,
  gate, hasNonText, IGNORED_TYPES, isOperatorMessage, italianDay, last10, pendingInbound, romeParts, romeTimestamp,
  runAgent, slotTimes, TOOLS, validDate, validTime,
  type Client, type Decision, type Msg, type Service, type Settings, type StoreHours,
} from './logic.ts';

const U = Deno.env.get('SUPABASE_URL')!, K = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { 'Content-Type': 'application/json', apikey: K, authorization: 'Bearer ' + K };
const json = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function rest(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(U + '/rest/v1/' + path, { ...init, signal: AbortSignal.timeout(20000), headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  let x: any = null;
  try { x = t ? JSON.parse(t) : null; } catch { x = t; }
  if (!r.ok) throw new Error('db ' + r.status + ': ' + String(t).slice(0, 200));
  return x;
}
const rpc = (name: string, p: Record<string, unknown> = {}) => rest('rpc/' + name, { method: 'POST', body: JSON.stringify(p) });

async function settings(): Promise<Settings | null> {
  const a = await rest('optyker_wa_ai_settings?select=*&id=eq.1&limit=1');
  return a?.[0] || null;
}

/** Ultimi messaggi della chat (7 giorni), dal più vecchio. Il numero è confrontato sulle ultime 10 cifre. */
async function recentMessages(phone: string): Promise<Msg[]> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const a = await rest('optyker_whatsapp_messages?select=wamid,direction,sender_name,message,created_at,type:raw->>type' +
    '&phone=like.*' + last10(phone) + '&created_at=gte.' + encodeURIComponent(since) + '&order=created_at.desc&limit=60');
  return (Array.isArray(a) ? a : []).reverse();
}

const latestInbound = (messages: Msg[]) =>
  messages.filter((m) => m.direction === 'inbound' && !IGNORED_TYPES.has(String(m.type || 'text'))).pop() || null;

async function lastHandoff(phone: string): Promise<string | null> {
  const a = await rest('optyker_wa_ai_log?select=created_at&phone=like.*' + last10(phone) + '&decision=eq.handoff&order=created_at.desc&limit=1');
  return a?.[0]?.created_at || null;
}

/** Una sola valutazione per messaggio: null se un'altra esecuzione l'ha già presa. */
async function claim(phone: string, wamid: string): Promise<string | null> {
  const a = await rest('optyker_wa_ai_log?on_conflict=inbound_wamid', {
    method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ phone, inbound_wamid: wamid }),
  });
  return a?.[0]?.id || null;
}

async function finish(id: string, patch: Record<string, unknown>) {
  await rest('optyker_wa_ai_log?id=eq.' + id, {
    method: 'PATCH', headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

async function storeContext(): Promise<{ hours: StoreHours; services: Service[] }> {
  const [hours, cfg] = await Promise.all([rpc('optyker_wa_ai_store_hours'), rpc('optyker_appointment_public_config')]);
  const services = (cfg?.services || []).map((s: any) => ({ id: String(s.id), name: String(s.name), duration_minutes: Number(s.duration_minutes) }));
  return { hours: hours || {}, services };
}

async function callModel(model: string, system: string, messages: unknown[]) {
  const key = String(Deno.env.get('ANTHROPIC_API_KEY') || '').trim();
  if (!key) throw new Error('Chiave ANTHROPIC_API_KEY non ancora salvata sul server');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 1024,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS, tool_choice: { type: 'any', disable_parallel_tool_use: true }, messages,
    }),
  });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('IA ' + r.status + ': ' + String(x?.error?.message || '').slice(0, 200));
  return x;
}

async function manageToken(id: string): Promise<string> {
  const a = await rest('optyker_appointments?select=manage_token&id=eq.' + encodeURIComponent(id) + '&limit=1');
  const t = a?.[0]?.manage_token;
  if (!t) throw new Error('appuntamento non gestibile');
  return t;
}

/** Strumenti dell'assistente. Ogni dato personale è filtrato sui clienti collegati al numero. */
function toolRunner(ctx: { phone: string; clients: Client[]; services: Service[]; dryRun: boolean }) {
  const ids = new Set(ctx.clients.map((c) => c.cliente_id));
  const needClient = (id: unknown) => {
    const v = String(id || '');
    if (!ids.has(v)) throw new Error('cliente non collegato a questo numero');
    return v;
  };
  const service = (id: unknown) => {
    const s = ctx.services.find((x) => x.id === String(id || ''));
    if (!s) throw new Error('servizio non prenotabile: usa un servizio_id dell\'elenco');
    return s;
  };
  const owned = async (id: unknown) => {
    const lists = await Promise.all([
      rpc('optyker_wa_ai_appointments', { p_phone: ctx.phone, p_client: null }),
      ...ctx.clients.map((c) => rpc('optyker_wa_ai_appointments', { p_phone: ctx.phone, p_client: c.cliente_id })),
    ]);
    for (const l of lists) for (const a of l || []) if (a.appuntamento_id === String(id || '')) return a;
    throw new Error('appuntamento non trovato tra quelli di questo numero');
  };
  const checkDay = (date: string) => {
    if (!validDate(date)) throw new Error('data non valida: usa AAAA-MM-GG');
    const d = daysBetween(romeParts(new Date()).date, date);
    if (d < 0) throw new Error('data nel passato');
    if (d > 120) throw new Error('data troppo lontana: al massimo 120 giorni');
  };
  const slots = async (serviceId: string, date: string, ignore: string | null) => {
    const x = await rpc('optyker_appointment_slots', { p_service_id: serviceId, p_date: date, p_operator: null, p_studio_id: null, p_ignore_appointment_id: ignore });
    if (!x?.ok) throw new Error(x?.error || 'orari non disponibili');
    return (x.data || []) as { starts_at: string; operator_username: string; studio_id: string | null }[];
  };
  const dayTime = (a: Record<string, unknown>) => {
    const date = String(a.data || ''), time = String(a.ora || '');
    checkDay(date);
    if (!validTime(time)) throw new Error('ora non valida: usa HH:MM');
    return { date, time };
  };

  return async (name: string, a: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case 'stato_ordini':
        return { ordini: await rpc('optyker_wa_ai_orders', { p_client: needClient(a.cliente_id) }) };
      case 'lenti_a_contatto':
        return { schede: await rpc('optyker_wa_ai_lac', { p_client: needClient(a.cliente_id) }) };
      case 'appuntamenti_cliente': {
        const id = a.cliente_id ? needClient(a.cliente_id) : ctx.clients.length === 1 ? ctx.clients[0].cliente_id : null;
        return { appuntamenti: await rpc('optyker_wa_ai_appointments', { p_phone: ctx.phone, p_client: id }) };
      }
      case 'orari_disponibili': {
        const s = service(a.servizio_id), date = String(a.data || '');
        checkDay(date);
        const ignore = a.appuntamento_da_spostare_id ? String((await owned(a.appuntamento_da_spostare_id)).appuntamento_id) : null;
        const times = slotTimes(await slots(s.id, date, ignore), date);
        if (times.length) return { servizio: s.name, data: date, giorno: italianDay(date), orari_liberi: times.slice(0, 24) };
        const next: unknown[] = [];
        for (let i = 1; i <= 21 && next.length < 3; i++) {
          const d = addDays(date, i);
          if (daysBetween(romeParts(new Date()).date, d) > 120) break;
          const t = slotTimes(await slots(s.id, d, ignore), d);
          if (t.length) next.push({ data: d, giorno: italianDay(d), orari_liberi: t.slice(0, 8) });
        }
        return { servizio: s.name, data: date, giorno: italianDay(date), orari_liberi: [], nota: 'nessun orario libero in questo giorno', prossimi_giorni_liberi: next };
      }
      case 'prenota_appuntamento': {
        const s = service(a.servizio_id), { date, time } = dayTime(a);
        let first = String(a.nome || '').trim(), last = String(a.cognome || '').trim(), cid: string | null = null;
        if (a.cliente_id) {
          cid = needClient(a.cliente_id);
          const c = ctx.clients.find((x) => x.cliente_id === cid);
          first = first || String(c?.nome || '').trim();
          last = last || String(c?.cognome || '').trim();
        }
        if (!first || !last) throw new Error('servono nome e cognome della persona');
        if (first.length > 60 || last.length > 60) throw new Error('nome o cognome troppo lunghi');
        const done = { servizio: s.name, giorno: italianDay(date), ora: time };
        if (ctx.dryRun) return { simulazione: true, ok: true, ...done };
        const x = await rpc('optyker_book_appointment', {
          p_payload: {
            service_id: s.id, starts_at: romeTimestamp(date, time), first_name: first, last_name: last,
            phone: '+' + digits(ctx.phone), client_id: cid, source: 'web', created_by: 'ASSISTENTE IA',
            notes: 'Prenotato su WhatsApp dall\'assistente automatico',
          },
        });
        if (!x?.ok) throw new Error(x?.error || 'prenotazione non riuscita');
        return { ok: true, ...done };
      }
      case 'sposta_appuntamento': {
        const appt = await owned(a.appuntamento_id), { date, time } = dayTime(a);
        const c = (await slots(appt.servizio_id, date, appt.appuntamento_id)).find((x) => {
          const r = romeParts(new Date(x.starts_at));
          return r.date === date && r.time === time;
        });
        if (!c) throw new Error('orario non libero: controlla con orari_disponibili');
        const done = { servizio: appt.servizio, giorno: italianDay(date), ora: time };
        if (ctx.dryRun) return { simulazione: true, ok: true, ...done };
        const x = await rpc('optyker_customer_appointment_manage', {
          p_token: await manageToken(appt.appuntamento_id), p_action: 'reschedule',
          p_payload: { starts_at: c.starts_at, operator_username: c.operator_username, studio_id: c.studio_id },
        });
        if (!x?.ok) throw new Error(x?.error || 'spostamento non riuscito');
        return { ok: true, ...done };
      }
      case 'disdici_appuntamento': {
        const appt = await owned(a.appuntamento_id);
        const done = { servizio: appt.servizio, giorno: appt.giorno, ora: appt.ora, disdetto: true };
        if (ctx.dryRun) return { simulazione: true, ok: true, ...done };
        const x = await rpc('optyker_customer_appointment_manage', { p_token: await manageToken(appt.appuntamento_id), p_action: 'cancel', p_payload: {} });
        if (!x?.ok) throw new Error(x?.error || 'disdetta non riuscita');
        return { ok: true, ...done };
      }
      default:
        throw new Error('strumento sconosciuto');
    }
  };
}

async function sendText(to: string, body: string) {
  const key = String(Deno.env.get('D360_API_KEY') || '').trim();
  if (!key) throw new Error('D360_API_KEY mancante');
  const r = await fetch('https://waba-v2.360dialog.io/messages', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'D360-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: false } }),
  });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('360dialog ' + r.status + ': ' + String(x?.error?.message || x?.meta?.developer_message || '').slice(0, 200));
  return x;
}

async function storeOutbound(phone: string, clientId: string | null, text: string, x: any): Promise<string | null> {
  const wamid = x?.messages?.[0]?.id || null, now = new Date().toISOString();
  await rest('optyker_whatsapp_messages', {
    method: 'POST', headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ wamid, client_id: clientId, phone, direction: 'outbound', sender_name: BOT_SENDER, message: text, status: 'sent', created_at: now, updated_at: now, raw: x }),
  });
  return wamid;
}

async function think(s: Settings, phone: string, now: Date, clients: Client[], history: Msg[], pending: Msg[], dryRun: boolean): Promise<Decision> {
  const { hours, services } = await storeContext();
  const system = buildSystemPrompt({ storeInfo: s.store_info, hours, services });
  const userText = buildUserMessage({ now, clients, history, pending, signature: s.signature });
  return runAgent({
    userText,
    callModel: (messages) => callModel(s.model, system, messages),
    runTool: toolRunner({ phone, clients, services, dryRun }),
  });
}

/** Valuta l'ultimo messaggio ricevuto da un numero e, se rientra negli argomenti consentiti, risponde. */
async function handle(phone: string, wamid: string) {
  await sleep(DEBOUNCE_MS);
  const messages = await recentMessages(phone);
  // Se nel frattempo il cliente ha scritto ancora, risponde l'esecuzione del messaggio più recente.
  if (latestInbound(messages)?.wamid !== wamid) return;
  const s = await settings(), now = new Date();
  const g = gate({ settings: s, phone, now, messages, lastHandoffAt: await lastHandoff(phone) });
  if (!g.ok && !g.log) return;
  const id = await claim(phone, wamid);
  if (!id) return;
  if (!g.ok) return finish(id, { decision: 'skipped', reason: g.reason });
  const pending = pendingInbound(messages, now);
  if (!pending.length) return finish(id, { decision: 'skipped', reason: 'nessun messaggio nuovo da valutare' });
  const clients = ((await rpc('optyker_wa_ai_clients', { p_phone: phone })) || []) as Client[];
  const clientId = clients.length === 1 ? clients[0].cliente_id : null;
  if (hasNonText(pending)) return finish(id, { decision: 'handoff', client_id: clientId, reason: 'foto, audio, documento o altro messaggio non testuale' });
  const pendingIds = new Set(pending.map((m) => m.wamid));
  const history = messages.filter((m) => !pendingIds.has(m.wamid) && !IGNORED_TYPES.has(String(m.type || ''))).slice(-20);

  let d: Decision;
  try {
    d = await think(s!, phone, now, clients, history, pending, false);
  } catch (e) {
    return finish(id, { decision: 'error', client_id: clientId, model: s!.model, reason: msg(e).slice(0, 500) });
  }
  const base = { client_id: clientId, model: s!.model, usage: d.usage, tool_calls: d.toolCalls };
  if (d.decision !== 'reply') {
    const note = d.wrote ? ' · ATTENZIONE: appuntamento modificato senza risposta al cliente' : '';
    return finish(id, { ...base, decision: d.decision, reason: ((d.reason || '') + note).trim() });
  }
  const text = finalizeReply(d.text, s!.signature);
  if (!text) return finish(id, { ...base, decision: 'handoff', reason: 'risposta vuota' });
  if (!d.wrote) {
    // Mentre l'IA ragionava: nuovo messaggio del cliente (risponde la sua esecuzione) o risposta di un operatore.
    const fresh = await recentMessages(phone);
    if (latestInbound(fresh)?.wamid !== wamid) return finish(id, { ...base, decision: 'skipped', reply: text, reason: 'nel frattempo è arrivato un nuovo messaggio' });
    if (fresh.some((m) => isOperatorMessage(m) && Date.parse(m.created_at) > now.getTime() - DEBOUNCE_MS)) {
      return finish(id, { ...base, decision: 'skipped', reply: text, reason: 'nel frattempo ha risposto un operatore' });
    }
  }
  try {
    const x = await sendText(phone, text);
    const replyWamid = await storeOutbound(phone, clientId, text, x);
    return finish(id, { ...base, decision: 'reply', reply: text, reply_wamid: replyWamid });
  } catch (e) {
    return finish(id, { ...base, decision: 'error', reply: text, reason: 'invio non riuscito: ' + msg(e).slice(0, 300) });
  }
}

/** Prova senza invio e senza modificare appuntamenti: il risultato va nella riga di optyker_whatsapp_selfcheck. */
async function dryRun(phone: string, text: string) {
  const s = await settings();
  if (!s) throw new Error('impostazioni mancanti');
  const now = new Date();
  const history = (await recentMessages(phone)).filter((m) => !IGNORED_TYPES.has(String(m.type || ''))).slice(-20);
  const clients = ((await rpc('optyker_wa_ai_clients', { p_phone: phone })) || []) as Client[];
  const pending: Msg[] = [{ wamid: 'prova', direction: 'inbound', sender_name: 'Cliente', message: text, created_at: now.toISOString(), type: 'text' }];
  const d = await think(s, phone, now, clients, history, pending, true);
  return {
    decision: d.decision, testo: d.decision === 'reply' ? finalizeReply(d.text, s.signature) : null, motivo: d.reason || null,
    strumenti: d.toolCalls.map((t) => ({ nome: t.name, ok: t.ok })), clienti_collegati: clients.length, usage: d.usage,
  };
}

async function selfcheckRow(token: unknown): Promise<{ id: number } | null> {
  const t = String(token || '');
  if (t.length < 24) return null;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map((n) => n.toString(16).padStart(2, '0')).join('');
  const since = new Date(Date.now() - 600000).toISOString();
  const a = await rest('optyker_whatsapp_selfcheck?select=id&token_hash=eq.' + hash + '&used_at=is.null&created_at=gt.' + encodeURIComponent(since) + '&limit=1');
  return a?.[0] || null;
}

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const b = await req.json().catch(() => ({}));
  if (b?.mode === 'dry_run') {
    const row = await selfcheckRow(b.token);
    if (!row) return json({ ok: false }, 403);
    const result = await dryRun(digits(b.phone), String(b.text || '').slice(0, 1000)).catch((e) => ({ errore: msg(e) }));
    await rest('optyker_whatsapp_selfcheck?id=eq.' + row.id, {
      method: 'PATCH', headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ result, used_at: new Date().toISOString() }),
    });
    return json({ ok: true });
  }
  if (!sameSecret(req.headers.get('authorization') || '', 'Bearer ' + K)) return json({ ok: false }, 401);
  const phone = digits(b.phone), wamid = String(b.wamid || '');
  if (phone.length < 9 || !wamid) return json({ ok: false, error: 'phone e wamid obbligatori' }, 400);
  EdgeRuntime.waitUntil(handle(phone, wamid).catch((e) => console.error('optyker-whatsapp-ai', msg(e))));
  return json({ ok: true, queued: true }, 202);
});
