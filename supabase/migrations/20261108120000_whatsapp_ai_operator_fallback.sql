-- Assistente IA WhatsApp: risposta di riserva sugli appuntamenti quando un operatore segue la chat
-- ma nessuno risponde entro operator_fallback_minutes (predefinito 30; 0 = mai).
-- Il messaggio resta in optyker_wa_ai_followups fino alla scadenza; optyker-whatsapp-automations
-- (ogni minuto) avvia optyker-whatsapp-ai in modalità "followups" che lo valuta.

alter table public.optyker_wa_ai_settings
  add column if not exists operator_fallback_minutes integer not null default 30
  check (operator_fallback_minutes between 0 and 1440);

comment on column public.optyker_wa_ai_settings.operator_fallback_minutes is
  'Minuti di attesa: se un operatore segue la chat ma non risponde a un messaggio sugli appuntamenti entro questo tempo, risponde l''assistente. 0 = mai.';

alter table public.optyker_wa_ai_log drop constraint if exists optyker_wa_ai_log_decision_check;
alter table public.optyker_wa_ai_log add constraint optyker_wa_ai_log_decision_check
  check (decision in ('processing', 'waiting', 'reply', 'handoff', 'no_reply', 'skipped', 'error'));

create table if not exists public.optyker_wa_ai_followups (
  inbound_wamid text primary key,
  phone text not null,
  log_id uuid,
  inbound_at timestamptz not null,
  due_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists optyker_wa_ai_followups_due on public.optyker_wa_ai_followups (due_at) where done_at is null;

comment on table public.optyker_wa_ai_followups is
  'Assistente IA WhatsApp: messaggi in attesa della risposta di un operatore; alla scadenza risponde l''assistente (solo appuntamenti).';

alter table public.optyker_wa_ai_followups enable row level security;
revoke all on public.optyker_wa_ai_followups from anon, authenticated;
