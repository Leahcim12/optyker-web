import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Webhook WhatsApp (360dialog / Cloud API): salva i messaggi ricevuti, quelli scritti dall'app WhatsApp
// Business del negozio (coexistence, "smb_message_echoes") e gli stati di consegna. Per ogni nuovo
// messaggio ricevuto avvia l'assistente IA (optyker-whatsapp-ai), che decide se rispondere o restare in silenzio.
import { aiTargets, extractEvents, type Row } from './parse.ts';

const U = Deno.env.get('SUPABASE_URL')!, K = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { 'content-type': 'application/json', apikey: K, authorization: 'Bearer ' + K };
const txt = (s: string, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

async function cfg() {
  const r = await fetch(U + '/rest/v1/optyker_whatsapp_settings?select=verify_token&id=eq.1&limit=1', { headers: H });
  const a = await r.json();
  return a[0] || null;
}

async function findClient(phone: string) {
  const r = await fetch(U + '/rest/v1/rpc/optyker_find_client_by_phone', { method: 'POST', headers: H, body: JSON.stringify({ p_phone: phone }) });
  if (!r.ok) return null;
  return await r.json();
}

/** Inserisce il messaggio una sola volta (wamid univoco). true se è nuovo. */
async function insertRow(row: Row): Promise<boolean> {
  const { type: _type, ...data } = row;
  const client_id = await findClient(row.phone).catch(() => null);
  const r = await fetch(U + '/rest/v1/optyker_whatsapp_messages' + (row.wamid ? '?on_conflict=wamid' : ''), {
    method: 'POST',
    headers: { ...H, prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ ...data, client_id: client_id || null, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    console.error('optyker-whatsapp-webhook insert', r.status, (await r.text()).slice(0, 300));
    return false;
  }
  const a = await r.json().catch(() => []);
  return Array.isArray(a) && a.length > 0;
}

async function patchStatus(wamid: string, status: string, error = '') {
  if (!wamid) return;
  await fetch(U + '/rest/v1/optyker_whatsapp_messages?wamid=eq.' + encodeURIComponent(wamid), {
    method: 'PATCH', headers: { ...H, prefer: 'return=minimal' },
    body: JSON.stringify({ status, error_text: error, updated_at: new Date().toISOString() }),
  });
}

async function touch() {
  await fetch(U + '/rest/v1/optyker_whatsapp_settings?id=eq.1', {
    method: 'PATCH', headers: { ...H, prefer: 'return=minimal' },
    body: JSON.stringify({ webhook_last_received_at: new Date().toISOString() }),
  });
}

function startAssistant(phone: string, wamid: string) {
  EdgeRuntime.waitUntil(
    fetch(U + '/functions/v1/optyker-whatsapp-ai', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + K },
      body: JSON.stringify({ phone, wamid }),
    }).then((r) => r.body?.cancel()).catch((e) => console.error('optyker-whatsapp-ai start', String(e))),
  );
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    if (req.method === 'GET') {
      const mode = u.searchParams.get('hub.mode') || '', token = u.searchParams.get('hub.verify_token') || '', challenge = u.searchParams.get('hub.challenge') || '';
      const c = await cfg();
      if (mode === 'subscribe' && c?.verify_token && token === c.verify_token) return txt(challenge);
      return txt('Forbidden', 403);
    }
    if (req.method !== 'POST') return txt('Method not allowed', 405);
    const body = await req.json().catch(() => ({}));
    const { inbound, echoes, statuses } = extractEvents(body);
    const fresh: Row[] = [];
    for (const row of inbound) if (await insertRow(row)) fresh.push(row);
    for (const row of echoes) await insertRow(row);
    for (const s of statuses) await patchStatus(s.wamid, s.status, s.error);
    if (inbound.length || echoes.length || statuses.length) await touch().catch(() => {});
    for (const t of aiTargets(fresh)) startAssistant(t.phone, t.wamid);
    return txt('EVENT_RECEIVED');
  } catch (e) {
    console.error(e);
    return txt('EVENT_RECEIVED');
  }
});
