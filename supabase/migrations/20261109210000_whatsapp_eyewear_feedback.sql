-- Applicata in produzione il 9 novembre 2026 (whatsapp_eyewear_feedback).
-- "Come va con l'occhiale?" 7 e 30 giorni dopo la consegna, alle 10 (modello come_va_occhiale).
-- Consegna = Saldo consegna in cassa (optyker_pos_sales.delivered_at) di una vendita con occhiali
-- (Occhiali su ordinazione, Occhiali sole, premontato). Un messaggio per cliente e giorno di consegna.
insert into public.optyker_wa_automations(kind,label,template,daily_limit,enabled)
values ('occhiale_feedback','Come va con l''occhiale: 7 e 30 giorni dopo la consegna','come_va_occhiale',null,true)
on conflict (kind) do nothing;

create or replace function public.optyker_wa_due_feedback(p_now timestamptz default now())
returns table(job_key text, kind text, client_id uuid, appointment_id uuid, phone text, template text, params jsonb, preview text)
language plpgsql stable security definer set search_path=public as $$
declare
  loc timestamp := p_now at time zone 'Europe/Rome';
  today date := loc::date;
  h numeric := extract(hour from loc) + extract(minute from loc)/60.0;
begin
  if h < 10 or h >= 18 then return; end if;
  if not exists (select 1 from optyker_wa_automations w where w.kind = 'occhiale_feedback' and w.enabled) then return; end if;
  return query
  with d as (
    select distinct s.client_id, (s.delivered_at at time zone 'Europe/Rome')::date dd
    from optyker_pos_sales s
    where s.delivered_at is not null and s.client_id is not null
      and s.delivered_at > p_now - interval '40 days'
      and exists (select 1 from jsonb_array_elements(case jsonb_typeof(s.data->'lines') when 'array' then s.data->'lines' else '[]' end) l
                  where l->>'product_type' in ('Occhiali su ordinazione', 'Occhiali sole', 'premontato'))
  ), x as (
    select d.client_id, d.dd, n from d, unnest(array[7, 30]) n where d.dd + n = today
  )
  select 'eyefb:' || x.client_id || ':' || x.dd || ':' || x.n, 'occhiale_feedback', x.client_id, null::uuid, c.phone, 'come_va_occhiale', '[]'::jsonb,
    E'Buongiorno, siamo l''ottica di Lallio.\n*Ottica Visual Care*\n📍 Via Primo Maggio 4, 24040 Lallio (BG)\n\nCome stai? Volevamo sapere come va con l''occhiale.'
  from x join optyker_clients c on c.id = x.client_id
  where coalesce(c.phone, '') <> ''
    and not exists (select 1 from optyker_wa_automation_log l where l.job_key = 'eyefb:' || x.client_id || ':' || x.dd || ':' || x.n);
end $$;
revoke all on function public.optyker_wa_due_feedback(timestamptz) from public, anon, authenticated;

create or replace function public.optyker_wa_due(p_now timestamptz default now())
returns table(job_key text, kind text, client_id uuid, appointment_id uuid, phone text, template text, params jsonb, preview text)
language sql stable security definer set search_path=public as $$
  select * from optyker_wa_due_main(p_now)
  union all select * from optyker_wa_due_reminders(p_now)
  union all select * from optyker_wa_due_ready(p_now)
  union all select * from optyker_wa_due_feedback(p_now)
$$;
revoke all on function public.optyker_wa_due(timestamptz) from public, anon, authenticated;
