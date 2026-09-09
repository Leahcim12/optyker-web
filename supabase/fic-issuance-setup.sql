BEGIN;
ALTER TABLE public.optyker_fic_states ADD COLUMN IF NOT EXISTS write_requested boolean NOT NULL DEFAULT false;
ALTER TABLE public.optyker_fic_connection ADD COLUMN IF NOT EXISTS can_write boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.optyker_fic_series (
 code text NOT NULL, year integer NOT NULL, label text NOT NULL, suffix text NOT NULL,
 last_number integer NOT NULL CHECK(last_number>=0), last_date date,
 PRIMARY KEY(code,year)
);
INSERT INTO public.optyker_fic_series(code,year,label,suffix,last_number) VALUES
 ('retail',2026,'Clienti / dettaglio','/26',38),
 ('wholesale',2026,'Ingrosso','/26/W',8),
 ('foreign',2026,'Integrazioni / autofatture estere','/26/A/ES',55)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.optyker_fic_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), series text NOT NULL, year integer NOT NULL,
 number integer, payload jsonb NOT NULL, totals jsonb NOT NULL,
 state text NOT NULL DEFAULT 'preview' CHECK(state IN ('preview','creating','created','create_rejected','create_unknown','sending','sent','send_unknown')),
 provider_id text, last_error text, review_hash text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(series,year) REFERENCES public.optyker_fic_series(code,year),
 UNIQUE(series,year,number)
);
ALTER TABLE public.optyker_fic_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optyker_fic_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.optyker_fic_series,public.optyker_fic_drafts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.optyker_fic_series,public.optyker_fic_drafts TO service_role;
-- Atomic number reservation. Only the authenticated Edge Function can call this.
CREATE OR REPLACE FUNCTION public.optyker_fic_reserve(p_id uuid,p_remote_number integer,p_remote_date date)
RETURNS public.optyker_fic_drafts LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.optyker_fic_drafts; s public.optyker_fic_series;
BEGIN
 SELECT * INTO STRICT d FROM public.optyker_fic_drafts WHERE id=p_id FOR UPDATE;
 IF d.state NOT IN ('preview','create_rejected') THEN RAISE EXCEPTION 'Documento già in elaborazione'; END IF;
 SELECT * INTO STRICT s FROM public.optyker_fic_series WHERE code=d.series AND year=d.year FOR UPDATE;
 IF (d.payload->>'date')::date < greatest(s.last_date,p_remote_date) THEN RAISE EXCEPTION 'Data precedente all’ultimo documento della serie'; END IF;
 IF d.number IS NULL THEN
   d.number := greatest(s.last_number,p_remote_number)+1;
   UPDATE public.optyker_fic_series SET last_number=d.number WHERE code=d.series AND year=d.year;
 END IF;
 UPDATE public.optyker_fic_drafts SET number=d.number,state='creating',last_error=NULL,
   payload=jsonb_set(payload,'{number}',to_jsonb(d.number)),updated_at=now() WHERE id=d.id RETURNING * INTO d;
 RETURN d;
END $$;
REVOKE EXECUTE ON FUNCTION public.optyker_fic_reserve(uuid,integer,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.optyker_fic_reserve(uuid,integer,date) TO service_role;
COMMIT;
