// Lettura degli eventi WhatsApp (formato Cloud API, inoltrato da 360dialog). Logica pura, verificata da
// tests/whatsapp-ai.test.mjs. Con la coexistence, i messaggi scritti dall'app WhatsApp Business del
// negozio arrivano come "smb_message_echoes" e vengono salvati come messaggi in uscita dell'operatore.

export const PHONE_SENDER = 'WhatsApp Business (telefono)';
/** Reazioni e sticker si salvano ma non attivano l'assistente IA. */
export const IGNORED_TYPES = new Set(['reaction', 'sticker']);

export type Row = {
  wamid: string | null;
  phone: string;
  direction: 'inbound' | 'outbound';
  sender_name: string;
  message: string;
  status: string;
  created_at: string;
  type: string;
  raw: unknown;
};
export type StatusEvent = { wamid: string; status: string; error: string };

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const when = (ts: unknown) => (ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString());

export function messageText(m: any): string {
  const t = String(m?.type || '');
  const caption = (x: any) => {
    const c = String(x?.caption || '').trim();
    return c ? ' ' + c : '';
  };
  switch (t) {
    case 'text': return String(m.text?.body || '');
    case 'button': return String(m.button?.text || m.button?.payload || '[Pulsante]');
    case 'interactive':
      return String(m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '[Messaggio interattivo]');
    case 'image': return '[Immagine]' + caption(m.image);
    case 'video': return '[Video]' + caption(m.video);
    case 'document': return '[Documento]' + caption(m.document);
    case 'audio': return '[Audio]';
    case 'sticker': return '[Sticker]';
    case 'reaction': return ('[Reazione ' + String(m.reaction?.emoji || '').trim()).trim() + ']';
    case 'location': return '[Posizione]';
    case 'contacts': return '[Contatto]';
    default: return '[' + (t || 'messaggio') + ']';
  }
}

export function extractEvents(body: any): { inbound: Row[]; echoes: Row[]; statuses: StatusEvent[] } {
  const inbound: Row[] = [], echoes: Row[] = [], statuses: StatusEvent[] = [];
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const v = change?.value || {}, field = String(change?.field || 'messages');
      if (field === 'smb_message_echoes') {
        for (const e of v.message_echoes || []) {
          const phone = digits(e?.to);
          if (!phone) continue;
          echoes.push({
            wamid: e.id ? String(e.id) : null, phone, direction: 'outbound', sender_name: PHONE_SENDER,
            message: messageText(e), status: 'sent', created_at: when(e.timestamp), type: String(e.type || ''), raw: e,
          });
        }
        continue;
      }
      if (field === 'history' || field === 'smb_app_state_sync') continue;
      const names = new Map((v.contacts || []).map((c: any) => [String(c?.wa_id || ''), String(c?.profile?.name || 'Cliente')]));
      for (const m of v.messages || []) {
        const phone = String(m?.from || '');
        if (!phone) continue;
        inbound.push({
          wamid: m.id ? String(m.id) : null, phone, direction: 'inbound', sender_name: String(names.get(phone) || 'Cliente'),
          message: messageText(m), status: 'received', created_at: when(m.timestamp), type: String(m.type || ''), raw: m,
        });
      }
      for (const s of v.statuses || []) {
        const err = Array.isArray(s?.errors) && s.errors.length
          ? s.errors.map((e: any) => e?.title || e?.message || 'Errore').join(' · ')
          : '';
        statuses.push({ wamid: String(s?.id || ''), status: String(s?.status || ''), error: String(err) });
      }
    }
  }
  return { inbound, echoes, statuses };
}

/** Per ogni numero, l'ultimo messaggio nuovo che deve essere valutato dall'assistente IA. */
export function aiTargets(newInbound: Row[]): { phone: string; wamid: string }[] {
  const last = new Map<string, Row>();
  for (const r of newInbound) {
    if (!r.wamid || IGNORED_TYPES.has(r.type)) continue;
    const prev = last.get(r.phone);
    if (!prev || Date.parse(r.created_at) >= Date.parse(prev.created_at)) last.set(r.phone, r);
  }
  return [...last.values()].map((r) => ({ phone: r.phone, wamid: String(r.wamid) }));
}
